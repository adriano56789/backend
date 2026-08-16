// @ts-nocheck
import express from 'express';
import { ChatMessage, User, Block } from '../models/index';
import { canSendMessage } from '../utils/chatPermission';

const router = express.Router();

// GET /api/messages - Buscar mensagens do usuário logado
router.get('/', async (req, res) => {
    try {
        const { userId, limit = 50, offset = 0 } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId é obrigatório' });
        }

        const messages = await ChatMessage.find({
            $or: [
                { senderId: userId },
                { receiverId: userId }
            ]
        })
            .sort({ sentAt: -1 })
            .limit(parseInt(limit as string))
            .skip(parseInt(offset as string));

        const senderIds = [...new Set(messages.map(msg => msg.senderId))];
        const senders = await User.find({ id: { $in: senderIds } }).select('id name avatarUrl age level identification birthday');
        const senderMap = new Map(senders.map(sender => [sender.id, sender]));

        const mappedMessages = messages.reverse().map((msg: any) => {
            const sender = senderMap.get(msg.senderId);
            const senderData = sender ? {
                senderName: sender.name,
                senderAvatar: sender.avatarUrl,
                senderAge: sender.age,
                senderLevel: sender.level,
                senderIdentification: sender.identification,
                senderBirthday: sender.birthday
            } : {};

            return {
                id: msg.id,
                chatId: msg.conversationId || `chat_${[msg.senderId, msg.receiverId].sort().join('_')}`,
                from: msg.senderId,
                to: msg.receiverId,
                text: msg.content || '',
                imageUrl: msg.messageType === 'image' ? msg.content : undefined,
                timestamp: msg.sentAt?.toISOString() || msg.createdAt?.toISOString() || new Date().toISOString(),
                status: msg.isRead ? 'read' : 'delivered',
                replyTo: msg.metadata?.replyTo || undefined,
                ...senderData
            };
        });

        res.json({
            success: true,
            messages: mappedMessages,
            total: mappedMessages.length
        });

    } catch (error: any) {
        console.error('❌ Erro ao buscar mensagens:', error);
        res.status(500).json({ error: 'Erro interno ao buscar mensagens' });
    }
});

// GET /api/chats/:userId/messages - Rota para buscar mensagens de um chat específico
router.get('/chats/:userId/messages', async (req, res) => {
    try {
        const { userId } = req.params;
        const { currentUserId } = req.query;
        const { limit = 100, offset = 0 } = req.query;

        if (!currentUserId) {
            return res.status(400).json({ error: 'currentUserId é obrigatório' });
        }

        const messages = await ChatMessage.find({
            $or: [
                { senderId: currentUserId, receiverId: userId },
                { senderId: userId, receiverId: currentUserId }
            ]
        })
            // ⬇️ MAIS RECENTES PRIMEIRO: antes era sentAt ASC (as 50 mais
            // ANTIGAS) — conversas com +50 mensagens faziam as mensagens novas
            // sumirem ao reabrir o chat. Agora traz as 100 mais novas e reverte
            // para ordem cronológica na resposta.
            .sort({ sentAt: -1 })
            .limit(parseInt(limit as string))
            .skip(parseInt(offset as string));

        const senderIds = [...new Set(messages.map(msg => msg.senderId))];
        const senders = await User.find({ id: { $in: senderIds } }).select('id name avatarUrl age level identification');
        const senderMap = new Map(senders.map(sender => [sender.id, sender]));

        const mappedMessages = messages.map((msg: any) => {
            const sender = senderMap.get(msg.senderId);
            const senderData = sender ? {
                senderName: sender.name,
                senderAvatar: sender.avatarUrl,
                senderAge: sender.age,
                senderLevel: sender.level,
                senderIdentification: sender.identification,
                senderBirthday: sender.birthday
            } : {};

            return {
                id: msg.id,
                chatId: msg.conversationId || `chat_${[msg.senderId, msg.receiverId].sort().join('_')}`,
                from: msg.senderId,
                to: msg.receiverId,
                text: msg.messageType !== 'image' ? (msg.content || '') : '',
                imageUrl: msg.messageType === 'image' ? msg.content : undefined,
                timestamp: msg.sentAt?.toISOString() || msg.createdAt?.toISOString() || new Date().toISOString(),
                status: msg.isRead ? 'read' : 'delivered',
                replyTo: msg.metadata?.replyTo || undefined,
                ...senderData
            };
        }).reverse();

        // 📖 Marcar como lidas as mensagens que o currentUser recebeu de `userId`
        // (enquanto ele está com o chat aberto). Retorna os IDs para notificar o
        // remetente via socket (✓✓ azul em tempo real, igual WhatsApp).
        let readMessageIds: string[] = [];
        const unread = await ChatMessage.find({
            senderId: userId,
            receiverId: currentUserId,
            isRead: false
        }).select('id').lean();

        if (unread.length > 0) {
            readMessageIds = unread.map((m: any) => m.id);
            await ChatMessage.updateMany(
                {
                    senderId: userId,
                    receiverId: currentUserId,
                    isRead: false
                },
                { $set: { isRead: true, readAt: new Date() } }
            ).catch(() => {});
        }

        const io = req.app.get('io');
        // 🔵 Notificar o REMETENTE que as mensagens foram lidas → ✓✓ azul no chat dele
        if (io && readMessageIds.length > 0) {
            io.to(`user_${userId}`).emit('messages_read', {
                userId: currentUserId,
                messageIds: readMessageIds,
                chatId: `chat_private_${[userId, currentUserId].sort().join('_')}`,
                timestamp: new Date().toISOString()
            });
        }

        res.json({
            success: true,
            messages: mappedMessages,
            total: mappedMessages.length
        });

    } catch (error: any) {
        console.error('❌ Erro ao buscar mensagens do usuário:', error);
        res.status(500).json({ error: 'Erro interno ao buscar mensagens' });
    }
});

