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
const express_1 = __importDefault(require("express"));
const models_1 = require("../models");
const db_1 = require("../config/db");
const Follow_1 = require("../models/Follow");
const ComboService_1 = require("../services/ComboService");
const GiftRankingService_1 = require("../services/GiftRankingService");
const router = express_1.default.Router();
class GiftQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.MAX_CONCURRENT = 5; // Processar até 5 presentes simultaneamente
        this.currentProcessing = 0;
    }
    async add(gift) {
        return new Promise((resolve, reject) => {
            const queuedGift = {
                ...gift,
                id: `gift_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                timestamp: Date.now(),
                resolve,
                reject
            };
            this.queue.push(queuedGift);
            this.processQueue();
        });
    }
    async processQueue() {
        if (this.processing || this.currentProcessing >= this.MAX_CONCURRENT) {
            return;
        }
        this.processing = true;
        while (this.queue.length > 0 && this.currentProcessing < this.MAX_CONCURRENT) {
            const gift = this.queue.shift();
            if (gift) {
                this.currentProcessing++;
                this.processGift(gift)
                    .then(gift.resolve)
                    .catch(gift.reject)
                    .finally(() => {
                    this.currentProcessing--;
                    this.processQueue(); // Continuar processando
                });
            }
        }
        this.processing = false;
    }
    async processGift(gift) {
        // Lógica de processamento do presente será implementada aqui
        // Por enquanto, vamos apenas simular o processamento
        console.log(`🔄 [QUEUE] Processando presente ${gift.id} da fila...`);
        return gift;
    }
}
const giftQueue = new GiftQueue();
// Enviar presente
router.post('/send', async (req, res) => {
    try {
        const { fromUserId, toUserId, giftId, quantity = 1, streamId } = req.body;
        const io = req.app.get('io');
        // Adicionar à fila de processamento
        const result = await giftQueue.add({
            fromUserId,
            toUserId,
            giftId,
            quantity,
            streamId
        });
        // Processar o presente
        await processGiftSend(result.fromUserId, result.toUserId, result.giftId, result.quantity, result.streamId, io);
        res.json({
            success: true,
            message: 'Presente enviado com sucesso',
            queuedAt: result.timestamp
        });
    }
    catch (error) {
        console.error('❌ Erro ao enviar presente:', error);
        res.status(500).json({ error: error.message });
    }
});
// Função principal de processamento de presente
async function processGiftSend(fromUserId, toUserId, giftId, quantity, streamId, io) {
    try {
        console.log(`🎁 [PROCESSING] Iniciando processamento: ${fromUserId} -> ${toUserId} (${quantity}x ${giftId})`);
        // Buscar usuários
        const fromUser = await models_1.User.findOne({ id: fromUserId });
        const toUser = await models_1.User.findOne({ id: toUserId });
        const gift = await models_1.Gift.findOne({ id: giftId });
        if (!fromUser || !toUser || !gift) {
            throw new Error('Usuário ou presente não encontrado');
        }
        // Calcular valor total
        const giftPrice = gift?.price || 0;
        const totalCost = giftPrice * quantity;
        // Verificar saldo de diamantes
        if (fromUser.diamonds < totalCost) {
            throw new Error('Saldo insuficiente');
        }
        // 🔧 MELHOR PRÁTICA: Atualizar saldos com $inc (atômico) + persistir atividade
        await models_1.User.findOneAndUpdate({ id: fromUserId }, {
            $inc: { diamonds: -totalCost, enviados: totalCost },
            $set: { lastSeen: new Date().toISOString() },
            $push: {
                recentActivities: {
                    action: 'live_gift',
                    resource: 'monetary_transaction',
                    timestamp: new Date(),
                    endpoint: '/api/gifts/send'
                }
            }
        });
        // Se for presente para stream, acumular diamantes na stream E no widget da streamer
        if (streamId && streamId !== 'unknown') {
            // Atualizar diamonds da stream com $inc (atômico)
            await models_1.Streamer.findOneAndUpdate({ id: streamId }, { $inc: { diamonds: totalCost } }, { upsert: true } // Criar se não existir
            );
            // Atualizar widget da streamer com $inc (atômico)
            await models_1.Streamer.findOneAndUpdate({ id: toUserId }, { $inc: { diamonds: totalCost } }, { upsert: true } // Criar se não existir
            );
            console.log(`💎 [LIVE GIFT] ${totalCost} diamantes adicionados à live ${streamId} e widget da streamer ${toUserId}.`);
            // 🔧 SALVAR NO STREAM SESSION: acumular moedas para o resumo da live
            try {
                const { incrementCoins } = await Promise.resolve().then(() => __importStar(require('../models/StreamSession')));
                const db = (0, db_1.getDb)();
                await incrementCoins(db.collection('streamsessions'), streamId, totalCost);
                console.log(`💾 [STREAM SESSION] ${totalCost} moedas salvas no StreamSession ${streamId}`);
            }
            catch (sessionErr) {
                console.warn(`⚠️ [STREAM SESSION] Erro ao salvar moedas: ${sessionErr}`);
            }
        }
        // 🔧 MELHOR PRÁTICA: Atualizar earnings/receptores com $inc (atômico)
        await models_1.User.findOneAndUpdate({ id: toUserId }, {
            $inc: { earnings: totalCost, receptores: totalCost },
            $set: { lastSeen: new Date().toISOString() }
        }, { upsert: true } // Criar se não existir
        );
        if (!streamId || streamId === 'unknown') {
            console.log(`💰 [DIRECT GIFT] ${totalCost} diamantes adicionados aos earnings/receptores de ${toUser.name}.`);
        }
        else {
            console.log(`💎 [LIVE GIFT] ${totalCost} diamantes adicionados aos earnings/receptores de ${toUser.name} (stream: ${streamId}).`);
        }
        // Verificar se o destinatário está em uma PK ativa e incrementar score
        if (streamId && streamId !== 'unknown') {
            try {
                const activeBattle = await models_1.Battle.findOne({
                    $or: [
                        { streamerA: toUser._id },
                        { streamerB: toUser._id }
                    ],
                    status: 'active'
                }).lean();
                if (activeBattle) {
                    const field = activeBattle.streamerA.toString() === toUser._id.toString() ? 'scoreA' : 'scoreB';
                    await models_1.Battle.findOneAndUpdate({ _id: activeBattle._id }, {
                        $inc: { [field]: totalCost }
                    });
                    if (io) {
                        const updated = await models_1.Battle.findById(activeBattle._id).select('scoreA scoreB');
                        io.to(`battle_${activeBattle._id}`).emit('pk_score_update', {
                            battleId: activeBattle._id.toString(),
                            scoreA: updated?.scoreA || 0,
                            scoreB: updated?.scoreB || 0
                        });
                    }
                    console.log(`🏆 [PK GIFT] ${totalCost} pontos adicionados à PK ${activeBattle._id} para ${toUserId}`);
                }
            }
            catch (err) {
                console.error('[PK GIFT] Erro ao atualizar score PK via gift:', err);
            }
        }
        // Emitir WebSocket para atualizar earnings em tempo real (para direct e live gifts)
        if (io) {
            io.emit('earnings_updated', {
                userId: toUserId,
                diamonds: totalCost,
                totalEarnings: toUser.earnings,
                timestamp: new Date().toISOString(),
                source: (!streamId || streamId === 'unknown') ? 'direct_gift' : 'live_gift',
                fromUser: fromUser.name,
                giftName: gift.name,
                streamId: streamId
            });
            // 🔧 CORREÇÃO: Atualizar contador da live em tempo real
            if (streamId && streamId !== 'unknown') {
                const updatedStream = await models_1.Streamer.findOne({ id: streamId });
                const totalStreamDiamonds = updatedStream?.diamonds || 0;
                io.emit('live_coins_updated', {
                    streamId: streamId,
                    coins: totalCost,
                    totalCoins: totalStreamDiamonds,
                    timestamp: new Date().toISOString(),
                    fromUser: fromUser.name,
                    giftName: gift.name
                });
                console.log(`🪙 [LIVE COINS] Live ${streamId} atualizada: +${totalCost} = ${totalStreamDiamonds} total`);
            }
        }
        console.log(`💰 [GIFT] ${fromUser.name} enviou ${totalCost} diamantes para ${toUser.name}`);
        console.log(`📊 [GIFT] ${toUser.name} - Receptores: ${toUser.receptores}, Earnings: ${toUser.earnings}`);
        // Atualizar XP do remetente (preço * 10)
        fromUser.xp = (fromUser.xp || 0) + totalCost * 10;
        // Verificar evolução de nível (1 nível a cada 1000 XP)
        const newLevel = Math.floor((fromUser.xp || 0) / 1000) + 1;
        if (newLevel > (fromUser.level || 1)) {
            fromUser.level = newLevel;
            console.log(`⬆️ [LEVEL UP] ${fromUser.name} subiu para o nível ${newLevel}!`);
        }
        // Salvar ambos os usuários no banco
        await fromUser.save();
        await toUser.save();
        // Auto-follow se o gift tiver triggersAutoFollow: true
        if (gift.triggersAutoFollow && streamId && streamId !== 'unknown' && fromUserId !== toUserId) {
            try {
                const coll = (0, db_1.getDb)().collection('follows');
                const alreadyFollows = await (0, Follow_1.isFollowing)(coll, fromUserId, toUserId);
                if (!alreadyFollows) {
                    await (0, Follow_1.createFollow)(coll, fromUserId, toUserId);
                    console.log(`🔁 [AUTO-FOLLOW] ${fromUserId} seguiu ${toUserId} (triggered by gift ${gift.name})`);
                    if (io) {
                        io.to(`user_${toUserId}`).emit('new_follower', {
                            followerId: fromUserId,
                            followerName: fromUser.name,
                            followerAvatar: fromUser.avatarUrl,
                            timestamp: new Date().toISOString()
                        });
                        io.to(`user_${fromUserId}`).emit('follow_completed', {
                            followingId: toUserId,
                            followingName: toUser.name,
                            followingAvatar: toUser.avatarUrl
                        });
                    }
                }
            }
            catch (err) {
                console.error('[AUTO-FOLLOW] Erro ao processar auto-follow:', err);
            }
        }
        // Registrar transação com upsert automático
        const transactionId = `gift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await models_1.GiftTransaction.findOneAndUpdate({ id: transactionId }, {
            $set: {
                id: transactionId,
                fromUserId,
                fromUserName: fromUser.name,
                fromUserAvatar: fromUser.avatarUrl,
                toUserId,
                toUserName: toUser.name,
                streamId: streamId || 'unknown',
                giftId: gift._id, // Usar _id do MongoDB
                giftName: gift.name,
                giftIcon: gift.icon,
                giftPrice: giftPrice,
                quantity: quantity,
                totalValue: totalCost,
                createdAt: new Date().toISOString()
            }
        }, {
            upsert: true, // Criar se não existir
            new: true
        });
        // 🎯 Combo + Ranking (antes do broadcast para ter dados no payload)
        let comboResult = null;
        if (streamId && streamId !== 'unknown') {
            comboResult = ComboService_1.ComboService.processCombo(streamId, fromUserId, fromUser.name, fromUser.avatarUrl, gift.id, gift.name, totalCost, io);
            GiftRankingService_1.GiftRankingService.record(streamId, fromUserId, fromUser.name, fromUser.avatarUrl, totalCost, io);
        }
        // 🚀 SISTEMA DE BROADCAST EM TEMPO REAL - PRESENTES NA LIVE
        if (io) {
            // 1. Broadcast principal para todos na sala da live (prioridade máxima)
            if (streamId && streamId !== 'unknown') {
                // Evento principal: presente recebido na live
                io.to(streamId).emit('live_gift_received', {
                    fromUser: {
                        id: fromUserId,
                        userId: fromUserId,
                        name: fromUser.name,
                        uniqueId: fromUser.name,
                        nickname: fromUser.name,
                        avatarUrl: fromUser.avatarUrl,
                        profilePictureUrl: fromUser.avatarUrl,
                        level: fromUser.level || 1
                    },
                    toUser: {
                        id: toUserId,
                        userId: toUserId,
                        name: toUser.name,
                        uniqueId: toUser.name,
                        nickname: toUser.name,
                        avatarUrl: toUser.avatarUrl,
                        profilePictureUrl: toUser.avatarUrl
                    },
                    gift: {
                        gift_id: gift.id,
                        gift_name: gift.name,
                        gift_type: 1,
                        diamond_count: giftPrice,
                        id: gift.id,
                        name: gift.name,
                        icon: gift.icon,
                        price: giftPrice,
                        category: gift.category,
                        rarity: gift.rarity || 'common',
                        animation: gift.animation || null
                    },
                    quantity: quantity,
                    totalValue: totalCost,
                    diamondCount: totalCost,
                    streamId: streamId,
                    roomId: streamId,
                    timestamp: new Date().toISOString(),
                    createTime: Math.floor(Date.now() / 1000).toString(),
                    eventId: `gift_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                    repeatCount: comboResult?.repeatCount ?? 1,
                    repeatEnd: comboResult?.repeatEnd ?? true,
                    comboCount: comboResult?.comboCount ?? 1,
                    groupId: comboResult?.groupId ?? '',
                    multiplier: comboResult?.multiplier ?? 1,
                });
                console.log(`📡 [LIVE BROADCAST] Presente broadcastado para ${streamId}: ${fromUser.name} -> ${toUser.name} (${quantity}x ${gift.name})`);
                // 2. Atualizar contador de diamantes da live
                const updatedStream = await models_1.Streamer.findOne({ id: streamId });
                const totalStreamDiamonds = updatedStream?.diamonds || 0;
                io.to(streamId).emit('live_coins_updated', {
                    streamId: streamId,
                    coins: totalCost,
                    totalCoins: totalStreamDiamonds,
                    timestamp: new Date().toISOString(),
                    fromUser: fromUser.name,
                    giftName: gift.name
                });
                // 3. Atualizar modal de presentes da live
                io.to(streamId).emit('gift_sent_to_stream', {
                    streamId,
                    gift: {
                        fromUserId,
                        fromUserName: fromUser.name,
                        fromUserAvatar: fromUser.avatarUrl,
                        giftName: gift.name,
                        giftIcon: gift.icon,
                        giftPrice: giftPrice,
                        quantity,
                        totalValue: totalCost
                    },
                    timestamp: new Date().toISOString()
                });
            }
            // 4. Notificação pessoal para o destinatário
            io.to(`user_${toUserId}`).emit('gift_received', {
                from: {
                    id: fromUser.id,
                    name: fromUser.name,
                    avatarUrl: fromUser.avatarUrl
                },
                gift: {
                    id: gift.id,
                    name: gift.name,
                    icon: gift.icon,
                    price: giftPrice
                },
                quantity: quantity,
                totalValue: totalCost,
                streamId,
                timestamp: new Date().toISOString()
            });
            // 5. Atualização global de earnings
            io.emit('earnings_updated', {
                userId: toUserId,
                diamonds: totalCost,
                totalEarnings: toUser.earnings + totalCost,
                timestamp: new Date().toISOString(),
                source: (!streamId || streamId === 'unknown') ? 'direct_gift' : 'live_gift',
                fromUser: fromUser.name,
                giftName: gift.name,
                streamId: streamId
            });
            // 6. Atualização de diamantes do remetente
            io.emit('diamonds_updated', {
                userId: fromUserId,
                diamonds: fromUser.diamonds - totalCost,
                change: -totalCost,
                timestamp: new Date().toISOString()
            });
        }
        console.log(`🎁 Presente enviado: ${fromUser.name} -> ${toUser.name} (${quantity}x ${gift.name} = ${totalCost} diamantes)`);
        return {
            success: true,
            fromUser: { id: fromUser.id, diamonds: fromUser.diamonds },
            toUser: { id: toUser.id, earnings: toUser.earnings },
            transaction: {
                quantity,
                totalCost,
                diamonds: totalCost
            }
        };
    }
    catch (error) {
        console.error('❌ Erro ao processar presente:', error);
        throw error;
    }
}
// Listar presentes enviados em uma live específica
router.get('/stream/:streamId', async (req, res) => {
    try {
        const { streamId } = req.params;
        const { limit = 50 } = req.query;
        // Buscar transações de presentes para esta live
        const gifts = await models_1.GiftTransaction.find({
            streamId: streamId,
            fromUserId: { $ne: '65384127' } // Excluir auto-presentes do streamer
        })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .lean();
        if (gifts.length === 0) {
            return res.json({
                success: true,
                gifts: [],
                message: 'Ninguém enviou presentes nesta live ainda'
            });
        }
        // Agrupar por usuário para mostrar total de presentes por pessoa
        const usersGifts = gifts.reduce((acc, gift) => {
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
        const result = Object.values(usersGifts);
        console.log(`📋 [GIFTS LIST] ${gifts.length} presentes encontrados para stream ${streamId} de ${result.length} usuários diferentes`);
        res.json({
            success: true,
            gifts: result,
            totalUsers: result.length,
            totalGifts: gifts.length,
            totalValue: result.reduce((sum, user) => sum + user.totalValue, 0)
        });
    }
    catch (error) {
        console.error('❌ Erro ao listar presentes da live:', error);
        res.status(500).json({ error: error.message });
    }
});
// Notificar quando usuário entra ao vivo
router.post('/notify-live-start', async (req, res) => {
    try {
        const { userId, streamId, streamName } = req.body;
        // Buscar usuário
        const user = await models_1.User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        // Buscar seguidores
        const followers = await models_1.Followers.find({ followingId: userId });
        // Enviar notificações para todos os seguidores
        const io = req.app.get('io');
        if (io) {
            followers.forEach(follower => {
                io.to(`user_${follower.followerId}`).emit('notification', {
                    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${follower.followerId}`,
                    userId: follower.followerId,
                    type: 'user_live',
                    message: `${user.name} entrou ao vivo!`,
                    data: {
                        streamerId: userId,
                        streamerName: user.name,
                        streamId,
                        streamName,
                        avatarUrl: user.avatarUrl
                    },
                    timestamp: new Date().toISOString(),
                    read: false
                });
                io.to(`user_${follower.followerId}`).emit('unread_notification', {
                    userId: follower.followerId,
                    count: 1,
                    timestamp: new Date().toISOString()
                });
            });
        }
        console.log(`🔔 Notificações enviadas para ${followers.length} seguidores de ${user.name}`);
        res.json({
            success: true,
            message: 'Notificações enviadas',
            followersCount: followers.length
        });
    }
    catch (error) {
        console.error('❌ Erro ao notificar live:', error);
        res.status(500).json({ error: error.message });
    }
});
// Buscar streams ativas dos usuários seguidos
router.get('/following-lives/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        // Buscar seguidores
        const followers = await models_1.Followers.find({ followingId: userId });
        const followingIds = followers.map(f => f.followerId);
        // Buscar streams ativas desses usuários
        const activeStreams = await models_1.Streamer.find({
            hostId: { $in: followingIds },
            isLive: true
        }).sort({ viewers: -1 });
        console.log(`📺 Buscando ${activeStreams.length} lives de usuários seguidos por ${userId}`);
        res.json({
            success: true,
            streams: activeStreams,
            count: activeStreams.length
        });
    }
    catch (error) {
        console.error('❌ Erro ao buscar lives seguidas:', error);
        res.status(500).json({ error: error.message });
    }
});
// POST /streams/:streamId/gift — rota do spec do ambiente simulado
router.post('/streams/:streamId/gift', async (req, res) => {
    try {
        const { streamId } = req.params;
        const { fromUserId, giftName, amount } = req.body;
        const io = req.app.get('io');
        if (!fromUserId || !giftName) {
            return res.status(400).json({ error: 'fromUserId e giftName são obrigatórios' });
        }
        // Buscar gift pelo nome para obter giftId e preço
        const gift = await models_1.Gift.findOne({ name: giftName }).lean();
        if (!gift) {
            return res.status(404).json({ error: 'Presente não encontrado' });
        }
        const quantity = amount || 1;
        // Verificar saldo
        const fromUser = await models_1.User.findOne({ id: fromUserId });
        if (!fromUser) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        const totalCost = (gift.price || 0) * quantity;
        if (fromUser.diamonds < totalCost) {
            return res.status(400).json({ error: 'Saldo insuficiente' });
        }
        // Buscar streamer dono da sala
        const stream = await models_1.Streamer.findOne({ id: streamId }).lean();
        if (!stream) {
            return res.status(404).json({ error: 'Stream não encontrada' });
        }
        // Delegar para o processamento principal de gift
        await processGiftSend(fromUserId, stream.hostId, gift.id, quantity, streamId, io);
        res.json({
            success: true,
            message: `Presente ${giftName} enviado para a stream ${streamId}`,
            giftName,
            quantity,
            totalCost
        });
    }
    catch (error) {
        console.error('❌ Erro ao enviar presente via /streams/:streamId/gift:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
