import express from 'express';
import { Order, Streamer, User, LiveCard, StreamParticipant, StreamLike, GiftTransaction, ChatMessage, Gift } from '../models';
import { isTranscodeVariant } from '../utils/streamKeyUtils';
import { autoEndStreamOnDisconnect } from '../services/streamEndService';
import crypto from 'crypto';

const router = express.Router();

const processedCallbacks = new Set<string>();
const reconnectionTimers = new Map<string, NodeJS.Timeout>();
const RECONNECT_WINDOW_MS = 15000;

function isDuplicate(clientId: string, action: string): boolean {
  const key = `${action}:${clientId}`;
  if (processedCallbacks.has(key)) return true;
  processedCallbacks.add(key);
  setTimeout(() => processedCallbacks.delete(key), 5000);
  return false;
}

// POST /api/webhooks — Webhook unificado para eventos do SRS
router.post('/', async (req, res) => {
    try {
        const body = req.body;
        const {
            server_id,
            action: srsAction,
            client_id,
            ip,
            vhost,
            app,
            tcUrl,
            stream: rawStream,
            param,
            stream_url,
            stream_id,
            event: rawEvent
        } = body;

        const action = (srsAction || '').toLowerCase();
        const event = (rawEvent || '').toLowerCase();
        const streamKey = rawStream?.split('?')[0] || rawStream || body.streamId || '';

        console.log(`[WEBHOOK-SRS] action=${action} event=${event} stream=${streamKey} client=${client_id} ip=${ip}`);

        // ─── on_publish / stream started ───────────────────────────────────
        if (action === 'on_publish' || action === 'publish' || event.includes('stream started') || event.includes('on publish')) {
            // Ignorar streams internas de transcodificação
            if (isTranscodeVariant(streamKey)) {
                console.log(`[WEBHOOK-SRS] ⏭️ Stream transcodificada/variante ignorada: ${streamKey}`);
                return res.status(200).json({ code: 0 });
            }

            if (client_id && isDuplicate(client_id, 'on_publish')) {
                return res.status(200).json({ code: 0 });
            }

            if (streamKey && reconnectionTimers.has(streamKey)) {
                clearTimeout(reconnectionTimers.get(streamKey)!);
                reconnectionTimers.delete(streamKey);
            }

            const existingStream = streamKey
                ? await Streamer.findOne({ $or: [{ streamKey }, { id: streamKey }] }).lean()
                : null;

            let foundUserId = body.hostId || body.userId || existingStream?.hostId || null;

            if (!foundUserId && streamKey) {
                const userByStream = await User.findOne({ currentStreamId: streamKey }).lean();
                if (userByStream) foundUserId = userByStream.id;
            }

            if (!foundUserId) {
                console.log(`[WEBHOOK-SRS] Nenhum usuário encontrado para stream=${streamKey}`);
                return res.status(200).json({ code: 0 });
            }

            const user = await User.findOne({ id: foundUserId });
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

            await Streamer.findOneAndUpdate(
                { id: streamKey },
                { $set: streamerData },
                { upsert: true, returnDocument: 'after' }
            );

            await User.findOneAndUpdate(
                { id: foundUserId },
                { $set: { isLive: true, currentStreamId: streamKey } }
            );

            const finalCountry = (existingStream?.country || user.country || 'BR').toLowerCase();
            await LiveCard.findOneAndUpdate(
                { hostId: foundUserId },
                {
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
                },
                { upsert: true }
            );

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

        // ─── on_unpublish (auto-end com grace period) ────────────────────────
        // Se o host desconectar (saiu da tela, trocou de app, fechou), a live
        // deve ser encerrada. Usamos uma janela curta de reconexão para não
        // derrubar a live em blips rápidos de rede (on_publish limpa o timer).
        if (action === 'on_unpublish' || action === 'unpublish' || event.includes('stream ended') || event.includes('stream stopped') || event.includes('live stream ended') || event.includes('on unpublish')) {
            if (isTranscodeVariant(streamKey)) {
                console.log(`[WEBHOOK-SRS] ⏭️ Stream transcodificada/variante ignorada: ${streamKey}`);
                return res.status(200).json({ code: 0 });
            }

            if (client_id && isDuplicate(client_id, 'on_unpublish')) {
                return res.status(200).json({ code: 0 });
            }

            if (streamKey) {
                const existing = reconnectionTimers.get(streamKey);
                if (existing) clearTimeout(existing);
                const io = req.app.get('io');
                console.log(`[WEBHOOK-SRS] ⏳ Host desconectou — encerra em ${RECONNECT_WINDOW_MS / 1000}s se não reconectar (stream=${streamKey})`);
                const timer = setTimeout(() => {
                    reconnectionTimers.delete(streamKey);
                    console.log(`[WEBHOOK-SRS] ⏰ Host não reconectou — encerrando live ${streamKey}`);
                    autoEndStreamOnDisconnect(streamKey, io);
                }, RECONNECT_WINDOW_MS);
                reconnectionTimers.set(streamKey, timer);
            }
            return res.status(200).json({ code: 0 });
        }

        // ─── on_play / viewer joined ──────────────────────────────────────
        if (action === 'on_play' || action === 'play' || event.includes('viewer joined') || event.includes('user joined')) {
            if (streamKey) {
                const viewerId = body.userId || body.client_id || '';
                if (viewerId) {
                    await StreamParticipant.findOneAndUpdate(
                        { streamId: streamKey, userId: viewerId },
                        {
                            $set: {
                                streamId: streamKey,
                                userId: viewerId,
                                userName: body.userName || body.name || '',
                                userAvatar: body.userAvatar || body.avatar || '',
                                role: 'viewer',
                                joinedAt: new Date()
                            }
                        },
                        { upsert: true }
                    );

                    await Streamer.findOneAndUpdate(
                        { id: streamKey },
                        { $inc: { viewers: 1 } }
                    );
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
                await StreamParticipant.deleteOne({ streamId: streamKey, userId: viewerId });

                await Streamer.findOneAndUpdate(
                    { id: streamKey },
                    { $inc: { viewers: -1 } }
                );
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
            const chatMessage = await ChatMessage.create({
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
                await StreamLike.findOneAndUpdate(
                    { streamId: streamKey, userId },
                    { $set: { streamId: streamKey, userId, createdAt: new Date() } },
                    { upsert: true }
                );

                const totalLikes = await StreamLike.countDocuments({ streamId: streamKey });

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
                let giftObjectId: any = giftIdStr;
                if (giftIdStr) {
                    const giftDoc = await Gift.findOne({ id: giftIdStr }).lean();
                    if (giftDoc) giftObjectId = giftDoc._id;
                }

                const giftName = body.giftName || body.gift?.name || 'Presente';
                const giftIcon = body.giftIcon || body.gift?.icon || '';
                const giftPrice = body.giftPrice || body.gift?.price || 0;
                const quantity = body.quantity || 1;
                const totalValue = giftPrice * quantity;

                const [transaction] = await GiftTransaction.create([{
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
                const user = await User.findOne({ id: userId });
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
                await Streamer.findOneAndUpdate(
                    { id: streamKey },
                    { $set: { isLive: false, streamStatus: 'ended', endTime: new Date() } }
                );
                await LiveCard.findOneAndUpdate(
                    { hostId: userId || streamKey },
                    { $set: { isLive: false, streamStatus: 'ended', endTime: new Date(), updatedAt: new Date() } }
                );

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

    } catch (error: any) {
        console.error('[WEBHOOK-SRS] Erro no processamento:', error.message);
        return res.status(200).json({ code: 0 });
    }
});

// ═══ MERCADO PAGO REMOVIDO — webhook desativado (410 Gone) ═══
router.post('/mercadopago', (_req, res) => {
    res.status(410).json({ gone: true, reason: 'Mercado Pago removido. Provedor atual: Payoneer.' });
});

// ═══ Webhook do Payoneer — eventos de payout (Pix/USD/EUR) ═══
// Configure a URL no painel Payoneer: https://api.livego.store/api/webhooks/payoneer
// Validação: header X-Payoneer-Signature (HMAC-SHA256 do corpo bruto com PAYONEER_WEBHOOK_SECRET)
router.post('/payoneer', express.raw({ type: '*/*' }), async (req, res) => {
    try {
        const secret = process.env.PAYONEER_WEBHOOK_SECRET;
        if (secret) {
            const signature = String(req.headers['x-payoneer-signature'] || '');
            const expected = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
            if (signature !== expected) {
                console.warn('[WEBHOOK PAYONEER] Assinatura inválida — rejeitado');
                return res.status(401).json({ error: 'Assinatura inválida' });
            }
        }

        let event: any = req.body;
        if (Buffer.isBuffer(event)) {
            try { event = JSON.parse(event.toString('utf8')); } catch { event = {}; }
        }
        console.log('[WEBHOOK PAYONEER] Evento recebido:', JSON.stringify(event));

        // ── DEPÓSITOS / CHECKOUT (compra de diamantes) ──
        // Reconhece sessões criadas por createDepositSession (reference=livego_ord_<orderId>).
        const data = event?.data || event || {};
        const reference: string = String(data?.reference || event?.reference || data?.metadata?.reference || '');
        const orderIdFromRef = reference.startsWith('livego_ord_') ? reference.slice('livego_ord_'.length) : '';
        const orderIdMeta: string = String(data?.metadata?.order_id || event?.metadata?.order_id || '');
        const sessionId: string = String(data?.session_id || data?.sessionId || event?.session_id || '');
        const payStatusRaw: string = String(
            data?.status || data?.payment_status || data?.paymentStatus ||
            event?.status || event?.payment_status || event?.paymentStatus || ''
        ).toUpperCase();
        const approvedStatuses = ['APPROVED', 'COMPLETED', 'SUCCEEDED', 'PAID', 'SUCCESS', 'CHARGE_SUCCESSFUL', 'CHECKOUT_SESSION_APPROVED'];
        const failedStatuses = ['FAILED', 'REJECTED', 'DECLINED', 'CANCELLED', 'CANCELED', 'EXPIRED', 'REFUSED'];

        const depositOrderId = orderIdFromRef || orderIdMeta;
        if (depositOrderId) {
            const Order = (await import('../models')).Order;
            let order = await Order.findOne({ id: depositOrderId });
            if (!order && sessionId) {
                order = await Order.findOne({ paymentSessionId: sessionId });
            }
            if (order && order.status === 'pending') {
                if (approvedStatuses.includes(payStatusRaw)) {
                    try {
                        const { completeOrderPayment } = await import('../services/purchaseCompletionService');
                        const result = await completeOrderPayment({
                            orderId: order.id,
                            paymentConfirmationId: sessionId || reference || payStatusRaw,
                        });
                        console.log(`[WEBHOOK PAYONEER] Depósito aprovado — compra ${order.id} concluída:`, result.success);
                    } catch (err: any) {
                        console.error('[WEBHOOK PAYONEER] Erro ao concluir compra por depósito:', err?.message);
                    }
                } else if (failedStatuses.includes(payStatusRaw)) {
                    await Order.findOneAndUpdate(
                        { id: order.id },
                        { $set: { status: 'failed', paymentStatus: 'rejected' } }
                    ).catch(() => {});
                    console.log(`[WEBHOOK PAYONEER] Depósito ${order.id} → ${payStatusRaw}`);
                }
            }
        }

        // Estrutura típica: { payout_id, status, ... } ou { event_type, data }
        const payoutId = event?.payout_id || event?.data?.payout_id;
        const payoutStatus = String(event?.status || event?.data?.status || '').toUpperCase();

        if (payoutId && ['COMPLETED', 'FAILED', 'REJECTED'].includes(payoutStatus)) {
            const PurchaseRecord = (await import('../models')).PurchaseRecord;
            await PurchaseRecord.findOneAndUpdate(
                { 'metadata.payoutId': payoutId },
                {
                    $set: {
                        status: payoutStatus === 'COMPLETED' ? 'Concluído' : 'Falhou',
                        'metadata.payoneer_status': payoutStatus,
                    },
                }
            ).catch(() => {});
            console.log(`[WEBHOOK PAYONEER] Payout ${payoutId} → ${payoutStatus}`);
        }

        res.status(200).json({ received: true });
    } catch (error: any) {
        console.error('[WEBHOOK PAYONEER] Erro:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para testar webhook
router.post('/test', async (req, res) => {
    try {
        console.log('[WEBHOOK TEST] Notificação de teste recebida');
        
        // Persistir atividade de teste de webhook
        const User = (await import('../models')).User;
        // Para webhook de teste, podemos persistir para um usuário admin ou genérico
        await User.findOneAndUpdate(
            { id: 'admin' }, // ou outro identificador de admin
            { 
                $push: { recentActivities: { $each: [{
                        action: 'webhook_test_received',
                        resource: 'webhook_system',
                        timestamp: new Date(),
                        endpoint: '/api/webhook/test'
                    }], $slice: -50 } }
            }
        ).catch(console.error);
        
        res.status(200).json({ received: true, message: 'Webhook de teste recebido' });
    } catch (error: any) {
        console.error('[WEBHOOK TEST] Erro:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
