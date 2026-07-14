"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const express_1 = __importDefault(require("express"));
const models_1 = require("../models");
const router = express_1.default.Router();
router.get('/categories', async (req, res) => {
    const categories = [
        { key: 'popular', label: 'Popular' },
        { key: 'followed', label: 'Seguido' },
        { key: 'nearby', label: 'Perto' },
        { key: 'pk', label: 'PK' },
        { key: 'new', label: 'Novo' },
        { key: 'music', label: 'Música' },
        { key: 'dance', label: 'Dança' },
        { key: 'party', label: 'Festa' },
        { key: 'private', label: 'Privado' }
    ];
    res.json(categories);
});
router.get('/gifts', async (req, res) => {
    res.json(await models_1.Gift.find());
});
router.get('/gifts/category/:category', async (req, res) => {
    try {
        const category = req.params.category;
        const token = req.headers.authorization?.replace('Bearer ', '');
        // Persistir atividade de consulta de categoria de presentes (se usuário autenticado)
        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_prod';
                const decoded = jwt.verify(token, JWT_SECRET);
                const userId = decoded.id;
                if (userId) {
                    await models_1.User.findOneAndUpdate({ id: userId }, {
                        $push: {
                            recentActivities: {
                                action: 'gift_category_viewed',
                                resource: 'gift_metadata',
                                timestamp: new Date(),
                                endpoint: '/api/metadata/gifts/category/:category'
                            }
                        }
                    }).catch(console.error);
                }
            }
            catch {
                // Token inválido, ignorar persistência
            }
        }
        console.log(`🔍 Buscando presentes da categoria: ${category}`);
        // Buscar presentes por categoria no banco de dados
        const gifts = await models_1.Gift.find({ category: category });
        console.log(`✅ Encontrados ${gifts.length} presentes na categoria ${category}`);
        res.json(gifts);
    }
    catch (error) {
        console.error('❌ Erro ao buscar presentes por categoria:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/gifts/received/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        // Persistir atividade de consulta de presentes recebidos
        await models_1.User.findOneAndUpdate({ id: userId }, {
            $push: {
                recentActivities: {
                    action: 'received_gifts_viewed',
                    resource: 'gift_metadata',
                    timestamp: new Date(),
                    endpoint: '/api/metadata/gifts/received/:userId'
                }
            }
        }).catch(console.error);
        console.log(`🔍 Buscando presentes recebidos pelo usuário: ${userId}`);
        // Buscar todas as transações de presentes recebidas pelo usuário
        const transactions = await models_1.GiftTransaction.find({ toUserId: userId });
        // Agrupar por presente e contar quantidades
        const giftsMap = new Map();
        transactions.forEach((transaction) => {
            const giftKey = transaction.giftName;
            if (giftsMap.has(giftKey)) {
                const existing = giftsMap.get(giftKey);
                existing.count += transaction.quantity;
            }
            else {
                giftsMap.set(giftKey, {
                    name: transaction.giftName,
                    icon: transaction.giftIcon,
                    price: transaction.giftPrice,
                    count: transaction.quantity,
                    category: 'Galeria', // Todos os presentes recebidos ficam na galeria
                    component: null,
                    fromUsers: [transaction.fromUserName]
                });
            }
        });
        const receivedGifts = Array.from(giftsMap.values());
        console.log(`✅ Encontrados ${receivedGifts.length} tipos de presentes recebidos`);
        res.json(receivedGifts);
    }
    catch (error) {
        console.error('❌ Erro ao buscar presentes recebidos:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/regions', async (req, res) => {
    try {
        // Lista completa de países com bandeiras, códigos e URL das bandeiras
        const regions = [
            { name: 'Global', code: 'all', flagUrl: '' },
            { name: 'Brasil', code: 'br', flagUrl: 'https://flagcdn.com/w40/br.png', emoji: '🇧🇷' },
            { name: 'Estados Unidos', code: 'us', flagUrl: 'https://flagcdn.com/w40/us.png', emoji: '🇺🇸' },
            { name: 'Portugal', code: 'pt', flagUrl: 'https://flagcdn.com/w40/pt.png', emoji: '🇵🇹' },
            { name: 'Argentina', code: 'ar', flagUrl: 'https://flagcdn.com/w40/ar.png', emoji: '🇦🇷' },
            { name: 'México', code: 'mx', flagUrl: 'https://flagcdn.com/w40/mx.png', emoji: '🇲🇽' },
            { name: 'Colômbia', code: 'co', flagUrl: 'https://flagcdn.com/w40/co.png', emoji: '🇨🇴' },
            { name: 'Chile', code: 'cl', flagUrl: 'https://flagcdn.com/w40/cl.png', emoji: '🇨🇱' },
            { name: 'Peru', code: 'pe', flagUrl: 'https://flagcdn.com/w40/pe.png', emoji: '🇵🇪' },
            { name: 'Venezuela', code: 've', flagUrl: 'https://flagcdn.com/w40/ve.png', emoji: '🇻🇪' },
            { name: 'Espanha', code: 'es', flagUrl: 'https://flagcdn.com/w40/es.png', emoji: '🇪🇸' },
            { name: 'Itália', code: 'it', flagUrl: 'https://flagcdn.com/w40/it.png', emoji: '🇮🇹' },
            { name: 'França', code: 'fr', flagUrl: 'https://flagcdn.com/w40/fr.png', emoji: '🇫🇷' },
            { name: 'Alemanha', code: 'de', flagUrl: 'https://flagcdn.com/w40/de.png', emoji: '🇩🇪' },
            { name: 'Reino Unido', code: 'gb', flagUrl: 'https://flagcdn.com/w40/gb.png', emoji: '🇬🇧' },
            { name: 'Canadá', code: 'ca', flagUrl: 'https://flagcdn.com/w40/ca.png', emoji: '🇨🇦' },
            { name: 'Japão', code: 'jp', flagUrl: 'https://flagcdn.com/w40/jp.png', emoji: '🇯🇵' },
            { name: 'Coreia do Sul', code: 'kr', flagUrl: 'https://flagcdn.com/w40/kr.png', emoji: '🇰🇷' },
            { name: 'Índia', code: 'in', flagUrl: 'https://flagcdn.com/w40/in.png', emoji: '🇮🇳' },
            { name: 'Angola', code: 'ao', flagUrl: 'https://flagcdn.com/w40/ao.png', emoji: '🇦🇴' },
            { name: 'Moçambique', code: 'mz', flagUrl: 'https://flagcdn.com/w40/mz.png', emoji: '🇲🇿' },
            { name: 'Cabo Verde', code: 'cv', flagUrl: 'https://flagcdn.com/w40/cv.png', emoji: '🇨🇻' },
        ];
        // Adicionar contagem de lives ao vivo por região
        const { LiveCard } = await Promise.resolve().then(() => __importStar(require('../models/index')));
        const regionsWithCount = await Promise.all(regions.map(async (region) => {
            if (region.code === 'all') {
                const count = await LiveCard.countDocuments({
                    isLive: true,
                    streamStatus: { $in: ['active', 'live'] }
                }).catch(() => 0);
                return { ...region, liveCount: count };
            }
            const count = await LiveCard.countDocuments({
                country: region.code,
                isLive: true,
                streamStatus: { $in: ['active', 'live'] }
            }).catch(() => models_1.Streamer.countDocuments({
                country: region.code,
                isLive: true
            }).catch(() => 0));
            return { ...region, liveCount: count };
        }));
        // Ordenar: primeiro países com mais lives ativas, depois Global no início
        const sorted = regionsWithCount.sort((a, b) => {
            if (a.code === 'all')
                return -1;
            if (b.code === 'all')
                return 1;
            return (b.liveCount || 0) - (a.liveCount || 0);
        });
        res.json({
            success: true,
            data: sorted,
            total: sorted.length,
            totalLives: sorted.find(r => r.code === 'all')?.liveCount || 0
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// POST /api/feed/photos - Upload de foto no feed
router.post('/feed/photos', async (req, res) => {
    try {
        const { userId, photoUrl, caption, tags, isPublic = true } = req.body;
        if (!userId || !photoUrl) {
            return res.status(400).json({ error: 'userId e photoUrl são obrigatórios' });
        }
        // Verificar se usuário existe
        const user = await models_1.User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        // Criar registro da foto no feed (UserPhoto) + persistir atividade
        const photo = await models_1.UserPhoto.create({
            id: `feed_photo_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            userId,
            photoUrl,
            caption: caption || '',
            tags: tags || [],
            isPublic,
            likes: 0,
            comments: 0,
            postedAt: new Date()
        });
        // Persistir atividade de upload no feed
        await models_1.User.findOneAndUpdate({ id: userId }, {
            $push: {
                recentActivities: {
                    action: 'feed_photo_uploaded',
                    resource: 'feed_content',
                    timestamp: new Date(),
                    endpoint: '/api/metadata/feed/photos'
                }
            }
        }).catch(console.error);
        // Notificar via WebSocket
        const io = req.app.get('io');
        if (io) {
            io.emit('new_feed_photo', {
                photoId: photo.id,
                userId,
                userName: user.name,
                userAvatar: user.avatarUrl,
                photoUrl,
                caption,
                timestamp: new Date()
            });
        }
        console.log(`📸 Foto adicionada ao feed por ${userId}: ${photo.id}`);
        res.json({
            success: true,
            photo: {
                id: photo.id,
                userId: photo.userId,
                photoUrl: photo.photoUrl,
                caption: photo.caption,
                tags: photo.tags,
                isPublic: photo.isPublic,
                likes: photo.likes,
                comments: photo.comments,
                createdAt: photo.createdAt
            },
            user: {
                id: user.id,
                name: user.name,
                avatarUrl: user.avatarUrl
            }
        });
    }
    catch (error) {
        console.error('❌ Erro ao adicionar foto ao feed:', error);
        res.status(500).json({ error: 'Erro interno ao adicionar foto ao feed' });
    }
});
router.get('/reminders', async (req, res) => {
    try {
        // Reminders são usuários que estão ao vivo e seguidos pelo usuário atual
        const token = req.headers.authorization?.replace('Bearer ', '');
        let userId = null;
        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_prod';
                const decoded = jwt.verify(token, JWT_SECRET);
                userId = decoded.id;
            }
            catch {
                // Token inválido
            }
        }
        // Se não houver usuário logado ou se não seguir ninguém, retornar usuários ao vivo aleatórios
        if (!userId) {
            const liveUsers = await models_1.User.find({ isLive: true }).limit(10);
            return res.json(liveUsers);
        }
        // Buscar usuários que o usuário atual segue e que estão ao vivo
        const currentUser = await models_1.User.findOne({ id: userId });
        if (!currentUser || !currentUser.followingList || currentUser.followingList.length === 0) {
            const liveUsers = await models_1.User.find({ isLive: true }).limit(10);
            return res.json(liveUsers);
        }
        const followedLiveUsers = await models_1.User.find({
            id: { $in: currentUser.followingList },
            isLive: true
        }).limit(10);
        res.json(followedLiveUsers);
    }
    catch (error) {
        console.error('Error getting reminders:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/ranking/:period', async (req, res) => {
    try {
        const period = req.params.period;
        const token = req.headers.authorization?.replace('Bearer ', '');
        // Persistir atividade de consulta de ranking (se usuário autenticado)
        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_prod';
                const decoded = jwt.verify(token, JWT_SECRET);
                const userId = decoded.id;
                if (userId) {
                    await models_1.User.findOneAndUpdate({ id: userId }, {
                        $push: {
                            recentActivities: {
                                action: 'ranking_viewed',
                                resource: 'ranking_metadata',
                                timestamp: new Date(),
                                endpoint: '/api/metadata/ranking/:period'
                            }
                        }
                    }).catch(console.error);
                }
            }
            catch {
                // Token inválido, ignorar persistência
            }
        }
        console.log('🏆 Buscando ranking real para período:', period);
        // Para ranking "Ao vivo", usar dados da sessão atual
        if (period === 'live' || period === 'Ao vivo') {
            // Buscar streams ativos e suas sessões
            const activeStreams = await models_1.Streamer.find({ isLive: true });
            if (!activeStreams || activeStreams.length === 0) {
                console.log('ℹ️ Nenhuma stream ativa encontrada');
                return res.json([]);
            }
            // Para cada stream ativa, buscar dados da sessão
            const liveRanking = [];
            for (const stream of activeStreams) {
                const session = await models_1.StreamSession.findOne({ streamId: stream.id });
                if (session && session.giftsReceived > 0) {
                    // Buscar dados do streamer
                    const streamer = await models_1.User.findOne({ id: stream.hostId });
                    if (streamer) {
                        const streamerObj = streamer.toObject ? streamer.toObject() : streamer;
                        liveRanking.push({
                            ...streamerObj,
                            contribution: session.giftsReceived, // Presentes recebidos na live atual
                            streamId: stream.id,
                            streamTitle: stream.message, // Usar message em vez de title
                            viewers: session.viewers || 0,
                            rank: liveRanking.length + 1
                        });
                    }
                }
            }
            // Ordenar por número de presentes recebidos
            liveRanking.sort((a, b) => b.contribution - a.contribution);
            console.log(`✅ ${liveRanking.length} streamers no ranking Ao vivo`);
            return res.json(liveRanking);
        }
        // 🔧 CORREÇÃO: Para outros períodos, usar contadores atuais em vez de transações
        // Após saque, os contadores devem estar zerados
        console.log('📊 [RANKING] Buscando ranking por períodos usando contadores atuais:', period);
        // Buscar todos os usuários que têm contadores > 0
        const users = await models_1.User.find({
            $or: [
                { receptores: { $gt: 0 } },
                { diamonds: { $gt: 0 } }
            ]
        });
        console.log(`👤 [RANKING] Encontrados ${users.length} usuários com contadores`);
        // Para cada usuário, verificar se tem contadores > 0
        const validUsers = users.map(user => {
            const userObj = user.toObject ? user.toObject() : user;
            // Usar receptores para ranking (diamantes recebidos) - contador principal
            let contribution = user.receptores || 0;
            // Se for ranking diário/semanal/mensal, verificar se tem contadores recentes
            // Se os contadores estiverem zerados (pós-saque), contribution será 0
            if (contribution === 0) {
                // Se receptores está zerado, não aparece no ranking
                return null;
            }
            return {
                ...userObj,
                contribution: contribution,
                rank: 0, // Será atribuído após ordenação
                period: period,
                debug: {
                    diamonds: user.diamonds || 0,
                    receptores: user.receptores || 0,
                    enviados: user.enviados || 0,
                    source: 'counters' // Indica que usa contadores, não transações
                }
            };
        }).filter(user => user !== null && user.contribution > 0);
        // Ordenar por contribution (maior para menor)
        validUsers.sort((a, b) => (b?.contribution || 0) - (a?.contribution || 0));
        // Atribuir ranks
        validUsers.forEach((user, index) => {
            if (user) {
                user.rank = index + 1;
            }
        });
        console.log(`✅ ${validUsers.length} usuários no ranking ${period} (contadores atuais)`);
        if (validUsers.length > 0) {
            console.log(`📊 [RANKING] Top 3 do período:`);
            validUsers.slice(0, 3).forEach((user, index) => {
                if (user) {
                    console.log(`   ${index + 1}. ${user.name}: ${user.contribution} diamantes`);
                }
            });
        }
        else {
            console.log(`📊 [RANKING] Nenhum usuário com contadores > 0 no período ${period}`);
        }
        res.json(validUsers);
    }
    catch (error) {
        console.error('❌ Erro ao buscar ranking real:', error);
        // Sempre retornar array vazio em caso de erro
        res.json([]);
    }
});
// Rotas de notificações
router.get('/notifications', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        let userId = null;
        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_prod';
                const decoded = jwt.verify(token, JWT_SECRET);
                userId = decoded.id;
            }
            catch {
                // Token inválido
            }
        }
        if (!userId) {
            return res.json([]);
        }
        // Persistir atividade de consulta de notificações
        await models_1.User.findOneAndUpdate({ id: userId }, {
            $push: {
                recentActivities: {
                    action: 'notifications_viewed',
                    resource: 'notification_metadata',
                    timestamp: new Date(),
                    endpoint: '/api/metadata/notifications'
                }
            }
        }).catch(console.error);
        // Parâmetros de paginação (query string)
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        // Buscar total + notificações paginadas
        const [notifications, total] = await Promise.all([
            models_1.LiveNotification.find({ userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            models_1.LiveNotification.countDocuments({ userId })
        ]);
        res.json({
            success: true,
            data: notifications,
            pagination: {
                page,
                limit,
                total,
                hasMore: skip + notifications.length < total
            }
        });
    }
    catch (error) {
        console.error('Error getting notifications:', error);
        res.status(500).json({ error: error.message });
    }
});
router.patch('/notifications/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await models_1.LiveNotification.findOneAndUpdate({ _id: id }, { read: true }, { returnDocument: 'after' });
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        // Persistir atividade de marcação de notificação como lida
        await models_1.User.findOneAndUpdate({ id: notification.userId }, {
            $push: {
                recentActivities: {
                    action: 'notification_marked_read',
                    resource: 'notification_metadata',
                    timestamp: new Date(),
                    endpoint: '/api/metadata/notifications/:id/read'
                }
            }
        }).catch(console.error);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: error.message });
    }
});
// POST /api/metadata/notifications/mark-all-read - Marcar todas como lidas
router.post('/notifications/mark-all-read', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Token não fornecido' });
        }
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_prod';
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;
        if (!userId) {
            return res.json({ success: true, modifiedCount: 0 });
        }
        const result = await models_1.LiveNotification.updateMany({ userId, read: false }, { $set: { read: true } });
        res.json({ success: true, modifiedCount: result.modifiedCount });
    }
    catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: error.message });
    }
});
// GET /api/metadata/notifications/unread-count - Contagem de não lidas
router.get('/notifications/unread-count', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.json({ count: 0 });
        }
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_prod';
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;
        if (!userId) {
            return res.json({ count: 0 });
        }
        const count = await models_1.LiveNotification.countDocuments({ userId, read: false });
        res.json({ count });
    }
    catch (error) {
        console.error('Error getting unread count:', error);
        res.json({ count: 0 });
    }
});
// DELETE /api/metadata/notifications/:id - Remover uma notificação individual
router.delete('/notifications/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Token não fornecido' });
        }
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_prod';
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;
        if (!userId) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }
        const { id } = req.params;
        // Buscar a notificação para verificar se pertence ao usuário
        const notification = await models_1.LiveNotification.findById(id);
        if (!notification) {
            return res.status(404).json({ error: 'Notificação não encontrada' });
        }
        if (notification.userId !== userId) {
            return res.status(403).json({ error: 'Acesso negado. Esta notificação não pertence a este usuário' });
        }
        await models_1.LiveNotification.findByIdAndDelete(id);
        console.log(`[NOTIFICATIONS] Notificação ${id} removida pelo usuário ${userId}`);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ error: error.message });
    }
});
// PATCH /api/metadata/notifications/:id - Atualizar campos de uma notificação individual
router.patch('/notifications/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Token não fornecido' });
        }
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_prod';
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;
        if (!userId) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }
        const { id } = req.params;
        const updates = req.body;
        // Campos permitidos para atualização
        const allowedFields = ['read', 'message'];
        const sanitizedUpdates = {};
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                sanitizedUpdates[field] = updates[field];
            }
        }
        if (Object.keys(sanitizedUpdates).length === 0) {
            return res.status(400).json({ error: 'Nenhum campo válido para atualização. Campos permitidos: read, message' });
        }
        // Buscar a notificação para verificar se pertence ao usuário
        const notification = await models_1.LiveNotification.findById(id);
        if (!notification) {
            return res.status(404).json({ error: 'Notificação não encontrada' });
        }
        if (notification.userId !== userId) {
            return res.status(403).json({ error: 'Acesso negado. Esta notificação não pertence a este usuário' });
        }
        const updated = await models_1.LiveNotification.findByIdAndUpdate(id, { $set: sanitizedUpdates }, { returnDocument: 'after' });
        console.log(`[NOTIFICATIONS] Notificação ${id} atualizada pelo usuário ${userId}:`, sanitizedUpdates);
        res.json({ success: true, notification: updated });
    }
    catch (error) {
        console.error('Error updating notification:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/notifications/start-live', async (req, res) => {
    try {
        const { streamId, streamKey, hostId, hostName, hostAvatar } = req.body;
        const actualStreamId = streamId || streamKey;
        if (!actualStreamId) {
            return res.status(400).json({ error: 'streamId ou streamKey é obrigatório' });
        }
        // Buscar followers do streamer
        const { Followers } = await Promise.resolve().then(() => __importStar(require('../models/index')));
        const followers = await Followers.find({
            followingId: hostId,
            isActive: true
        }).select('followerId').lean();
        if (followers.length === 0) {
            return res.json({ success: true, notificationsCreated: 0, message: 'Nenhum seguidor encontrado' });
        }
        const notifications = followers.map((f) => ({
            userId: f.followerId,
            streamerId: hostId,
            streamId: actualStreamId,
            message: `${hostName || 'Alguém'} está ao vivo!`,
            read: false,
            createdAt: new Date()
        }));
        await models_1.LiveNotification.insertMany(notifications);
        // Emitir socket event para cada seguidor
        const io = req.app.get('io');
        if (io) {
            followers.forEach((f) => {
                io.to(`user_${f.followerId}`).emit('unread_notification', {
                    type: 'live_started',
                    streamerId: hostId,
                    streamId: actualStreamId,
                    message: `${hostName || 'Alguém'} está ao vivo!`,
                    avatar: hostAvatar || '',
                    timestamp: new Date().toISOString()
                });
            });
        }
        return res.json({
            success: true,
            notificationsCreated: notifications.length
        });
    }
    catch (error) {
        console.error('Error creating live notifications:', error);
        res.status(500).json({ error: error.message });
    }
});
// Stream History - usando PurchaseRecord como base
router.get('/history/streams', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        let userId = null;
        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_prod';
                const decoded = jwt.verify(token, JWT_SECRET);
                userId = decoded.id;
            }
            catch {
                // Token inválido
            }
        }
        if (!userId) {
            return res.json([]);
        }
        // Persistir atividade de consulta de histórico de streams
        await models_1.User.findOneAndUpdate({ id: userId }, {
            $push: {
                recentActivities: {
                    action: 'stream_history_viewed',
                    resource: 'stream_metadata',
                    timestamp: new Date(),
                    endpoint: '/api/metadata/history/streams'
                }
            }
        }).catch(console.error);
        // Buscar streams finalizados do usuário
        const streamHistory = await models_1.StreamSession.find({ userId })
            .sort({ endedAt: -1 })
            .limit(20)
            .populate('userId', 'name avatar');
        res.json(streamHistory);
    }
    catch (error) {
        console.error('Error getting stream history:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/history/streams', async (req, res) => {
    try {
        const streamData = req.body;
        // Criar registro de histórico de stream
        const streamHistory = await models_1.StreamSession.create({
            userId: streamData.userId,
            streamId: streamData.streamId,
            title: streamData.title,
            startedAt: streamData.startedAt || new Date(),
            endedAt: streamData.endedAt || new Date(),
            duration: streamData.duration,
            viewers: streamData.viewers || 0,
            gifts: streamData.gifts || 0,
            diamonds: streamData.diamonds || 0
        });
        res.json({ success: true, streamHistory });
    }
    catch (error) {
        console.error('Error saving stream history:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
