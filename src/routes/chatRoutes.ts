// @ts-nocheck
import express from 'express';
import { Chat, ChatMessage, User } from '../models/index';

const router = express.Router();

// GET /api/chats - Listar todos os chats do usuário
router.get('/', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId é obrigatório' });
        }

        console.log(`🔍 Buscando chats para usuário: ${userId}`);

        // Buscar chats onde o usuário participa
        const chats = await Chat.find({
            participants: userId,
            isActive: true
        }).sort({ 'lastMessage.timestamp': -1 });

        console.log(`📊 Encontrados ${chats.length} chats para usuário ${userId}`);

        // Para cada chat, buscar informações adicionais
        const chatsWithDetails = await Promise.all(
            chats.map(async (chat) => {
                // Buscar informações dos outros participantes
                const otherParticipants = chat.participants.filter((p: any) => p !== userId);
                const participantDetails = await User.find({
                    id: { $in: otherParticipants }
                }).select('id name avatarUrl');

                // Contar mensagens não lidas
                const unreadCount = await ChatMessage.countDocuments({
                    conversationId: chat.id,
                    receiverId: userId,
                    isRead: false
                });

                return {
                    id: chat.id,
                    type: chat.type,
                    title: chat.title,
                    participants: participantDetails,
                    lastMessage: chat.lastMessage,
                    unreadCount,
                    isActive: chat.isActive,
                    metadata: chat.metadata,
                    updatedAt: chat.updatedAt
                };
            })
        );

        res.json({
            success: true,
            data: chatsWithDetails,
            count: chatsWithDetails.length
        });

    } catch (error) {
        console.error('❌ Erro ao buscar chats:', error);
        res.status(500).json({
            error: 'Erro ao buscar chats',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});

// GET /api/chats/:id/messages - Buscar mensagens de um chat específico
router.get('/:id/messages', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, page = 1, limit = 50 } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId é obrigatório' });
        }

        console.log(`🔍 Buscando mensagens do chat ${id} para usuário ${userId}`);

        // Verificar se o usuário tem acesso ao chat
        const chat = await Chat.findOne({
            id,
            participants: userId,
            isActive: true
        });

        if (!chat) {
            return res.status(404).json({ error: 'Chat não encontrado ou sem permissão' });
        }

        // Buscar mensagens paginadas
        const skip = (Number(page) - 1) * Number(limit);

        const messages = await ChatMessage.find({
            conversationId: id
        })
            .sort({ sentAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        // Buscar detalhes dos remetentes
        const senderIds = [...new Set(messages.map((m: any) => m.senderId))];
        const senders = await User.find({
            id: { $in: senderIds }
        }).select('id name avatarUrl');

        const senderMap = senders.reduce((acc: any, sender) => {
            acc[sender.id] = sender;
            return acc;
        }, {});

        // Formatar mensagens com detalhes dos remetentes
        const formattedMessages = messages.map((message: any) => ({
            id: message.id,
            conversationId: message.conversationId,
            senderId: message.senderId,
            receiverId: message.receiverId,
            content: message.content,
            messageType: message.messageType,
            isRead: message.isRead,
            readAt: message.readAt,
            sentAt: message.sentAt,
            sender: senderMap[message.senderId] || { id: message.senderId, name: 'Usuário', avatarUrl: '' }
        })).reverse(); // Ordem cronológica (mais antiga primeiro)

        console.log(`📊 Encontradas ${formattedMessages.length} mensagens`);

        res.json({
            success: true,
            data: {
                messages: formattedMessages,
                chat: {
                    id: chat.id,
                    type: chat.type,
                    title: chat.title,
                    participants: chat.participants,
                    metadata: chat.metadata
                },
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total: formattedMessages.length,
                    hasMore: formattedMessages.length === Number(limit)
                }
            }
        });

    } catch (error) {
        console.error('❌ Erro ao buscar mensagens:', error);
        res.status(500).json({
            error: 'Erro ao buscar mensagens',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});

// POST /api/chats - Criar novo chat
router.post('/', async (req, res) => {
    try {
        const { participants, type = 'private', title } = req.body;

        if (!participants || participants.length < 2) {
            return res.status(400).json({ error: 'Pelo menos 2 participantes são necessários' });
        }

        // Verificar se já existe chat privado entre os mesmos participantes
        if (type === 'private' && participants.length === 2) {
            const existingChat = await Chat.findOne({
                participants: { $all: participants },
                type: 'private',
                isActive: true
            });

            if (existingChat) {
                return res.json({
                    success: true,
                    data: existingChat,
                    message: 'Chat já existe'
                });
            }
        }

        // Criar novo chat com upsert automático
        const chatId = `chat_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newChat = (await Chat.findOneAndUpdate(
            { id: chatId },
            {
                $set: {
                id: chatId,
                participants,
                type,
                title: type === 'group' ? title : undefined,
                isActive: true,
                metadata: type === 'group' ? { groupId: `group_${Date.now()}` } : {}
                }
            },
            { 
                upsert: true, // Criar se não existir
                new: true
            }
        ))!;

        // Persistir atividade de criação de chat para todos participantes
        await Promise.all(
            participants.map(async (participantId: string) => {
                await User.findOneAndUpdate(
                    { id: participantId },
                    { 
                        $push: { 
                            recentActivities: {
                                action: type === 'group' ? 'group_chat_created' : 'private_chat_created',
                                resource: 'chat',
                                timestamp: new Date(),
                                endpoint: '/api/chats'
                            }
                        }
                    }
                ).catch(console.error);
            })
        );

        console.log(`✅ Chat criado: ${newChat.id}`);

        res.status(201).json({
            success: true,
            data: newChat,
            message: 'Chat criado com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro ao criar chat:', error);
        res.status(500).json({
            error: 'Erro ao criar chat',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});

// POST /api/chats/send - Enviar mensagem (rota simplificada)
router.post('/send', async (req, res) => {
    try {
        const { from, to, text, imageUrl, tempId } = req.body;

        if (!from) {
            return res.status(400).json({ error: 'Campo "from" é obrigatório' });
        }
        
        if (!to) {
            return res.status(400).json({ error: 'Campo "to" é obrigatório' });
        }
        
        if (!text && !imageUrl) {
            return res.status(400).json({ error: 'Campo "text" ou "imageUrl" é obrigatório' });
        }

        if (text && text.length > 10000) {
            return res.status(400).json({ error: 'Texto muito longo (máximo 10.000 caracteres)' });
        }

        if (imageUrl && imageUrl.length > 50000) {            
            if (imageUrl.startsWith('data:image')) {
                return res.status(400).json({ 
                    error: 'Imagem muito grande para colar no chat. Use o botão de upload 📤 para enviar imagens corretamente.',
                    suggestion: 'Clique no botão de imagem ao lado do campo de texto para enviar arquivos.',
                    code: 'IMAGE_TOO_LARGE_PASTE'
                });
            } else {
                return res.status(400).json({ error: 'Imagem muito grande (máximo 50.000 caracteres)' });
            }
        }

        const conversationId = `chat_private_${[from, to].sort().join('_')}`;
        const messageType = imageUrl ? 'image' : 'text';
        const content = imageUrl || text;
        const messageId = tempId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const newMessage = (await ChatMessage.findOneAndUpdate(
            { id: messageId },
            {
                $set: {
                id: messageId,
                conversationId,
                senderId: from,
                receiverId: to,
                content: content,
                messageType,
                isRead: false,
                sentAt: new Date()
                }
            },
            { 
                upsert: true,
                new: true
            }
        ))!;

        User.findOneAndUpdate(
            { id: from },
            { 
                $push: { 
                    recentActivities: {
                        action: 'chat_message_sent',
                        resource: 'chat',
                        timestamp: new Date(),
                        endpoint: '/api/chats/send'
                    }
                }
            }
        ).catch(() => {});

        const frontendMessage = {
            id: newMessage.id,
            chatId: conversationId,
            from: newMessage.senderId,
            to: newMessage.receiverId,
            text: messageType !== 'image' ? (newMessage.content || '') : '',
            imageUrl: messageType === 'image' ? newMessage.content : undefined,
            timestamp: newMessage.sentAt?.toISOString() || new Date().toISOString(),
            status: 'sent',
        };

        const io = req.app.get('io');

        io.to(`user_${to}`).emit('newMessage', frontendMessage);

        io.to(`user_${to}`).emit('chat_notification', {
            type: 'new_message',
            from: from,
            message: messageType === 'image' ? '[Imagem]' : (text || ''),
            timestamp: new Date().toISOString(),
            conversationId
        });

        io.to(`user_${from}`).emit('message_sent', {
            tempId,
            messageId: newMessage.id,
            success: true
        });

        res.json({
            success: true,
            message: frontendMessage
        });

    } catch (error: any) {
        console.error('❌ Erro ao enviar mensagem:', error);
        res.status(500).json({
            error: 'Erro ao enviar mensagem',
            details: error.message
        });
    }
});

// POST /api/chats/:id/messages - Enviar nova mensagem
router.post('/:id/messages', async (req, res) => {
    try {
        const { id } = req.params;
        const { senderId, receiverId, content, messageType = 'text' } = req.body;

        if (!senderId || !content) {
            return res.status(400).json({ error: 'senderId e content são obrigatórios' });
        }

        // Verificar se o usuário tem acesso ao chat
        const chat = await Chat.findOne({
            id,
            participants: senderId,
            isActive: true
        });

        if (!chat) {
            return res.status(404).json({ error: 'Chat não encontrado ou sem permissão' });
        }

        // Criar nova mensagem com upsert automático
        const messageId = `msg_${id}_${senderId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newMessage = (await ChatMessage.findOneAndUpdate(
            { id: messageId },
            {
                $set: {
                id: messageId,
                conversationId: id,
                senderId,
                receiverId: receiverId || senderId, // Para grupos, usar o próprio senderId
                content,
                messageType,
                isRead: false,
                sentAt: new Date()
                }
            },
            { 
                upsert: true, // Criar se não existir
                new: true
            }
        ))!;

        // Atualizar última mensagem do chat
        await Chat.findOneAndUpdate(
            { id },
            {
                $set: {
                lastMessage: {
                    content: newMessage.content,
                    senderId: newMessage.senderId,
                    timestamp: newMessage.sentAt,
                    messageType: newMessage.messageType
                },
                updatedAt: new Date()
                }
            }
        );

        console.log(`✅ Mensagem enviada no chat ${id}: ${content.substring(0, 50)}...`);

        res.status(201).json({
            success: true,
            data: newMessage,
            message: 'Mensagem enviada com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro ao enviar mensagem:', error);
        res.status(500).json({
            error: 'Erro ao enviar mensagem',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});

// PUT /api/messages/:id/read - Marcar mensagem como lida
router.put('/messages/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId é obrigatório' });
        }

        // Verificar se a mensagem pertence ao usuário
        const message = await ChatMessage.findOne({
            id,
            receiverId: userId
        });

        if (!message) {
            return res.status(404).json({ error: 'Mensagem não encontrada' });
        }

        // Marcar como lida + persistir atividade
        await ChatMessage.findOneAndUpdate(
            { id },
            {
                $set: {
                isRead: true,
                readAt: new Date()
                }
            }
        );

        // Persistir atividade de leitura de mensagem
        await User.findOneAndUpdate(
            { id: userId },
            { 
                $push: { 
                    recentActivities: {
                        action: 'chat_message_read',
                        resource: 'chat',
                        timestamp: new Date(),
                        endpoint: '/api/messages/:id/read'
                    }
                }
            }
        ).catch(console.error);

        console.log(`✅ Mensagem ${id} marcada como lida`);

        res.json({
            success: true,
            message: 'Mensagem marcada como lida'
        });

    } catch (error) {
        console.error('❌ Erro ao marcar mensagem como lida:', error);
        res.status(500).json({
            error: 'Erro ao marcar mensagem como lida',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});

export default router;