// POST /api/messages - Enviar nova mensagem
router.post('/', async (req, res) => {
    try {
        const { conversationId, senderId, receiverId, content, messageType = 'text', imageUrl } = req.body;

        if (!conversationId || !senderId || !receiverId || (!content && !imageUrl)) {
            return res.status(400).json({ error: 'Dados incompletos' });
        }

        const existingBlock = await Block.findOne({
            $or: [
                { blockerId: senderId, blockedId: receiverId, isActive: true },
                { blockerId: receiverId, blockedId: senderId, isActive: true }
            ]
        });

        if (existingBlock) {
            return res.status(403).json({ 
                error: 'Não é possível enviar mensagem',
                message: 'Usuários bloqueados não podem enviar mensagens entre si'
            });
        }

        const permCheck = await canSendMessage(senderId, receiverId);
        if (!permCheck.allowed) {
            return res.status(403).json({ error: permCheck.reason, code: 'CHAT_PERMISSION_DENIED' });
        }

        const message = await ChatMessage.create({
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            conversationId,
            senderId,
            receiverId,
            content: messageType === 'image' ? imageUrl : content,
            messageType,
            isRead: false,
            sentAt: new Date()
        });

        User.findOneAndUpdate(
            { id: senderId },
            { 
                $inc: { messagesSent: 1 },
                $push: { recentActivities: { $each: [{
                        action: 'message_send',
                        resource: 'communication',
                        timestamp: new Date(),
                        endpoint: '/api/messages'
                    }], $slice: -50 } }
            }
        ).catch(() => {});

        const sender = await User.findOne({ id: senderId }).select('id name avatarUrl age level identification birthday');

        const messageData = {
            id: message.id,
            chatId: conversationId,
            from: senderId,
            to: receiverId,
            text: messageType !== 'image' ? (content || '') : '',
            imageUrl: messageType === 'image' ? imageUrl : undefined,
            timestamp: message.sentAt?.toISOString() || message.createdAt?.toISOString() || new Date().toISOString(),
            status: 'sent',
            senderName: sender?.name,
            senderAvatar: sender?.avatarUrl,
            senderAge: sender?.age,
            senderLevel: sender?.level,
            senderIdentification: sender?.identification,
            senderBirthday: sender?.birthday
        };

        const io = req.app.get('io');
        if (io) {
            // Notificar o destinatário com o mesmo evento que o frontend escuta
            io.to(`user_${receiverId}`).emit('newChatMessage', messageData);

            // Confirmar ao remetente que a mensagem foi enviada
            io.to(`user_${senderId}`).emit('message_sent', {
                tempId: req.body.tempId || messageData.id,
                messageId: messageData.id,
                success: true
            });

            io.to(`conversation_${conversationId}`).emit('conversation_update', {
                conversationId,
                lastMessage: {
                    content: messageType === 'image' ? '[Imagem]' : content,
                    senderId,
                    timestamp: new Date()
                }
            });

            io.to(`user_${receiverId}`).emit('chat_notification', {
                type: 'new_message',
                from: senderId,
                fromName: sender?.name,
                fromAvatar: sender?.avatarUrl,
                message: messageType === 'image' ? '[Imagem]' : (content || ''),
                timestamp: new Date().toISOString(),
                conversationId
            });

            // Notificação centralizada via NotificationService
            try {
                const { NotificationService } = await import('../services/NotificationService');
                const senderName = sender?.name || 'Alguém';
                const bodyPreview = messageType === 'image' ? '[Imagem]' : (content?.substring(0, 100) || '');
                await NotificationService.notifyNewMessage(
                    io,
                    receiverId,
                    senderId,
                    senderName,
                    bodyPreview,
                    conversationId,
                );
            } catch (notifErr) {
                console.error('[MESSAGES] Erro NotificationService:', notifErr);
            }
        }

        res.json({
            success: true,
            message: messageData
        });

    } catch (error: any) {
        console.error('❌ Erro ao enviar mensagem:', error);
        res.status(500).json({ error: 'Erro interno ao enviar mensagem' });
    }
});

