// @ts-nocheck
import express from 'express';
import { User, Streamer, Gift, GiftTransaction, Followers, UserStatus, Visitor, ChatMessage, Chat, Conversation, Friendship, Invitation, Message, Photo, UserPhoto, ProfilePhoto, UserVideo, LiveCard } from '../models';
import { pushRecentActivity } from '../utils/activityHelpers';
import { kickProtection } from '../middleware/appOwnerProtection';
import { getUserIdFromToken } from '../middleware/auth';
import { BeautyEffect } from '../models/BeautyEffect';
import { getIO } from '../socket';
const router = express.Router();

// Listar presentes enviados em uma live específica
router.get('/presents/live/:id', async (req, res) => {
    try {
        const { id: streamId } = req.params;
        const { limit = 50 } = req.query;
        
        // Verificar se o stream existe
        const stream = await Streamer.findOne({ id: streamId });
        if (!stream) {
            return res.status(404).json({ success: false, error: 'Stream não encontrado' });
        }
        
        // Buscar transações de presentes para esta live (de todos os usuários, incluindo o host)
        const gifts = await GiftTransaction.find({ 
            streamId: streamId,
            toUserId: stream.hostId // Apenas presentes enviados para o host
        })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit as string))
        .lean();
        
        // Agrupar por usuário para mostrar total de presentes por pessoa
        const usersGifts = gifts.reduce((acc: any, gift) => {
            const userId = gift.fromUserId;
            if (!acc[userId]) {
                acc[userId] = {
                    userId: gift.fromUserId,
                    userName: gift.fromUserName,
                    userAvatar: gift.fromUserAvatar,
                    gifts: [],
                    totalValue: 0,
                    totalDiamonds: 0
                };
            }
            
            acc[userId].gifts.push({
                id: gift.id,
                giftName: gift.giftName,
                giftIcon: gift.giftIcon,
                giftPrice: gift.giftPrice,
                quantity: gift.quantity,
                totalValue: gift.totalValue,
                timestamp: gift.createdAt
            });
            
            acc[userId].totalValue += gift.totalValue;
            acc[userId].totalDiamonds += gift.giftPrice * gift.quantity;
            
            return acc;
        }, {});

        // Também incluir usuários online (LiveUser) que não enviaram presentes
        try {
            const { LiveUser } = await import('../models/LiveInvite');
            const onlineUsers = await LiveUser.find({
                currentStreamId: streamId,
                status: { $in: ['viewing', 'co-host', 'pk-battle', 'broadcasting'] }
            }).lean();

            for (const lu of onlineUsers) {
                if (lu.userId && !usersGifts[lu.userId]) {
                    usersGifts[lu.userId] = {
                        userId: lu.userId,
                        userName: lu.name,
                        userAvatar: lu.avatarUrl || '',
                        gifts: [],
                        totalValue: 0,
                        totalDiamonds: 0
                    };
                }
            }
        } catch (err) {
            // Não crítico
        }
        
        const result = Object.values(usersGifts);
        
        console.log(`📋 [PRESENTS LIVE] ${gifts.length} presentes encontrados para stream ${streamId} do host ${stream.hostId} de ${result.length} usuários diferentes`);
        
        res.json({
            success: true,
            gifts: result,
            totalUsers: result.length,
            totalGifts: gifts.length,
            totalValue: result.reduce((sum: number, user: any) => sum + user.totalValue, 0)
        });
        
    } catch (error: any) {
        console.error('❌ Erro ao listar presentes da live:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/streams/:id/private-invite', async (req, res) => {
    try {
        const { id: streamId } = req.params;
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ success: false, error: 'User ID required' });
        }
        
        // Buscar stream e validar
        const stream = await Streamer.findOne({ id: streamId });
        if (!stream) {
            return res.status(404).json({ success: false, error: 'Stream not found' });
        }
        
        // Buscar usuário a ser convidado
        const userToInvite = await User.findOne({ id: userId });
        if (!userToInvite) {
            return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
        }
        
        console.log(`📝 [PRIVATE INVITE] Evento recebido: ${stream.hostId} convidando ${userId}`);

        // Persistir o convite no stream (controle de acesso para convidados)
        await Streamer.updateOne(
            { id: streamId },
            { $addToSet: { invitedUsers: userId } }
        );
        // 🔒 Espelhar o convite no LiveCard — a listagem de salas privadas
        // (categoria private) filtra por invitedUsers para só convidados verem.
        await LiveCard.updateOne(
            { $or: [{ hostId: streamId }, { streamKey: streamId }] },
            { $addToSet: { invitedUsers: userId } }
        ).catch(() => {});
        console.log(`💾 [PRIVATE INVITE] Usuário ${userId} adicionado aos convidados do stream ${streamId}`);

        // Persistir atividade de convite privado
        console.log(`📤 [PRIVATE INVITE] Enviando updates de atividades para o banco...`);
        await Promise.all([
            pushRecentActivity(stream.hostId, {
                action: 'private_invite_sent',
                resource: 'stream_interaction',
                endpoint: '/api/interactions/streams/:id/private-invite'
            }),
            pushRecentActivity(userId, {
                action: 'private_invite_received',
                resource: 'stream_interaction',
                endpoint: '/api/interactions/streams/:id/private-invite'
            })
        ]);

        console.log(`✅ [PRIVATE INVITE] Resposta MongoDB recebida. Atividades persistidas.`);

        // Enviar notificação de convite via WebSocket
        const io = req.app.get('io');
        if (io) {
            // Notificar o usuário convidado
            io.to(`user_${userId}`).emit('private_stream_invite', {
                streamId: streamId,
                streamName: stream.name,
                hostId: stream.hostId,
                hostName: stream.name,
                hostAvatar: stream.avatar || '',
                message: `Você foi convidado para a sala privada de ${stream.name}!`,
                timestamp: new Date().toISOString()
            });
            
            // Notificar o host sobre o convite enviado
            io.to(`user_${stream.hostId}`).emit('invite_sent', {
                userId: userId,
                userName: userToInvite.name,
                streamId: streamId,
                message: `Convite enviado para ${userToInvite.name}`,
                timestamp: new Date().toISOString()
            });
            
            console.log(`🎫 [PRIVATE INVITE] Notificações WebSocket enviadas.`);
        }

        // Notificação centralizada via NotificationService
        try {
            const { NotificationService } = await import('../services/NotificationService');
            await NotificationService.notifyPrivateStreamInvite(
                io,
                userId,
                stream.hostId,
                stream.name || 'Alguém',
                stream.avatar || '',
                streamId,
                stream.name || 'Transmissão',
            );
        } catch (notifErr) {
            console.error('[PRIVATE INVITE] Erro NotificationService:', notifErr);
        }
        
        res.json({ 
            success: true, 
            message: 'Convite enviado com sucesso',
            invitedUser: {
                id: userToInvite.id,
                name: userToInvite.name,
                avatarUrl: userToInvite.avatarUrl
            }
        });
        
    } catch (error: any) {
        console.error('❌ Erro ao enviar convite privado:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/streams/invited-streams', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.json({ success: true, streamIds: [] });
        }

        const invited = await Streamer.find({
            invitedUsers: userId,
            isLive: true
        }).select('id streamKey hostId').lean();

        const streamIds = Array.from(new Set(
            invited.map((s: any) => s.id || s.streamKey || s.hostId).filter(Boolean)
        ));

        console.log(`🔑 [INVITED STREAMS] ${streamIds.length} lives para o usuário ${userId}:`, streamIds);

        res.json({ success: true, streamIds });
    } catch (error: any) {
        console.error('❌ Erro ao listar lives convidadas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/streams/:id/access-check', async (req, res) => {
    try {
        const { id: streamId } = req.params;
        const { userId } = req.query;
        
        if (!userId) {
            return res.json({ canJoin: false, reason: 'User ID required' });
        }
        
        // Buscar stream e host
        const stream = await Streamer.findOne({ id: streamId });
        if (!stream) {
            return res.json({ canJoin: false, reason: 'Stream not found' });
        }
        
        // Se não for privada, pode entrar
        if (!stream.isPrivate) {
            return res.json({ canJoin: true });
        }
        
        // Buscar configurações de privacidade do host
        const host = await User.findOne({ id: stream.hostId });
        if (!host || !host.privateStreamSettings) {
            return res.json({ canJoin: false, reason: 'Host settings not found' });
        }
        
        const settings = host.privateStreamSettings;
        const requestingUser = userId;
        
        // Persistir atividade de verificação de acesso
        await pushRecentActivity(requestingUser, {
            action: 'stream_access_checked',
            resource: 'stream_interaction',
            endpoint: '/api/interactions/streams/:id/access-check'
        });

        console.log(`🔐 Checking access for user ${requestingUser} to stream ${streamId}`);
        console.log(`🔒 Stream settings:`, settings);
        
        let canJoin = false;
        let reason = '';
        
        // Verificar se é o próprio host
        if (requestingUser === stream.hostId) {
            canJoin = true;
        } else {
            const invitedUsers: string[] = Array.isArray(stream.invitedUsers) ? stream.invitedUsers : [];

            // 🔒 SE A STREAM É PRIVADA → SÓ ENTRA QUEM FOI CONVIDADO.
            // independentemente do setting privateInvite. O convite é OBRIGATÓRIO
            // para salas privadas.
            if (!invitedUsers.includes(requestingUser)) {
                canJoin = false;
                reason = 'Você precisa ser convidado para entrar nesta sala privada';
            } else {
                // Usuário está na lista de convidados — agora verifica as regras
                // adicionais do host (followersOnly, fansOnly, friendsOnly) se ativas.
                const followerCheck = settings.followersOnly
                    ? await Followers.findOne({
                        followerId: requestingUser,
                        followingId: stream.hostId,
                        isActive: true
                    })
                    : true;
                const fanCheck = settings.fansOnly
                    ? await Followers.findOne({
                        followerId: requestingUser,
                        followingId: stream.hostId,
                        isActive: true
                    })
                    : true;
                const friendCheck = settings.friendsOnly
                    ? await Friendship.findOne({
                        $or: [
                            { userId1: requestingUser, userId2: stream.hostId },
                            { userId1: stream.hostId, userId2: requestingUser }
                        ],
                        isActive: true
                    })
                    : true;

                canJoin = !!followerCheck && !!fanCheck && !!friendCheck;
                reason = canJoin ? '' : 'Você não atende aos critérios do criador para entrar nesta sala';
            }
        }
        
        console.log(`🔓 Access result for user ${requestingUser}: ${canJoin}, reason: ${reason}`);
        
        res.json({ canJoin, reason });
    } catch (error: any) {
        console.error('Error checking stream access:', error);
        res.status(500).json({ canJoin: false, reason: 'Server error' });
    }
});
// POST /api/interactions/friends/invite - Enviar convite de amizade
router.post('/friends/invite', async (req, res) => {
    try {
        const { fromUserId, toUserId, message } = req.body;
        
        if (!fromUserId || !toUserId) {
            return res.status(400).json({ error: 'fromUserId e toUserId são obrigatórios' });
        }
        
        if (fromUserId === toUserId) {
            return res.status(400).json({ error: 'Não pode enviar convite para si mesmo' });
        }
        
        // Verificar se usuários existem
        const [fromUser, toUser] = await Promise.all([
            User.findOne({ id: fromUserId }),
            User.findOne({ id: toUserId })
        ]);
        
        if (!fromUser || !toUser) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        // Verificar se já são amigos
        const existingFriendship = await require('../models').Friendship.findOne({
            $or: [
                { userId1: fromUserId, userId2: toUserId },
                { userId1: toUserId, userId2: fromUserId }
            ],
            isActive: true
        });
        
        if (existingFriendship) {
            return res.status(400).json({ error: 'Já são amigos' });
        }
        
        // Verificar se já existe convite pendente
        const existingInvite = await require('../models').Friendship.findOne({
            $or: [
                { userId1: fromUserId, userId2: toUserId },
                { userId1: toUserId, userId2: fromUserId }
            ],
            isActive: false // Convites pendentes
        });
        
        if (existingInvite) {
            return res.status(400).json({ error: 'Já existe um convite pendente' });
        }
        
        // Criar convite de amizade (inativo até ser aceito) + persistir atividade
        const invite = await require('../models').Friendship.create({
            id: `friend_invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId1: fromUserId,
            userId2: toUserId,
            initiatedBy: fromUserId,
            friendshipStartedAt: new Date(),
            isActive: false, // Pendente
            message: message || ''
        });

        // Persistir atividade de convite de amizade
        await Promise.all([
            pushRecentActivity(fromUserId, {
                action: 'friend_invite_sent',
                resource: 'social_interaction',
                endpoint: '/api/interactions/friends/invite'
            }),
            pushRecentActivity(toUserId, {
                action: 'friend_invite_received',
                resource: 'social_interaction',
                endpoint: '/api/interactions/friends/invite'
            })
        ]);
        
        // Notificar via WebSocket
        const io = getIO();
        if (io) {
            io.to(`user_${toUserId}`).emit('friend_invite_received', {
                inviteId: invite.id,
                fromUser: {
                    id: fromUser.id,
                    name: fromUser.name,
                    avatarUrl: fromUser.avatarUrl
                },
                message,
                timestamp: new Date()
            });
        }

        // === NOTIFICAR DESTINATÁRIO via serviço centralizado (sininho + FCM) ===
        try {
            const { NotificationService } = await import('../services/NotificationService');
            await NotificationService.notifyFriendInvite(
                io,
                toUserId,
                fromUserId,
                fromUser.name || 'Alguém',
                fromUser.avatarUrl || '',
                invite.id,
                message
            );
        } catch (notifErr) {
            console.warn('[FRIEND-INVITE-NOTIFICATION] Erro:', notifErr);
        }
        
        console.log(`📨 Convite de amizade enviado: ${fromUserId} → ${toUserId}`);
        
        res.json({
            success: true,
            invite,
            fromUser: {
                id: fromUser.id,
                name: fromUser.name,
                avatarUrl: fromUser.avatarUrl
            },
            toUser: {
                id: toUser.id,
                name: toUser.name,
                avatarUrl: toUser.avatarUrl
            }
        });
        
    } catch (error: any) {
        console.error('❌ Erro ao enviar convite de amizade:', error);
        res.status(500).json({ error: 'Erro interno ao enviar convite' });
    }
});

// POST /api/interactions/streams/:id/interactions - Registrar interação na stream
router.post('/streams/:id/interactions', async (req, res) => {
    try {
        const streamId = req.params.id;
        const { userId, type, data } = req.body;
        
        if (!userId || !type) {
            return res.status(400).json({ error: 'userId e type são obrigatórios' });
        }
        
        // Verificar se stream existe
        const stream = await Streamer.findOne({ id: streamId });
        if (!stream) {
            return res.status(404).json({ error: 'Stream não encontrada' });
        }
        
        // Verificar se usuário existe
        const user = await User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        // Registrar interação (poderia ser em uma coleção separada) + persistir atividade
        const interaction = {
            id: `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            streamId,
            userId,
            type, // 'like', 'share', 'comment', 'join', etc.
            data: data || {},
            timestamp: new Date()
        };

        console.log(`📝 [INTERACTION] Evento recebido: ${type} por ${userId} na stream ${streamId}`);

        // Persistir atividade de interação na stream
        console.log(`📤 [INTERACTION] Enviando update de atividades para o banco (User ${userId})...`);
        await pushRecentActivity(userId, {
            action: 'stream_interaction',
            resource: 'stream_interaction',
            endpoint: '/api/interactions/streams/:id/interactions'
        });

        console.log(`✅ [INTERACTION] Resposta MongoDB recebida. Atividades persistidas. Total: ${updateResult?.recentActivities?.length}`);
        
        // Notificar via WebSocket
        const io = getIO();
        if (io) {
            io.to(`stream_${streamId}`).emit('stream_interaction', {
                ...interaction,
                user: {
                    id: user.id,
                    name: user.name,
                    avatarUrl: user.avatarUrl
                }
            });
        }
        
        console.log(`🎯 Interação registrada e persistida com sucesso.`);
        
        res.json({
            success: true,
            interaction
        });
        
    } catch (error: any) {
        console.error('❌ Erro ao registrar interação:', error);
        res.status(500).json({ error: 'Erro interno ao registrar interação' });
    }
});

// POST /api/interactions/invitations/send - Enviar convite geral
router.post('/invitations/send', async (req, res) => {
    try {
        const { toUserId, type, message, data } = req.body;
        const fromUserId = getUserIdFromToken(req);
        
        if (!fromUserId || !toUserId || !type) {
            return res.status(400).json({ error: 'fromUserId, toUserId e type são obrigatórios' });
        }
        
        // Verificar se usuários existem
        const [fromUser, toUser] = await Promise.all([
            User.findOne({ id: fromUserId }),
            User.findOne({ id: toUserId })
        ]);
        
        if (!fromUser || !toUser) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        // Criar convite + persistir atividade
        const invitation = {
            id: `invitation_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            fromUserId,
            toUserId,
            type, // 'stream', 'friend', 'private_chat', etc.
            message: message || '',
            data: data || {},
            status: 'pending',
            createdAt: new Date()
        };

        // Persistir atividade de envio de convite
        await Promise.all([
            pushRecentActivity(fromUserId, {
                action: 'invitation_sent',
                resource: 'social_interaction',
                endpoint: '/api/interactions/invitations/send'
            }),
            pushRecentActivity(toUserId, {
                action: 'invitation_received',
                resource: 'social_interaction',
                endpoint: '/api/interactions/invitations/send'
            })
        ]);
        
        // Notificar via WebSocket
        const io = getIO();
        if (io) {
            io.to(`user_${toUserId}`).emit('invitation_received', {
                ...invitation,
                fromUser: {
                    id: fromUser.id,
                    name: fromUser.name,
                    avatarUrl: fromUser.avatarUrl
                }
            });
        }
        
        console.log(`📩 Convite enviado: ${type} de ${fromUserId} para ${toUserId}`);
        
        res.json({
            success: true,
            invitation
        });
        
    } catch (error: any) {
        console.error('❌ Erro ao enviar convite:', error);
        res.status(500).json({ error: 'Erro interno ao enviar convite' });
    }
});

// GET /api/interactions/invitations/received - Listar convites recebidos
router.get('/invitations/received', async (req, res) => {
    try {
        const { userId } = req.query;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId é obrigatório' });
        }
        
        console.log(`🔍 Buscando convites recebidos por: ${userId}`);
        
        // Buscar do banco de dados
        const invitations = await Invitation.find({ 
            toUserId: userId,
            status: 'pending'
        }).sort({ createdAt: -1 });

        // Enriquecer com dados do remetente
        const fromUserIds = [...new Set(invitations.map(i => i.fromUserId))];
        const fromUsers = await User.find({ id: { $in: fromUserIds } });
        const userMap = fromUsers.reduce((acc: Record<string, any>, user: any) => {
            acc[user.id] = user;
            return acc;
        }, {} as Record<string, any>);

        const enrichedInvitations = invitations.map((invitation: any) => ({
            ...invitation.toJSON(),
            fromUser: userMap[invitation.fromUserId] ? {
                id: userMap[invitation.fromUserId].id,
                name: userMap[invitation.fromUserId].name,
                avatarUrl: userMap[invitation.fromUserId].avatarUrl
            } : null
        }));
        
        res.json(enrichedInvitations);
        
    } catch (error: any) {
        console.error('❌ Erro ao buscar convites:', error);
        res.status(500).json({ error: 'Erro interno ao buscar convites' });
    }
});
router.get('/rooms/:id', async (req, res) => {
    // In a real scenario, this gets Room/Streamer by ID
    const room = await import('../models').then(m => m.Streamer).then(S => S.findOne({ id: req.params.id }));
    res.json(room || {});
});
router.post('/rooms/:id/join', async (req, res) => {
    // Basic permissions logic simulation
    res.json({ success: true, canJoin: true });
});
router.get('/rooms', async (req, res) => {
    const rooms = await import('../models').then(m => m.Streamer).then(S => S.find());
    res.json(rooms);
});

router.get('/streams/:id/messages', async (req, res) => {
    res.json(await Message.find({ chatId: req.params.id }).sort({ createdAt: 1 }));
});

router.get('/feed/photos', async (req, res) => {
    try {
        const { userId } = req.query;
        console.log('📸 [CONTENT FEED] Buscando conteúdo para o feed...', userId ? `para usuário: ${userId}` : 'todos os usuários');
        
        // Se userId for fornecido, filtrar apenas conteúdo desse usuário
        const userFilter = userId ? { userId } : {};
        
        // Buscar conteúdo de múltiplos modelos — apenas upload real de usuários
        // 📸 Fotos do PERFIL: mesma fonte da aba Obras (User.obras; se vazio,
        // cai para a galeria ProfilePhoto). ⚠️ User usa campo `id`, não `userId`.
        const userObrasFilter = userId ? { id: userId } : {};
        const [userPhotoFeed, videoFeed, usersWithObras] = await Promise.all([
            UserPhoto.find({ ...userFilter, isPublic: true }).sort({ postedAt: -1 }).limit(15).lean(),
            UserVideo.find({ ...userFilter, isPublic: true }).sort({ postedAt: -1 }).limit(15).lean(),
            User.find({ ...userObrasFilter }).select('id obras').limit(50).lean()
        ]);

        // Fallback: usuários SEM obras → usar galeria ProfilePhoto (igual à aba Obras)
        const emptyObrasIds = usersWithObras
            .filter((u: any) => !Array.isArray(u.obras) || u.obras.length === 0)
            .map((u: any) => u.id);
        const galleryFallback = emptyObrasIds.length > 0
            ? await ProfilePhoto.find({ userId: { $in: emptyObrasIds }, isActive: true, photoType: 'gallery' })
                .sort({ createdAt: -1 }).limit(30).lean()
            : [];

        const obrasFeed = usersWithObras.flatMap((u: any) =>
            (Array.isArray(u.obras) ? u.obras : []).filter((o: any) => o && o.url).map((o: any) => ({
                id: o.id,
                userId: u.id,
                photoUrl: o.url,
                likes: typeof o.likes === 'number' ? o.likes : 0,
                createdAt: o.createdAt || o.uploadedAt,
                postedAt: o.createdAt || o.uploadedAt
            }))
        ).concat(galleryFallback.map((p: any) => ({
            id: p.obraId || p._id,
            userId: p.userId,
            photoUrl: p.photoUrl,
            likes: typeof p.likes === 'number' ? p.likes : 0,
            createdAt: p.createdAt,
            postedAt: p.createdAt
        })));

        console.log(`📸 [CONTENT FEED] Encontrados: ${userPhotoFeed.length} UserPhoto, ${videoFeed.length} UserVideo, ${obrasFeed.length} Obras (fotos de perfil)`);

        // Combinar todos os feeds
        const allContent = [
            ...userPhotoFeed.map((p: any) => ({
                ...p,
                source: 'UserPhoto',
                contentType: 'photo',
                mediaUrl: p.photoUrl,
                thumbnailUrl: p.photoUrl
            })),
            ...videoFeed.map((v: any) => ({
                ...v,
                source: 'UserVideo',
                contentType: 'video',
                mediaUrl: v.videoUrl,
                thumbnailUrl: v.thumbnailUrl,
                duration: v.duration
            })),
            ...obrasFeed.map((p: any) => ({
                ...p,
                source: 'ProfilePhoto',
                contentType: 'photo',
                mediaUrl: p.photoUrl,
                thumbnailUrl: p.photoUrl
            }))
        ];

        // Ordenar por data (mais recentes primeiro)
        allContent.sort((a: any, b: any) => {
            const dateA = new Date(a.postedAt || a.createdAt).getTime();
            const dateB = new Date(b.postedAt || b.createdAt).getTime();
            return dateB - dateA;
        });

        // Limitar a 50 itens no total
        const limitedContent = allContent.slice(0, 50);

        if (limitedContent.length === 0) {
            console.log('📸 [CONTENT FEED] Nenhum conteúdo encontrado');
            return res.json([]);
        }

        // Extrair IDs de usuários únicos
        const userIds = [...new Set(limitedContent.map((p: any) => p.userId).filter(Boolean))];
        
        // Buscar dados dos usuários
        const users = await User.find({ id: { $in: userIds } }).lean();
        const userMap = users.reduce((acc: Record<string, any>, user: any) => {
            acc[user.id] = user;
            return acc;
        }, {} as Record<string, any>);

        // Filtrar apenas conteúdo com usuário válido no banco - sem dados fake
        const validContent = limitedContent.filter((content: any) => content.userId && userMap[content.userId]);

        // Mapear conteúdo com dados reais do usuário
        const contentWithUsers = validContent.map((content: any) => {
            const user = userMap[content.userId];

            return {
                id: content.id || content._id,
                contentType: content.contentType,
                mediaUrl: content.mediaUrl,
                thumbnailUrl: content.thumbnailUrl,
                caption: content.caption || content.description || '',
                likes: content.likes || 0,
                comments: content.comments || 0,
                postedAt: content.postedAt || content.createdAt,
                userId: content.userId,
                source: content.source,
                duration: content.duration,
                price: content.price,
                category: content.category,
                tags: content.tags || [],
                isPublic: content.isPublic !== undefined ? content.isPublic : true,
                user: {
                    id: user.id,
                    name: user.name || user.displayName,
                    displayName: user.displayName || user.name,
                    avatarUrl: user.avatarUrl || ''
                }
            };
        });

        console.log(`📸 [CONTENT FEED] Retornando ${contentWithUsers.length} itens com dados de usuários`);
        res.json(contentWithUsers);
    } catch (error: any) {
        console.error('❌ [CONTENT FEED] Erro:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/interactions/comments - Comentar em foto, vídeo ou perfil (com notificação)
router.post('/comments', async (req, res) => {
    try {
        const { userId, targetId, targetType, content } = req.body;

        if (!userId || !targetId || !targetType || !content) {
            return res.status(400).json({ error: 'userId, targetId, targetType e content são obrigatórios' });
        }

        const validTypes = ['photo', 'video', 'profile'];
        if (!validTypes.includes(targetType)) {
            return res.status(400).json({ error: 'targetType deve ser photo, video ou profile' });
        }

        // Buscar dados do comentarista
        const commenter = await User.findOne({ id: userId });
        if (!commenter) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Determinar o dono do conteúdo
        let contentOwnerId = '';

        if (targetType === 'photo') {
            const photo = await UserPhoto.findOne({ id: targetId });
            if (!photo) {
                return res.status(404).json({ error: 'Foto não encontrada' });
            }
            contentOwnerId = (photo as any).userId;
        } else if (targetType === 'video') {
            const video = await UserVideo.findOne({ id: targetId });
            if (!video) {
                return res.status(404).json({ error: 'Vídeo não encontrado' });
            }
            contentOwnerId = (video as any).userId;
        } else if (targetType === 'profile') {
            contentOwnerId = targetId;
        }

        // Criar comentário usando o Comment model com defaults
        const { Comment } = await import('../models/Comment');
        const comment = await Comment.create({
            userId,
            targetId,
            targetType,
            content,
            likes: 0,
            isActive: true,
            isEdited: false,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Incrementar contador de comentários no conteúdo
        if (targetType === 'photo') {
            await UserPhoto.updateOne({ id: targetId }, { $inc: { comments: 1 } }).catch(() => {});
        } else if (targetType === 'video') {
            await UserVideo.updateOne({ id: targetId }, { $inc: { comments: 1 } }).catch(() => {});
        }

        const io = req.app.get('io');

        // === NOTIFICAR DONO DO CONTEÚDO via serviço centralizado ===
        try {
            const { NotificationService } = await import('../services/NotificationService');
            await NotificationService.notifyCommentReceived(
                io,
                contentOwnerId,
                userId,
                (commenter as any).name || (commenter as any).displayName || 'Alguém',
                targetId,
                targetType as 'photo' | 'video' | 'post'
            );
        } catch (notifErr) {
            console.warn('[COMMENT-NOTIFICATION] Erro:', notifErr);
        }

        res.json({
            success: true,
            comment: {
                id: (comment as any)._id,
                userId,
                targetId,
                targetType,
                content,
                likes: 0,
                isActive: true,
                createdAt: new Date()
            }
        });

    } catch (error: any) {
        console.error('❌ [COMMENT] Erro:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/interactions/videos/:id/like - Curtir vídeo do feed (com notificação)
router.post('/videos/:id/like', async (req, res) => {
    try {
        const userId = req.body.userId || getUserIdFromToken(req);
        const videoId = req.params.id;

        if (!userId) {
            return res.status(400).json({ error: 'userId é obrigatório' });
        }

        // Buscar o vídeo
        const video = await UserVideo.findOne({ id: videoId });
        if (!video) {
            return res.status(404).json({ error: 'Vídeo não encontrado' });
        }

        // Incrementar curtidas usando o BD nativo (UserVideo usa BaseModel)
        const db = (await import('../config/db')).getDb();
        const collection = db.collection('uservideos');
        const { addVideoLike } = await import('../models/UserVideo');
        const updated = await addVideoLike(collection, videoId);

        const io = req.app.get('io');

        // Emitir WebSocket para atualização em tempo real
        if (io) {
            io.emit('video_updated', { videoId, userId, likes: updated?.likes || 0 });
        }

        // === NOTIFICAR DONO DO VÍDEO via serviço centralizado ===
        try {
            const { NotificationService } = await import('../services/NotificationService');
            await NotificationService.notifyVideoLiked(io, (video as any).userId, userId, videoId);
        } catch (notifErr) {
            console.warn('[VIDEO-LIKE-NOTIFICATION] Erro:', notifErr);
        }

        res.json({
            success: true,
            likes: updated?.likes || 0
        });

    } catch (error: any) {
        console.error('❌ [VIDEO-LIKE] Erro:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/interactions/videos/:id/like - Remover like de vídeo
router.delete('/videos/:id/like', async (req, res) => {
    try {
        const userId = req.body.userId || getUserIdFromToken(req);
        const videoId = req.params.id;

        if (!userId) {
            return res.status(400).json({ error: 'userId é obrigatório' });
        }

        // Verificar se o vídeo existe
        const video = await UserVideo.findOne({ id: videoId });
        if (!video) {
            return res.status(404).json({ error: 'Vídeo não encontrado' });
        }

        // Decrementar curtidas usando o BD nativo
        const db = (await import('../config/db')).getDb();
        const collection = db.collection('uservideos');
        const { removeVideoLike } = await import('../models/UserVideo');
        const updated = await removeVideoLike(collection, videoId);

        const io = req.app.get('io');

        // Emitir WebSocket para atualização em tempo real
        if (io) {
            io.emit('video_updated', { videoId, userId, likes: updated?.likes || 0 });
        }

        res.json({
            success: true,
            liked: false,
            likes: updated?.likes || 0
        });

    } catch (error: any) {
        console.error('❌ [VIDEO-UNLIKE] Erro:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/photos/:id/like', async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        const photoId = req.params.id;

        const photo = await Photo.findOne({ id: photoId });
        if (!photo) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        let newLikes = photo.likes || 0;
        let isLiked = false;

        // Simple toggle logic since we don't have a likes table yet
        // In a real scenario we would check `Like` collection mapping userId to photoId
        // We'll invert the provided value or assume a +1 action.
        if (req.body.action === 'unlike') {
            newLikes = Math.max(0, newLikes - 1);
            isLiked = false;
        } else {
            newLikes += 1;
            isLiked = true;
        }

        photo.likes = newLikes;
        await photo.save();

        // Persistir atividade de like/unlike na foto
        await pushRecentActivity(userId, {
            action: req.body.action === 'unlike' ? 'photo_unliked' : 'photo_liked',
            resource: 'content_interaction',
            endpoint: '/api/interactions/photos/:id/like'
        });

        res.json({ success: true, likes: newLikes, isLiked });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/photos/upload/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const { photoUrl, description, image } = req.body;

        // Aceita tanto 'photoUrl' quanto 'image' para compatibilidade
        const finalPhotoUrl = photoUrl || image;

        if (!userId || !finalPhotoUrl) {
            return res.status(400).json({ error: 'Missing userId or photoUrl/image' });
        }

        console.log(`📸 Upload de foto para chat - Usuário: ${userId}`);

        // Se for base64, converter para data URL completo
        let processedUrl = finalPhotoUrl;
        if (finalPhotoUrl.startsWith('/9j/') || finalPhotoUrl.startsWith('data:image/')) {
            // Se já for data URL, usar como está
            if (finalPhotoUrl.startsWith('data:image/')) {
                processedUrl = finalPhotoUrl;
            } else {
                // Se for apenas base64, adicionar prefixo
                processedUrl = `data:image/jpeg;base64,${finalPhotoUrl}`;
            }
        }

        const newPhoto = await Photo.create({
            id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            userId,
            url: processedUrl,
            caption: description || '',
            likes: 0,
            isLiked: false,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Persistir atividade de upload de foto
        await pushRecentActivity(userId, {
            action: 'photo_uploaded',
            resource: 'content_creation',
            endpoint: '/api/interactions/photos/upload/:id'
        });

        console.log('✅ Foto salva com URL:', processedUrl);

        // Retornar no formato esperado pelo frontend
        const savedPhoto = newPhoto as any;
        res.json({ 
            success: true, 
            url: savedPhoto.url,
            photo: {
                id: savedPhoto.id,
                url: savedPhoto.url
            }
        });
    } catch (error: any) {
        console.error('❌ Erro no upload de foto:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/visitors/list/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`🔍 Buscando visitantes do perfil: ${id}`);
        
        // Buscar visitantes do banco de dados com dados completos
        const visitors = await Visitor.find({ visitedId: id })
            .sort({ visitedAt: -1 })
            .limit(20);
        
        if (visitors.length === 0) {
            console.log(`📭 Nenhum visitante encontrado para ${id}`);
            return res.json([]);
        }

        // Buscar dados completos dos visitantes (por name OU id)
        const visitorIds = [...new Set(visitors.map(v => v.visitorId))];
        const users = await User.find({ $or: [
            { name: { $in: visitorIds } },
            { id: { $in: visitorIds } }
        ] });
        
        // Combinar dados de visitantes com informações dos usuários
        const visitorsWithDetails = visitors.map(visitor => {
            const visitorUser = users.find(u => u.id === visitor.visitorId || u.name === visitor.visitorId);
            const user = visitorUser || {} as any;
            return {
                id: user.id || visitor.visitorId,
                identification: user.identification || visitor.visitorId,
                name: user.name || visitor.visitorName || 'Unknown',
                avatarUrl: user.avatarUrl || visitor.visitorAvatar || '',
                avatar: user.avatar,
                coverUrl: user.coverUrl || '',
                level: user.level || 0,
                xp: user.xp || 0,
                rank: user.rank || 0,
                fans: user.fans || 0,
                following: user.following || 0,
                receptores: user.receptores || 0,
                enviados: user.enviados || 0,
                diamonds: user.diamonds || 0,
                earnings: user.earnings || 0,
                earnings_withdrawn: user.earnings_withdrawn || 0,
                isLive: user.isLive || false,
                isOnline: user.isOnline || false,
                lastSeen: user.lastSeen,
                currentStreamId: user.currentStreamId || '',
                isVIP: user.isVIP || false,
                isAvatarProtected: user.isAvatarProtected || false,
                activeFrameId: user.activeFrameId || null,
                ownedFrames: user.ownedFrames || [],
                bio: user.bio || '',
                country: user.country || '',
                age: user.age || 0,
                gender: user.gender || 'not_specified',
                city: user.city || '',
                state: user.state || '',
                visitTimestamp: visitor.visitedAt
            };
        });
        
        console.log(`📊 Encontrados ${visitorsWithDetails.length} visitantes para ${id}`);
        
        res.json(visitorsWithDetails);
    } catch (error) {
        console.error('❌ Erro ao buscar visitantes:', error);
        res.status(500).json({ error: 'Erro ao buscar visitantes' });
    }
});

router.post('/visitors/record', async (req, res) => {
    try {
        const { visitorId, visitedId } = req.body;
        
        if (!visitorId || !visitedId || visitorId === visitedId) {
            return res.status(400).json({ error: 'Invalid visitor data' });
        }

        // Atualizar ou criar registro de visita
        await Visitor.findOneAndUpdate(
            { visitorId, visitedId },
            { $set: { visitedAt: new Date() } },
            { upsert: true, returnDocument: 'after' }
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao registrar visita' });
    }
});
router.delete('/visitors/clear/:id', async (req, res) => res.json({ success: true }));
router.get('/chats/:id/messages', async (req, res) => {
    try {
        const otherUserId = req.params.id;
        const currentUserId = req.query.currentUserId as string || getUserIdFromToken(req);
        
        if (!currentUserId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const currentUser = { id: currentUserId };

        // Garantir que ambos os usuários existam
        const models = await import('../models');

        // Criar usuário de suporte se não existir
        if (otherUserId === 'support-livercore') {
            let supportUser = await models.User.findOne({ id: 'support-livercore' });
            if (!supportUser) {
                console.log('🔧 Criando usuário de suporte para chat');
                supportUser = await models.User.create({
                    id: 'support-livercore',
                    name: 'Support',
                    avatarUrl: '',
                    diamonds: 0,
                    level: 1,
                    xp: 0,
                    fans: 0,
                    following: 0,
                    isOnline: true,
                    lastSeen: new Date().toISOString()
                });
            }
        }

        // Criar chatKey consistente (ordem alfabética para garantir o mesmo chatId)
        const userIds = [currentUser.id, otherUserId].sort();
        const chatKey = `chat_${userIds[0]}_${userIds[1]}`;

        console.log(`🔍 Buscando mensagens para chatKey: ${chatKey}`);

        let messages = await Message.find({ chatId: chatKey }).sort({ createdAt: 1 });

        console.log(`📝 Encontradas ${messages.length} mensagens`);

        res.json(messages);
    } catch (error) {
        console.error('Erro ao buscar mensagens:', error);
        res.json([]); // Retornar array vazio em caso de erro
    }
});

// PUT /api/interactions/streams/:id/quality - Atualizar qualidade da transmissão
router.put('/streams/:id/quality', async (req, res) => {
    try {
        const { id: streamId } = req.params;
        const { quality, userId } = req.body;
        
        const { Streamer } = await import('../models');
        const stream = await Streamer.findOneAndUpdate(
            { id: streamId, hostId: userId },
            { $set: { quality: quality || 'HD' } },
            { returnDocument: 'after' }
        );
        
        if (!stream) {
            return res.status(404).json({ success: false, error: 'Stream not found' });
        }
        
        res.json({ success: true, stream });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/interactions/streams/:id/toggle-mic - Alternar microfone (mute/unmute)
router.post('/streams/:id/toggle-mic', async (req, res) => {
    try {
        const { id: streamId } = req.params;
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId é obrigatório' });
        }
        
        const { Streamer } = await import('../models');
        const stream = await Streamer.findOne({ id: streamId });
        if (!stream) {
            return res.status(404).json({ success: false, error: 'Stream not found' });
        }
        
        // Verificar se o usuário é host ou co-host
        const isHost = stream.hostId === userId;
        
        // Alternar estado do microfone
        const newMicState = !stream.microphoneEnabled;
        
        await Streamer.findOneAndUpdate(
            { id: streamId },
            { $set: { microphoneEnabled: newMicState } }
        );
        
        // Notificar todos na stream sobre mudança no microfone
        const io = req.app.get('io');
        if (io) {
            io.to(streamId).emit('mic_toggled', {
                streamId,
                userId,
                microphoneEnabled: newMicState,
                timestamp: new Date().toISOString()
            });
            console.log(`[MIC] Microfone ${newMicState ? 'ativado' : 'mutado'} por ${userId} na stream ${streamId}`);
        }
        
        res.json({
            success: true,
            microphoneEnabled: newMicState,
            message: `Microfone ${newMicState ? 'ativado' : 'mutado'} com sucesso`
        });
    } catch (error: any) {
        console.error('[TOGGLE-MIC] Erro:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/interactions/streams/:id/toggle-sound - Alternar som (áudio do stream)
router.post('/streams/:id/toggle-sound', async (req, res) => {
    try {
        const { id: streamId } = req.params;
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId é obrigatório' });
        }
        
        const { Streamer } = await import('../models');
        const stream = await Streamer.findOne({ id: streamId });
        if (!stream) {
            return res.status(404).json({ success: false, error: 'Stream not found' });
        }
        
        // Alternar estado do som
        const newSoundState = !stream.soundEnabled;
        
        await Streamer.findOneAndUpdate(
            { id: streamId },
            { $set: { soundEnabled: newSoundState } }
        );
        
        // Notificar todos na stream sobre mudança no som
        const io = req.app.get('io');
        if (io) {
            io.to(streamId).emit('sound_toggled', {
                streamId,
                userId,
                soundEnabled: newSoundState,
                timestamp: new Date().toISOString()
            });
            console.log(`[SOUND] Som ${newSoundState ? 'ativado' : 'silenciado'} por ${userId} na stream ${streamId}`);
        }
        
        res.json({
            success: true,
            soundEnabled: newSoundState,
            message: `Som ${newSoundState ? 'ativado' : 'silenciado'} com sucesso`
        });
    } catch (error: any) {
        console.error('[TOGGLE-SOUND] Erro:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/interactions/streams/:id/audio-status - Obter status de áudio atual
router.get('/streams/:id/audio-status', async (req, res) => {
    try {
        const { id: streamId } = req.params;
        const { Streamer } = await import('../models');
        const stream = await Streamer.findOne({ id: streamId }).select('microphoneEnabled soundEnabled').lean();
        
        if (!stream) {
            return res.status(404).json({ success: false, error: 'Stream not found' });
        }
        
        res.json({
            success: true,
            microphoneEnabled: (stream as any).microphoneEnabled !== false,
            soundEnabled: (stream as any).soundEnabled !== false
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/streams/:id/auto-follow', async (req, res) => res.json({}));
router.post('/streams/:id/toggle-auto-invite', async (req, res) => {
    try {
        const { id: streamId } = req.params;
        const { userId } = req.body; // ID do usuário que está fazendo a requisição
        
        console.log(`🔄 [TOGGLE_AUTO_INVITE] Stream: ${streamId}, User: ${userId}`);
        
        // 1. Validar se o stream existe
        const streamer = await Streamer.findOne({ id: streamId });
        if (!streamer) {
            console.log(`❌ [TOGGLE_AUTO_INVITE] Stream não encontrado: ${streamId}`);
            return res.status(404).json({ 
                success: false, 
                error: 'Stream não encontrado' 
            });
        }
        
        // 2. Validar se o usuário é o host do stream
        if (streamer.hostId !== userId) {
            console.log(`❌ [TOGGLE_AUTO_INVITE] Usuário não é host: ${userId} != ${streamer.hostId}`);
            return res.status(403).json({ 
                success: false, 
                error: 'Apenas o host pode alterar esta configuração' 
            });
        }
        
        // 3. Alternar o status do auto-convite
        const novoStatus = !streamer.isAutoPrivateInviteEnabled;
        
        await Streamer.updateOne(
            { id: streamId },
            { $set: { isAutoPrivateInviteEnabled: novoStatus } }
        );
        
        console.log(`✅ [TOGGLE_AUTO_INVITE] Status atualizado: ${novoStatus}`);
        
        // 4. Enviar evento WebSocket para atualizar frontend
        const io = req.app.get('io');
        if (io) {
            io.emit(`stream_${streamId}_auto_invite_toggled`, {
                enabled: novoStatus,
                streamId,
                userId
            });
            console.log(`📡 [TOGGLE_AUTO_INVITE] Evento WebSocket emitido para stream_${streamId}`);
        }
        
        res.json({ 
            success: true, 
            message: `Auto-convite ${novoStatus ? 'ativado' : 'desativado'} com sucesso`,
            streamId,
            enabled: novoStatus
        });
        
    } catch (error) {
        console.error('❌ [TOGGLE_AUTO_INVITE] Erro:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao atualizar auto-convite' 
        });
    }
});

const avatarFrames: Record<string, { price: number, durationDays: number, name: string }> = {
    'Frame20275': { price: 500, durationDays: 30, name: 'Primavera' },
    'FrameBlueCrystal': { price: 500, durationDays: 7, name: 'Blue Crystal' },
    'FrameRoseGarden': { price: 750, durationDays: 7, name: 'Rose Garden' },
    'FrameCopperPearls': { price: 1000, durationDays: 14, name: 'Copper Pearls' },
    'FrameOrnateMagenta': { price: 1250, durationDays: 14, name: 'Ornate Magenta' },
    'FrameNeonFeathers': { price: 1500, durationDays: 30, name: 'Neon Feathers' },
    'FrameBaroqueElegance': { price: 2000, durationDays: 30, name: 'Baroque Elegance' },
    'FrameMysticalWings': { price: 1800, durationDays: 30, name: 'Mystical Wings' },
    'FrameCosmicFire': { price: 2200, durationDays: 30, name: 'Cosmic Fire' },
    'FrameCelestialCrown': { price: 2500, durationDays: 30, name: 'Celestial Crown' }
};

// GET /api/effects/frames - Buscar frames disponíveis
router.get('/effects/frames', async (req, res) => {
    try {
        const framesWithDetails = Object.entries(avatarFrames).map(([id, data]) => ({
            id,
            name: data.name,
            price: data.price,
            duration: data.durationDays
        }));
        res.json(framesWithDetails);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch frames' });
    }
});

router.post('/effects/purchase-frame/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const { frameId } = req.body;

        const user = await User.findOne({ id: userId });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const frameData = avatarFrames[frameId];
        if (!frameData) return res.status(400).json({ error: 'Invalid frame ID' });

        if (user.diamonds < frameData.price) {
            return res.status(400).json({ error: 'Insufficient diamonds' });
        }

        // Deduct diamonds
        user.diamonds -= frameData.price;

        // Add or update frame in inventory
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + frameData.durationDays);

        const existingFrameIndex = user.ownedFrames.findIndex((f: { frameId: string; expirationDate: string }) => f.frameId === frameId);
        if (existingFrameIndex >= 0) {
            user.ownedFrames[existingFrameIndex].expirationDate = expirationDate.toISOString();
        } else {
            user.ownedFrames.push({ frameId, expirationDate: expirationDate.toISOString() });
        }

        await user.save();
        res.json({ success: true, user });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/effects/purchase/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const { giftId } = req.body; // Actually gift name is passed here from api.ts

        const user = await User.findOne({ id: userId });
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Fetch real gift data if possible, for now we will hardcode a standard effect price or assume the frontend validated it.
        // In a real scenario we must validate against the Gift collection.
        const gift = await import('../models').then(m => m.Gift).then(G => G.findOne({ name: giftId }));
        const price = gift ? (gift.price || 0) : 500; // fallback price

        if (user.diamonds < price) {
            return res.status(400).json({ error: 'Insufficient diamonds' });
        }

        user.diamonds -= price;
        await user.save();
        res.json({ success: true, user });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/vip/subscribe/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findOne({ id: userId });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const VIP_PRICE = 3000;
        if (user.diamonds < VIP_PRICE) {
            return res.status(400).json({ error: 'Insufficient diamonds for VIP' });
        }

        user.diamonds -= VIP_PRICE;
        user.isVIP = true;
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + 30);
        user.vipExpirationDate = expDate.toISOString();

        await user.save();
        res.json({ success: true, user });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/chats/mark-read', async (req, res) => res.json({}));
// REMOVIDO: router.post('/chats/send') - já existe em chatRoutes.ts
router.post('/streams/:id/kick', kickProtection, async (req, res) => {
    try {
        const { userId, kickerId } = req.body;
        const streamId = req.params.id;

        console.log(`👢 [KICK] Tentativa de expulsar usuário ${userId} da stream ${streamId} por ${kickerId}`);

        // 🔐 PROTEÇÃO DO DONO DO APLICATIVO - NINGUÉM PODE EXPULSAR O DONO
        const APP_OWNER_ID = '65384127'; // ID do dono do aplicativo
        
        if (userId === APP_OWNER_ID) {
            console.log(`🛡️ [PROTECTION] TENTATIVA BLOQUEADA: Usuário ${userId} é o DONO do aplicativo e não pode ser expulso!`);
            return res.status(403).json({ 
                success: false, 
                error: 'PROIBIDO: Este usuário não pode ser expulso do aplicativo',
                protection: 'APP_OWNER_PROTECTED'
            });
        }

        // Verificar se o usuário que está tentando expulsar existe
        const { User } = await import('../models');
        const kicker = await User.findOne({ id: kickerId });
        if (!kicker) {
            return res.status(404).json({ success: false, error: 'Usuário que tentou expulsar não encontrado' });
        }

        // 🔐 PROTEÇÃO ADICIONAL: Dono também não pode ser expulso por tentativa de outro ID
        if (kickerId === APP_OWNER_ID) {
            console.log(`👑 [OWNER] Dono do aplicativo (${kickerId}) tentou expulsar usuário ${userId} - permitido`);
        }

        // Verificar se o stream existe
        const { Streamer } = await import('../models');
        const stream = await Streamer.findOne({ id: streamId });
        if (!stream) {
            return res.status(404).json({ success: false, error: 'Stream não encontrada' });
        }

        // 🔐 PROTEÇÃO DO HOST: Dono do stream não pode ser expulso da própria stream
        if (userId === stream.hostId) {
            console.log(`🛡️ [HOST_PROTECTION] Usuário ${userId} é o HOST da stream ${streamId} e não pode ser expulso`);
            return res.status(403).json({ 
                success: false, 
                error: 'PROIBIDO: O host da transmissão não pode ser expulso',
                protection: 'HOST_PROTECTED'
            });
        }

        // 🔐 REGRA: APENAS O HOST DA TRANSMISSÃO (ou o dono do app) pode expulsar
        if (kickerId !== APP_OWNER_ID && String(kickerId) !== String(stream.hostId)) {
            return res.status(403).json({
                success: false,
                error: 'Apenas o apresentador pode expulsar espectadores',
                protection: 'HOST_ONLY_KICK'
            });
        }

        // 👢 Expulsão PERSISTENTE na sessão atual da live:
        // o usuário é adicionado a kickedUsers → se tentar entrar de novo,
        // é expulso automaticamente. A lista só é limpa quando a host
        // ENCERRA e abre uma NOVA transmissão.
        await Streamer.updateOne(
            { id: streamId },
            { $addToSet: { kickedUsers: String(userId) } }
        );

        // Emitir WebSocket para notificar o kick
        const io = req.app.get('io');
        if (io) {
            io.to(streamId).emit('user_kicked', {
                userId,
                kickerId,
                streamId,
                timestamp: new Date().toISOString()
            });
            // Notificar o usuário expulso individualmente (padrão Tencent LiveListListener)
            io.to(`user_${userId}`).emit('kicked_out', {
                streamId,
                kickerId,
                reason: 'Você foi removido da transmissão pelo apresentador.',
                timestamp: new Date().toISOString()
            });
        }

        res.json({ 
            success: true, 
            message: `Usuário ${userId} expulso da stream ${streamId}`,
            protection: 'NONE'
        });

    } catch (error: any) {
        console.error('❌ [KICK] Erro ao processar expulsão:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/streams/:id/moderator', async (req, res) => res.json({}));
router.get('/notifications', async (req, res) => res.json([]));
router.patch('/notifications/:id/read', async (req, res) => res.json({ success: true }));

// GET /api/interactions/effects/beauty - Buscar efeitos de beleza
router.get('/effects/beauty', async (req, res) => {
    try {
        console.log('🔍 [BEAUTY_API] Requisição recebida para /effects/beauty');
        console.log('📋 [BEAUTY_API] Headers:', req.headers);
        console.log('🌐 [BEAUTY_API] IP:', req.ip);
        
        // Buscar tudo ordenado pelo sort_order
        const allEffects = await BeautyEffect.find({}).sort({ sort_order: 1 });
        
        // Separa os filtros (Aba Recomendar)
        const filters = allEffects
            .filter((e: any) => e.type === 'filter')
            .map((e: any) => ({ name: e.name, icon: e.icon, img: e.img }));
            
        // Separa os efeitos (Aba Beleza)
        const effects = allEffects
            .filter((e: any) => e.type === 'effect')
            .map((e: any) => ({ name: e.name, icon: e.icon, img: e.img }));
        
        console.log(`✅ [BEAUTY_API] Encontrados ${filters.length} filters e ${effects.length} effects`);
        console.log('📦 [BEAUTY_API] Filters:', filters);
        console.log('📦 [BEAUTY_API] Effects:', effects);
        
        // ⚠️ O FRONT-END ESPERA EXATAMENTE ESTA ESTRUTURA DE RETORNO:
        const responseData = {
            data: {
                filters: filters,
                effects: effects
            }
        };
        
        console.log('📤 [BEAUTY_API] Enviando resposta:', responseData);
        res.json(responseData);
        
    } catch (error: any) {
        console.error('❌ [BEAUTY_API] Erro ao buscar efeitos de beleza:', error);
        res.status(500).json({ error: 'Erro ao buscar efeitos de beleza' });
    }
});

export default router;

