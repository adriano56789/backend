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
const mercadopago_1 = require("mercadopago");
const router = express_1.default.Router();
const processedCallbacks = new Set();
const reconnectionTimers = new Map();
const RECONNECT_WINDOW_MS = 15000;
function isDuplicate(clientId, action) {
    const key = `${action}:${clientId}`;
    if (processedCallbacks.has(key))
        return true;
    processedCallbacks.add(key);
    setTimeout(() => processedCallbacks.delete(key), 5000);
    return false;
}
// POST /api/webhooks — Webhook unificado para eventos do SRS
router.post('/', async (req, res) => {
    try {
        const body = req.body;
        const { server_id, action: srsAction, client_id, ip, vhost, app, tcUrl, stream: rawStream, param, stream_url, stream_id, event: rawEvent } = body;
        const action = (srsAction || '').toLowerCase();
        const event = (rawEvent || '').toLowerCase();
        const streamKey = rawStream?.split('?')[0] || rawStream || body.streamId || '';
        console.log(`[WEBHOOK-SRS] action=${action} event=${event} stream=${streamKey} client=${client_id} ip=${ip}`);
        // ─── on_publish / stream started ───────────────────────────────────
        if (action === 'on_publish' || action === 'publish' || event.includes('stream started') || event.includes('on publish')) {
            if (client_id && isDuplicate(client_id, 'on_publish')) {
                return res.status(200).json({ code: 0 });
            }
            if (streamKey && reconnectionTimers.has(streamKey)) {
                clearTimeout(reconnectionTimers.get(streamKey));
                reconnectionTimers.delete(streamKey);
            }
            const existingStream = streamKey
                ? await models_1.Streamer.findOne({ $or: [{ streamKey }, { id: streamKey }] }).lean()
                : null;
            let foundUserId = body.hostId || body.userId || existingStream?.hostId || null;
            if (!foundUserId && streamKey) {
                const userByStream = await models_1.User.findOne({ currentStreamId: streamKey }).lean();
                if (userByStream)
                    foundUserId = userByStream.id;
            }
            if (!foundUserId) {
                console.log(`[WEBHOOK-SRS] Nenhum usuário encontrado para stream=${streamKey}`);
                return res.status(200).json({ code: 0 });
            }
            const user = await models_1.User.findOne({ id: foundUserId });
            if (!user) {
                console.log(`[WEBHOOK-SRS] Usuário não encontrado: ${foundUserId}`);
                return res.status(200).json({ code: 0 });
            }
            const streamTitle = existingStream?.title || existingStream?.message || `Live de ${user.name || 'Streamer'}`;
            const liveApp = app || 'live';
            const rtmpIngestUrl = existingStream?.rtmpIngestUrl
                || (tcUrl ? `${tcUrl}/${streamKey}` : null)
                || `rtmp://${process.env.SRS_HOST || 'rtc.livego.store'}:${process.env.SRS_RTMP_PORT || '1935'}/${liveApp}/${streamKey}`;
            const playbackUrl = existingStream?.playbackUrl
                || stream_url
                || `${process.env.BACKEND_URL || 'https://api.livego.store'}/api/video/http/live/${streamKey}.flv`;
            const hlsUrl = existingStream?.hlsUrl
                || `${process.env.BACKEND_URL || 'https://api.livego.store'}/api/video/http/live/${streamKey}.m3u8`;
            const finalCategory = (existingStream?.category || 'popular').toLowerCase();
            const streamerData = {
                id: streamKey,
                hostId: foundUserId,
                name: user.name || 'Streamer',
                avatar: user.avatarUrl || '',
                location: user.country || 'BR',
                time: 'Ao Vivo',
                message: streamTitle,
                tags: existingStream?.tags || ['live'],
                isLive: true,
                streamStatus: 'active',
                startTime: existingStream?.startTime || new Date(),
                streamKey,
                server_id,
                stream_id,
                stream_url,
                param,
                title: existingStream?.title || '',
                category: finalCategory,
                country: user.country || 'BR',
                rtmpIngestUrl,
                playbackUrl,
                hlsUrl,
                vhost: vhost || '__defaultVhost__',
                app: liveApp
            };
            await models_1.Streamer.findOneAndUpdate({ id: streamKey }, { $set: streamerData }, { upsert: true, new: true });
            await models_1.User.findOneAndUpdate({ id: foundUserId }, { $set: { isLive: true, currentStreamId: streamKey } });
            const finalCountry = (existingStream?.country || user.country || 'BR').toLowerCase();
            await models_1.LiveCard.findOneAndUpdate({ hostId: foundUserId }, {
                $set: {
                    hostId: foundUserId,
                    name: user.name || foundUserId,
                    avatar: user.avatarUrl || '',
                    title: existingStream?.title || streamTitle,
                    streamKey,
                    playbackUrl,
                    hlsUrl,
                    country: finalCountry,
                    isLive: true,
                    streamStatus: 'active',
                    category: finalCategory,
                    startTime: existingStream?.startTime || new Date(),
                    updatedAt: new Date()
                }
            }, { upsert: true });
            const io = req.app.get('io');
            if (io) {
                io.emit('new_live', {
                    id: streamKey,
                    hostId: foundUserId,
                    name: user.name || 'Live',
                    avatar: user.avatarUrl || '',
                    isLive: true,
                    streamStatus: 'active',
                    country: user.country || 'BR',
                    viewers: 0
                });
                io.emit('stream_started', {
                    streamId: streamKey,
                    hostId: foundUserId,
                    name: user.name || 'Live',
                    avatar: user.avatarUrl || '',
                    timestamp: new Date().toISOString()
                });
            }
            console.log(`[WEBHOOK-SRS] Stream iniciada: ${streamKey} user=${foundUserId}`);
            return res.status(200).json({ code: 0 });
        }
        // ─── on_unpublish / stream ended ──────────────────────────────────
        if (action === 'on_unpublish' || action === 'unpublish' || event.includes('stream ended') || event.includes('stream stopped') || event.includes('live stream ended') || event.includes('on unpublish')) {
            if (client_id && isDuplicate(client_id, 'on_unpublish')) {
                return res.status(200).json({ code: 0 });
            }
            if (streamKey && reconnectionTimers.has(streamKey)) {
                return res.status(200).json({ code: 0 });
            }
            if (streamKey) {
                const timer = setTimeout(async () => {
                    const updated = await models_1.Streamer.findOneAndUpdate({ id: streamKey, isLive: true }, { $set: { isLive: false, streamStatus: 'ended', endTime: new Date() } });
                    if (updated) {
                        await models_1.User.findOneAndUpdate({ id: updated.hostId }, { $set: { isLive: false, isOnline: false, currentStreamId: null } });
                        await models_1.LiveCard.findOneAndUpdate({ hostId: updated.hostId }, { $set: { isLive: false, streamStatus: 'ended', endTime: new Date(), updatedAt: new Date() } });
                        const io = req.app.get('io');
                        if (io) {
                            io.emit('card_removed', { streamId: streamKey, hostId: updated.hostId, timestamp: new Date().toISOString() });
                            io.emit('stream_ended', { streamId: streamKey, hostId: updated.hostId, timestamp: new Date().toISOString() });
                            io.emit('stream_stopped', { streamId: streamKey, hostId: updated.hostId, timestamp: new Date().toISOString() });
                            io.emit('live_stream_ended', { streamId: streamKey, message: 'Transmissão encerrada', timestamp: new Date().toISOString() });
                            io.emit('viewers_count_updated', { count: 0, streamId: streamKey });
                        }
                    }
                    reconnectionTimers.delete(streamKey);
                }, RECONNECT_WINDOW_MS);
                reconnectionTimers.set(streamKey, timer);
            }
            console.log(`[WEBHOOK-SRS] Stream encerrada (com grace period): ${streamKey}`);
            return res.status(200).json({ code: 0 });
        }
        // ─── on_play / viewer joined ──────────────────────────────────────
        if (action === 'on_play' || action === 'play' || event.includes('viewer joined') || event.includes('user joined')) {
            if (streamKey) {
                const viewerId = body.userId || body.client_id || '';
                if (viewerId) {
                    await models_1.StreamParticipant.findOneAndUpdate({ streamId: streamKey, userId: viewerId }, {
                        $set: {
                            streamId: streamKey,
                            userId: viewerId,
                            userName: body.userName || body.name || '',
                            userAvatar: body.userAvatar || body.avatar || '',
                            role: 'viewer',
                            joinedAt: new Date()
                        }
                    }, { upsert: true });
                    await models_1.Streamer.findOneAndUpdate({ id: streamKey }, { $inc: { viewers: 1 } });
                }
            }
            const io = req.app.get('io');
            if (io && streamKey) {
                const viewerId = body.userId || body.client_id || '';
                io.to(streamKey).emit('user_joined_stream', {
                    userId: viewerId,
                    userName: body.userName || body.name || '',
                    userAvatar: body.userAvatar || body.avatar || '',
                    userLevel: body.userLevel || 0,
                    timestamp: new Date().toISOString(),
                    streamId: streamKey
                });
            }
            console.log(`[WEBHOOK-SRS] Viewer entrou na stream: ${streamKey}`);
            return res.status(200).json({ code: 0 });
        }
        // ─── on_stop / viewer left ────────────────────────────────────────
        if (action === 'on_stop' || action === 'stop' || event.includes('viewer left') || event.includes('user left')) {
            const viewerId = body.userId || body.client_id || '';
            if (streamKey && viewerId) {
                await models_1.StreamParticipant.deleteOne({ streamId: streamKey, userId: viewerId });
                await models_1.Streamer.findOneAndUpdate({ id: streamKey }, { $inc: { viewers: -1 } });
            }
            const io = req.app.get('io');
            if (io && streamKey) {
                io.to(streamKey).emit('user_left_stream', {
                    userId: viewerId,
                    userName: body.userName || body.name || '',
                    userAvatar: body.userAvatar || body.avatar || '',
                    userLevel: body.userLevel || 0,
                    timestamp: new Date().toISOString(),
                    streamId: streamKey
                });
            }
            console.log(`[WEBHOOK-SRS] Viewer saiu da stream: ${streamKey}`);
            return res.status(200).json({ code: 0 });
        }
        // ─── chat / chat message ──────────────────────────────────────────
        // Payload real do app: { streamId, userId, userName, userAvatar, message }
        if (event.includes('chat') || event.includes('chat message') || action === 'chat') {
            const chatMessage = await models_1.ChatMessage.create({
                id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
                conversationId: body.conversationId || body.roomId || streamKey,
                senderId: body.userId || body.fromUserId || body.hostId || '',
                receiverId: body.toUserId || body.targetUserId || '',
                content: body.message || body.content || body.text || '',
                messageType: 'text',
                isRead: false
            });
            const io = req.app.get('io');
            if (io) {
                io.emit('receive_message', {
                    id: chatMessage.id,
                    type: 'chat',
                    userId: body.userId || body.fromUserId || body.hostId || '',
                    user: body.userName || body.name || 'Usuário',
                    level: body.userLevel || 0,
                    message: body.message || body.content || body.text || '',
                    avatar: body.userAvatar || body.avatar || '',
                    gender: body.gender || '',
                    age: body.age || 0,
                    activeFrameId: body.activeFrameId || '',
                    frameExpiration: body.frameExpiration || null
                });
            }
            return res.status(200).json({ code: 0 });
        }
        // ─── like / reaction ──────────────────────────────────────────────
        if (event.includes('like') || event.includes('reaction') || action === 'like' || action === 'reaction') {
            const userId = body.userId || body.fromUserId || '';
            if (streamKey && userId) {
                await models_1.StreamLike.findOneAndUpdate({ streamId: streamKey, userId }, { $set: { streamId: streamKey, userId, createdAt: new Date() } }, { upsert: true });
                const totalLikes = await models_1.StreamLike.countDocuments({ streamId: streamKey });
                const io = req.app.get('io');
                if (io) {
                    io.emit('stream_liked', { streamId: streamKey, totalLikes, userId, timestamp: new Date().toISOString() });
                }
            }
            return res.status(200).json({ code: 0 });
        }
        // ─── gift ─────────────────────────────────────────────────────────
        // Payload real do app: { streamId, fromUserId, fromUserName, fromUserAvatar, toUserId, toUserName, toUserAvatar, giftId, giftName, giftIcon, giftPrice, quantity, fromUserLevel }
        if (event.includes('gift') || action === 'gift') {
            const fromUserId = body.userId || body.fromUserId || body.senderId || '';
            const toUserId = body.toUserId || body.targetUserId || body.receiverId || '';
            if (streamKey && fromUserId) {
                const giftIdStr = body.giftId || body.gift?.id || '';
                let giftObjectId = giftIdStr;
                if (giftIdStr) {
                    const giftDoc = await models_1.Gift.findOne({ id: giftIdStr }).lean();
                    if (giftDoc)
                        giftObjectId = giftDoc._id;
                }
                const giftName = body.giftName || body.gift?.name || 'Presente';
                const giftIcon = body.giftIcon || body.gift?.icon || '';
                const giftPrice = body.giftPrice || body.gift?.price || 0;
                const quantity = body.quantity || 1;
                const totalValue = giftPrice * quantity;
                const [transaction] = await models_1.GiftTransaction.create([{
                        id: `gift_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                        streamId: streamKey,
                        fromUserId,
                        fromUserName: body.userName || body.name || '',
                        fromUserAvatar: body.userAvatar || body.avatar || '',
                        toUserId: toUserId || fromUserId,
                        toUserName: body.toUserName || '',
                        giftId: giftObjectId,
                        giftName,
                        giftIcon,
                        giftPrice,
                        quantity,
                        totalValue
                    }]);
                const io = req.app.get('io');
                if (io) {
                    io.to(streamKey).emit('gift_sent_to_stream', {
                        streamId: streamKey,
                        gift: {
                            fromUserId,
                            fromUserName: body.userName || body.name || '',
                            fromUserAvatar: body.userAvatar || body.avatar || '',
                            giftName,
                            giftIcon,
                            giftPrice,
                            quantity,
                            totalValue
                        },
                        timestamp: new Date().toISOString()
                    });
                    io.to(streamKey).emit('live_gift_received', {
                        from: {
                            id: fromUserId,
                            name: body.userName || body.name || '',
                            avatarUrl: body.userAvatar || body.avatar || '',
                            level: body.fromUserLevel || 0,
                            identification: body.identification || '',
                            country: body.country || '',
                            age: body.age || 0,
                            gender: body.gender || '',
                            diamonds: body.diamonds || 0,
                            earnings: body.earnings || 0,
                            receptores: body.receptores || 0,
                            enviados: body.enviados || 0,
                            xp: body.xp || 0,
                            fans: body.fans || 0
                        },
                        toUser: {
                            id: toUserId || fromUserId,
                            name: body.toUserName || body.toUser?.name || ''
                        },
                        gift: {
                            id: giftIdStr,
                            name: giftName,
                            icon: giftIcon,
                            price: giftPrice,
                            category: body.giftCategory || 'Popular'
                        },
                        quantity,
                        totalValue,
                        roomId: streamKey,
                        timestamp: new Date().toISOString()
                    });
                    io.emit('live_coins_updated', {
                        streamId: streamKey,
                        coins: totalValue,
                        totalCoins: totalValue,
                        timestamp: new Date().toISOString(),
                        fromUser: body.userName || body.name || '',
                        giftName
                    });
                }
            }
            return res.status(200).json({ code: 0 });
        }
        // ─── new live created / card removed ──────────────────────────────
        if (event.includes('new live') || action === 'new_live' || action === 'live_started') {
            const userId = body.hostId || body.userId || '';
            if (streamKey && userId) {
                const user = await models_1.User.findOne({ id: userId });
                const io = req.app.get('io');
                if (io) {
                    io.emit('new_live', {
                        id: streamKey,
                        hostId: userId,
                        name: user?.name || body.name || 'Live',
                        avatar: user?.avatarUrl || body.avatar || '',
                        isLive: true,
                        streamStatus: 'active',
                        country: user?.country || 'BR',
                        viewers: 0
                    });
                    io.emit('stream_started', {
                        streamId: streamKey,
                        hostId: userId,
                        name: user?.name || body.name || 'Live',
                        avatar: user?.avatarUrl || body.avatar || '',
                        timestamp: new Date().toISOString()
                    });
                }
            }
            return res.status(200).json({ code: 0 });
        }
        if (event.includes('card removed') || action === 'card_removed') {
            const userId = body.hostId || body.userId || '';
            if (streamKey) {
                await models_1.Streamer.findOneAndUpdate({ id: streamKey }, { $set: { isLive: false, streamStatus: 'ended', endTime: new Date() } });
                await models_1.LiveCard.findOneAndUpdate({ hostId: userId || streamKey }, { $set: { isLive: false, streamStatus: 'ended', endTime: new Date(), updatedAt: new Date() } });
                const io = req.app.get('io');
                if (io) {
                    io.emit('card_removed', { streamId: streamKey, hostId: userId, timestamp: new Date().toISOString() });
                    io.emit('stream_ended', { streamId: streamKey, hostId: userId, timestamp: new Date().toISOString() });
                    io.emit('stream_stopped', { streamId: streamKey, hostId: userId, timestamp: new Date().toISOString() });
                }
            }
            return res.status(200).json({ code: 0 });
        }
        // ─── desconhecido — loga e retorna sucesso ────────────────────────
        console.log(`[WEBHOOK-SRS] Evento desconhecido: action=${body.action} event=${body.event}`);
        return res.status(200).json({ code: 0 });
    }
    catch (error) {
        console.error('[WEBHOOK-SRS] Erro no processamento:', error.message);
        return res.status(200).json({ code: 0 });
    }
});
// Webhook do Mercado Pago para receber notificações de pagamento
router.post('/mercadopago', async (req, res) => {
    try {
        // Validar assinatura do webhook
        try {
            mercadopago_1.WebhookSignatureValidator.validate({
                xSignature: req.headers['x-signature'],
                xRequestId: req.headers['x-request-id'],
                dataId: req.query['data.id'],
                secret: process.env.MERCADO_PAGO_WEBHOOK_SECRET || '',
                toleranceSeconds: 300,
            });
        }
        catch (err) {
            console.warn('[WEBHOOK] Assinatura inválida (modo não-bloqueante):', err.reason);
            // Non-blocking: loga mas não rejeita
        }
        console.log('[WEBHOOK] Notificação recebida do Mercado Pago:', JSON.stringify(req.body, null, 2));
        // Verificar se é uma notificação de pagamento
        if (req.body.type === 'payment') {
            const paymentId = req.body.data.id;
            console.log(`[WEBHOOK] Processando pagamento ${paymentId}`);
            // Buscar informações do pagamento usando SDK v3
            const { paymentClient } = await Promise.resolve().then(() => __importStar(require('../config/mercadoPago')));
            const paymentData = await paymentClient.get({ id: paymentId });
            console.log(`[WEBHOOK] Status do pagamento ${paymentId}: ${paymentData.status}`);
            // Procurar ordem associada a este pagamento
            const order = await models_1.Order.findOne({ mpPaymentId: paymentId });
            if (!order) {
                console.log(`[WEBHOOK] Ordem não encontrada para pagamento ${paymentId}`);
                return res.status(404).json({ error: 'Ordem não encontrada' });
            }
            console.log(`[WEBHOOK] Ordem ${order.id} encontrada para pagamento ${paymentId}`);
            // Se o pagamento foi aprovado e a ordem ainda está pendente
            if (paymentData.status === 'approved' && order.status === 'pending') {
                console.log(`[WEBHOOK] Pagamento aprovado! Processando ordem ${order.id}`);
                // Atualizar status da ordem
                await models_1.Order.findOneAndUpdate({ id: order.id }, {
                    $set: {
                        status: 'paid',
                        paymentConfirmationId: paymentId,
                        confirmedAt: new Date(),
                        paymentStatus: 'approved'
                    }
                });
                const io = req.app.get('io');
                if (io) {
                    io.emit('order_updated', { userId: order.userId, orderId: order.id, status: 'paid' });
                }
                // Creditar diamantes para o usuário + persistir atividade
                const User = (await Promise.resolve().then(() => __importStar(require('../models')))).User;
                const user = await User.findOneAndUpdate({ id: order.userId }, {
                    $inc: { diamonds: order.diamonds },
                    $push: {
                        recentActivities: {
                            action: 'webhook_payment_processed',
                            resource: 'webhook_mercadopago',
                            timestamp: new Date(),
                            endpoint: '/api/webhook/mercadopago'
                        }
                    }
                }, { new: true });
                if (!user) {
                    console.log(`[WEBHOOK] Usuário não encontrado: ${order.userId}`);
                    return res.status(404).json({ error: 'Usuário não encontrado' });
                }
                console.log(`[WEBHOOK] SUCESSO! Usuário ${user.name} recebeu ${order.diamonds} diamantes. Saldo atual: ${user.diamonds}`);
                // Registrar compra no histórico
                const PurchaseRecord = (await Promise.resolve().then(() => __importStar(require('../models')))).PurchaseRecord;
                await PurchaseRecord.create({
                    id: `purchase_${order.id}_${Date.now()}`,
                    userId: order.userId,
                    type: 'purchase_diamonds',
                    description: `Compra de ${order.diamonds} diamantes - Pagamento confirmado: ${paymentId}`,
                    amountBRL: order.amount,
                    amountCoins: order.diamonds,
                    status: 'Concluído'
                });
                console.log(`[WEBHOOK] Compra registrada no histórico para usuário ${order.userId}`);
                // Emitir WebSocket para atualizar frontend em tempo real
                if (io) {
                    io.to('user_' + order.userId).emit('diamonds_updated', {
                        userId: order.userId,
                        diamonds: user.diamonds,
                        change: order.diamonds,
                        source: 'purchase'
                    });
                    console.log(`[WEBHOOK] WebSocket emitido para usuário ${order.userId}`);
                }
            }
            else if (paymentData.status === 'rejected' || paymentData.status === 'cancelled') {
                console.log(`[WEBHOOK] Pagamento rejeitado/cancelado: ${paymentId}`);
                // Persistir atividade de pagamento rejeitado
                const User = (await Promise.resolve().then(() => __importStar(require('../models')))).User;
                await User.findOneAndUpdate({ id: order.userId }, {
                    $push: {
                        recentActivities: {
                            action: 'webhook_payment_rejected',
                            resource: 'webhook_mercadopago',
                            timestamp: new Date(),
                            endpoint: '/api/webhook/mercadopago'
                        }
                    }
                }).catch(console.error);
                await models_1.Order.findOneAndUpdate({ id: order.id }, {
                    $set: {
                        status: 'cancelled',
                        paymentStatus: paymentData.status,
                        cancelledAt: new Date()
                    }
                });
                const io2 = req.app.get('io');
                if (io2) {
                    io2.emit('order_updated', { userId: order.userId, orderId: order.id, status: 'cancelled' });
                }
            }
        }
        else if (req.body.type === 'merchant_order') {
            console.log(`[WEBHOOK] Merchant order recebido: ${req.body.data.id}`);
        }
        res.status(200).json({ received: true });
    }
    catch (error) {
        console.error('[WEBHOOK] Erro ao processar webhook:', error);
        res.status(500).json({ error: error.message });
    }
});
// Endpoint para testar webhook
router.post('/test', async (req, res) => {
    try {
        console.log('[WEBHOOK TEST] Notificação de teste recebida');
        // Persistir atividade de teste de webhook
        const User = (await Promise.resolve().then(() => __importStar(require('../models')))).User;
        // Para webhook de teste, podemos persistir para um usuário admin ou genérico
        await User.findOneAndUpdate({ id: 'admin' }, // ou outro identificador de admin
        {
            $push: {
                recentActivities: {
                    action: 'webhook_test_received',
                    resource: 'webhook_system',
                    timestamp: new Date(),
                    endpoint: '/api/webhook/test'
                }
            }
        }).catch(console.error);
        res.status(200).json({ received: true, message: 'Webhook de teste recebido' });
    }
    catch (error) {
        console.error('[WEBHOOK TEST] Erro:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