// PUT /api/messages/read - Marcar várias mensagens como lidas (batch) e
// notificar os REMETENTES em tempo real (✓✓ azul estilo WhatsApp).
router.put('/read', async (req, res) => {
    try {
        const { messageIds, userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId é obrigatório' });
        }
        if (!Array.isArray(messageIds) || messageIds.length === 0) {
            return res.status(400).json({ error: 'messageIds deve ser uma lista não vazia' });
        }

        const result = await ChatMessage.updateMany(
            {
                id: { $in: messageIds },
                receiverId: userId,
                isRead: false
            },
            { $set: { isRead: true, readAt: new Date() } }
        );

        // Agrupar por remetente para notificar cada um
        const affected = await ChatMessage.find({
            id: { $in: messageIds },
            receiverId: userId
        }).select('senderId id').lean();

        const bySender = new Map<string, string[]>();
        affected.forEach((m: any) => {
            const list = bySender.get(m.senderId) || [];
            list.push(m.id);
            bySender.set(m.senderId, list);
        });

        const io = req.app.get('io');
        if (io) {
            bySender.forEach((ids, senderId) => {
                io.to(`user_${senderId}`).emit('messages_read', {
                    userId,
                    messageIds: ids,
                    timestamp: new Date().toISOString()
                });
            });
        }

        res.json({ success: true, modifiedCount: result?.modifiedCount || 0 });
    } catch (error: any) {
        console.error('❌ Erro ao marcar mensagens como lidas (batch):', error);
        res.status(500).json({ error: 'Erro interno ao marcar mensagens como lidas' });
    }
});

// DELETE /api/messages/:messageId - Apagar mensagem específica
router.delete('/:messageId', async (req, res) => {
    try {
        const { messageId } = req.params;
        const { userId } = req.query;

        if (!messageId) {
            return res.status(400).json({ error: 'messageId é obrigatório' });
        }

        const message = await ChatMessage.findOne({ id: messageId });

        if (!message) {
            return res.status(404).json({ error: 'Mensagem não encontrada' });
        }

        if (message.senderId !== userId && message.receiverId !== userId) {
            return res.status(403).json({ error: 'Sem permissão para apagar esta mensagem' });
        }

        const conversationId = message.conversationId || `chat_private_${[message.senderId, message.receiverId].sort().join('_')}`;
        const otherUserId = message.senderId === userId ? message.receiverId : message.senderId;

        await ChatMessage.deleteOne({ id: messageId });

        const io = req.app.get('io');
        if (io) {
            io.to(`user_${otherUserId}`).emit('message_deleted', {
                messageId,
                chatId: conversationId
            });
        }

        res.json({
            success: true,
            message: 'Mensagem apagada com sucesso'
        });

    } catch (error: any) {
        console.error('❌ Erro ao apagar mensagem:', error);
        res.status(500).json({ error: 'Erro interno ao apagar mensagem' });
    }
});

export default router;

