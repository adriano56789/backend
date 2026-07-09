import express from 'express';
import { Streamer, User, Followers } from '../models';
import { startStreamTranscode, stopStreamTranscode } from '../services/FfmpegService';

const router = express.Router();

const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?name=User&background=7c3aed&color=fff&size=100';

function resolveAvatar(user: any): string {
  if (user.avatarUrl && user.avatarUrl.trim() !== '') return user.avatarUrl;
  if (user.name && user.name.trim() !== '') {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=7c3aed&color=fff&size=100`;
  }
  return DEFAULT_AVATAR;
}

// Idempotência: evita processar callbacks duplicados do SRS
const processedCallbacks = new Set<string>();
const RECONNECT_WINDOW_MS = 15000;
const reconnectionTimers = new Map<string, NodeJS.Timeout>();

function isDuplicate(clientId: string, action: string): boolean {
  const key = `${action}:${clientId}`;
  if (processedCallbacks.has(key)) return true;
  processedCallbacks.add(key);
  setTimeout(() => processedCallbacks.delete(key), 5000);
  return false;
}

// POST /api/srs/publish — on_publish
// Doc SRS: https://ossrs.net/lts/en-us/docs/v7/doc/http-callback
router.post('/publish', async (req, res) => {
    try {
        const {
            server_id,
            action,
            client_id,
            ip,
            vhost,
            app,
            tcUrl,
            stream,
            param,
            stream_url,
            stream_id
        } = req.body;

        console.log(`[SRS-PUBLISH] 🔴 Webhook on_publish recebido do SRS! stream=${stream}, client=${client_id}, ip=${ip}, app=${app}`);
        console.log(`[SRS-PUBLISH] ➡️ Etapa 1/4: SRS confirmou que a stream foi publicada. Iniciando processamento...`);

        const realStreamKey = stream?.split('?')[0] || stream;

        // Ignorar streams internas de transcodificação logo no início
        if (realStreamKey && realStreamKey.endsWith('_transcoded')) {
            console.log(`[SRS-PUBLISH] ⏭️ Stream transcodificada ignorada: ${realStreamKey}`);
            return res.status(200).json({ code: 0 });
        }

        if (client_id && isDuplicate(client_id, 'on_publish')) {
            console.log(`[SRS-PUBLISH] ⏭️ Callback duplicado ignorado (client_id=${client_id})`);
            return res.status(200).json({ code: 0 });
        }

        // Normalizar: remover prefixo 'stream_' para compatibilidade com IDs salvos
        const normalizedId = realStreamKey?.startsWith('stream_') ? realStreamKey.replace('stream_', '') : realStreamKey;

        if (realStreamKey && reconnectionTimers.has(realStreamKey)) {
            const timer = reconnectionTimers.get(realStreamKey);
            clearTimeout(timer!);
            reconnectionTimers.delete(realStreamKey);
            console.log(`[SRS-PUBLISH] Reconexão detectada — stream ${realStreamKey}`);
        }

        // Buscar documento Streamer existente por streamKey, id (normalizada) ou normalizedId
        const existingStream = realStreamKey
            ? await Streamer.findOne({
                $or: [
                    { streamKey: realStreamKey },
                    { id: realStreamKey },
                    ...(normalizedId !== realStreamKey ? [{ id: normalizedId }] : [])
                ]
              }).lean()
            : null;

        let userId: string | null = existingStream?.hostId || null;

        // Se não achou pelo Streamer, tentar pelo User (currentStreamId)
        if (!userId && realStreamKey) {
            const userByStream = await User.findOne({
                $or: [
                    { currentStreamId: realStreamKey },
                    ...(normalizedId !== realStreamKey ? [{ currentStreamId: normalizedId }] : [])
                ]
            }).lean();
            if (userByStream) {
                userId = userByStream.id;
            }
        }

        if (!userId) {
            console.log(`[SRS-PUBLISH] Nenhum usuário encontrado para streamKey=${realStreamKey}`);
            return res.status(200).json({ code: 0 });
        }

        const user = await User.findOne({ id: userId });
        if (!user) {
            console.log(`[SRS-PUBLISH] Usuário não encontrado: ${userId}`);
            return res.status(200).json({ code: 0 });
        }

        const streamTitle = existingStream?.title || existingStream?.message || `Live de ${user.name || 'Streamer'}`;
        const finalCategory = (existingStream?.category || 'popular').toLowerCase();
        const liveApp = app || 'live';

        const rtmpIngestUrl = existingStream?.rtmpIngestUrl
            || (tcUrl ? `${tcUrl}/${realStreamKey}` : null)
            || `rtmp://${process.env.SRS_HOST || 'rtc.livego.store'}:${process.env.SRS_RTMP_PORT || '1935'}/${liveApp}/${realStreamKey}`;
        const playbackUrl = existingStream?.playbackUrl
            || stream_url
            || `${process.env.BACKEND_URL || 'https://api.livego.store'}/api/video/http/live/${realStreamKey}.flv`;
        const hlsUrl = existingStream?.hlsUrl
            || `${process.env.BACKEND_URL || 'https://api.livego.store'}/api/video/http/live/${realStreamKey}.m3u8`;

        // CRÍTICO: usar normalizedId (sem prefixo stream_) para o campo id,
        // pois todas as rotas backend usam router.param('id') que remove o prefixo,
        // e o frontend constrói URLs com stream_<userId>
        const storedId = normalizedId || realStreamKey;

        const whipUrl = `${process.env.BACKEND_URL || 'https://api.livego.store'}/api/rtc/v1/whip/?app=${liveApp}&stream=${encodeURIComponent(realStreamKey)}`;
        const whepUrl = `${process.env.BACKEND_URL || 'https://api.livego.store'}/api/rtc/v1/whep/?app=${liveApp}&stream=${encodeURIComponent(realStreamKey)}`;
        const webrtcUrl = `webrtc://${process.env.SRS_HOST || 'srs'}:8000/live/${realStreamKey}`;
        const flvUrl = `${process.env.BACKEND_URL || 'https://api.livego.store'}/api/video/http/live/${realStreamKey}.flv`;

        const streamerData = {
            id: storedId,
            hostId: userId,
            srsAction: action,
            clientIp: ip,
            name: user.name || 'Streamer',
            avatar: resolveAvatar(user),
            location: user.country || 'BR',
            time: 'Ao Vivo',
            message: streamTitle,
            tags: existingStream?.tags || ['live'],
            isLive: true,
            streamStatus: 'active',
            startTime: existingStream?.startTime || new Date(),
            streamKey: realStreamKey,
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
            webrtcUrl,
            flvUrl,
            whipUrl,
            whepUrl,
            vhost: vhost || '__defaultVhost__',
            app: liveApp,
            stream: realStreamKey,
            liveId: storedId,
            srsClientId: client_id,
            webrtcSessionId: stream_id || client_id,
            srsPublishData: {
                server_id, action, client_id, ip, vhost, app,
                tcUrl, stream, param, stream_url, stream_id
            }
        };

        await Streamer.findOneAndUpdate(
            { id: storedId },
            { $set: streamerData },
            { upsert: true, returnDocument: 'after' }
        );

        // Atualizar status do usuário
        await User.findOneAndUpdate(
            { id: userId },
            { $set: { isLive: true, currentStreamId: storedId } }
        );

        console.log(`[SRS-PUBLISH] Transmissão registrada: ${realStreamKey} para usuário ${userId}`);

        // Criar/atualizar LiveCard
        try {
            const { LiveCard } = await import('../models/index');
            const finalCountry = (existingStream?.country || user.country || 'BR').toLowerCase();
            await LiveCard.findOneAndUpdate(
                { hostId: userId },
                { $set: {
                    hostId: userId,
                    name: user.name || userId,
                    avatar: resolveAvatar(user),
                    title: existingStream?.title || streamTitle,
                    streamKey: realStreamKey,
                    playbackUrl,
                    hlsUrl,
                    webrtcUrl,
                    flvUrl,
                    country: finalCountry,
                    isLive: true,
                    streamStatus: 'active',
                    category: finalCategory,
                    startTime: existingStream?.startTime || new Date(),
                    updatedAt: new Date()
                } },
                { upsert: true }
            );
        } catch (cardErr) {
            console.warn('[SRS-PUBLISH] Erro ao criar/atualizar LiveCard:', cardErr);
        }

        // Emitir eventos via socket
        const io = req.app.get('io');
        if (io) {
            io.emit('new_live', {
                id: realStreamKey,
                hostId: userId,
                name: user.name || 'Live',
                avatar: resolveAvatar(user),
                isLive: true,
                streamStatus: 'active',
                country: user.country || 'BR',
                viewers: 0,
                timestamp: new Date().toISOString()
            });
            io.emit('stream_started', {
                streamId: realStreamKey,
                hostId: userId,
                name: user.name || 'Live',
                avatar: user.avatarUrl || '',
                timestamp: new Date().toISOString()
            });
        }

        // Notificar seguidores via serviço centralizado
        try {
            const followers = await Followers.find({
                followingId: userId,
                isActive: true
            }).select('followerId').lean();
            if (followers.length > 0) {
                const followerIds = followers.map(f => f.followerId);
                const { NotificationService } = await import('../services/NotificationService');
                await NotificationService.notifyLiveStarted(
                    io,
                    userId,
                    user.name || 'LiveGO',
                    user.avatarUrl || '',
                    realStreamKey,
                    followerIds
                );
            }
        } catch (notifErr: any) {
            console.warn('[SRS-PUBLISH] Erro ao notificar seguidores:', notifErr.message);
        }

        // Iniciar FFmpeg para transcodificação da stream
        console.log(`[SRS-PUBLISH] ➡️ Etapa 4/4: Solicitando início do FFmpeg transcoding para stream=${realStreamKey}...`);
        try {
            const result = await startStreamTranscode(realStreamKey);
            console.log(`[SRS-PUBLISH] ✅ FFmpeg transcoding iniciado para ${realStreamKey}. Fonte: ${result.source}`);
            console.log(`[SRS-PUBLISH] 📺 Transmissão disponível para espectadores via HLS/FLV/WHEP`);
        } catch (ffErr: any) {
            console.warn(`[SRS-PUBLISH] ⚠️ FFmpeg não disponível para ${realStreamKey}:`, ffErr.message);
        }

        res.status(200).json({ code: 0 });
    } catch (error: any) {
        console.error('[SRS-PUBLISH] ❌ Erro no webhook on_publish:', error.message);
        res.status(200).json({ code: 0 });
    }
});

// POST /api/srs/unpublish — on_unpublish
router.post('/unpublish', async (req, res) => {
    try {
        const {
            server_id,
            action,
            client_id,
            ip,
            vhost,
            app,
            tcUrl,
            stream,
            param,
            stream_url,
            stream_id
        } = req.body;

        console.log(`[SRS-UNPUBLISH] 🔴 Webhook on_unpublish recebido! stream=${stream}, client=${client_id}`);
        console.log(`[SRS-UNPUBLISH] ➡️ Etapa 1/2: Stream ${stream} encerrada. Iniciando cleanup...`);

        const realStreamKey = stream?.split('?')[0] || stream;

        // Ignorar streams internas de transcodificação
        if (realStreamKey && realStreamKey.endsWith('_transcoded')) {
            console.log(`[SRS-UNPUBLISH] ⏭️ Stream transcodificada ignorada: ${realStreamKey}`);
            return res.status(200).json({ code: 0 });
        }

        if (client_id && isDuplicate(client_id, 'on_unpublish')) {
            console.log(`[SRS-UNPUBLISH] ⏭️ Callback duplicado ignorado`);
            return res.status(200).json({ code: 0 });
        }
        // Normalizar: remover prefixo 'stream_' para compatibilidade
        const normalizedId = realStreamKey?.startsWith('stream_') ? realStreamKey.replace('stream_', '') : realStreamKey;
        const storedId = normalizedId || realStreamKey;

        if (realStreamKey && reconnectionTimers.has(realStreamKey)) {
            console.log(`[SRS-UNPUBLISH] ⏭️ Reconexão em andamento, ignorando unpublish`);
            return res.status(200).json({ code: 0 });
        }

        // Atualizar status da stream para offline
        const updated = await Streamer.findOneAndUpdate(
            { id: storedId, isLive: true },
            { $set: {
                isLive: false,
                streamStatus: 'ended',
                endTime: new Date(),
                srsUnpublishData: {
                    server_id, action, client_id, ip, vhost, app,
                    tcUrl, stream, param, stream_url, stream_id
                }
            } }
        );

        if (updated) {
            await User.findOneAndUpdate(
                { id: updated.hostId },
                { $set: { isLive: false, isOnline: false, currentStreamId: null } }
            );

            // Atualizar LiveCard para ended
            try {
                const { LiveCard } = await import('../models/index');
                await LiveCard.findOneAndUpdate(
                    { hostId: updated.hostId },
                    { $set: {
                        isLive: false,
                        streamStatus: 'ended',
                        endTime: new Date(),
                        updatedAt: new Date()
                    } }
                );
            } catch (cardErr) {
                console.warn('[SRS-UNPUBLISH] Erro ao atualizar LiveCard:', cardErr);
            }

            const io = req.app.get('io');
            if (io) {
                io.emit('card_removed', {
                    streamId: storedId,
                    hostId: updated?.hostId || '',
                    timestamp: new Date().toISOString()
                });
                io.emit('stream_ended', {
                    streamId: storedId,
                    hostId: updated?.hostId || '',
                    timestamp: new Date().toISOString()
                });
                io.emit('stream_stopped', {
                    streamId: storedId,
                    hostId: updated?.hostId || '',
                    timestamp: new Date().toISOString()
                });
            }
        }

        // Parar FFmpeg transcoding
        if (realStreamKey) {
            console.log(`[SRS-UNPUBLISH] ➡️ Etapa 2/2: Parando FFmpeg transcoding para ${realStreamKey}...`);
            const result = await stopStreamTranscode(realStreamKey);
            console.log(`[SRS-UNPUBLISH] ✅ FFmpeg transcoding parado para ${realStreamKey}. Fonte: ${result.source}`);
        }

        res.status(200).json({ code: 0 });
    } catch (error: any) {
        console.error('[SRS-UNPUBLISH] ❌ Erro:', error.message);
        res.status(200).json({ code: 0 });
    }
});

// POST /api/srs/play — on_play
router.post('/play', async (req, res) => {
    try {
        const {
            server_id,
            action,
            client_id,
            ip,
            vhost,
            app,
            stream,
            param,
            pageUrl,
            stream_url,
            stream_id
        } = req.body;

        const playStreamKey = stream?.split('?')[0] || stream;
        if (playStreamKey && playStreamKey.endsWith('_transcoded')) {
            return res.status(200).json({ code: 0 });
        }

        console.log(`[SRS-PLAY] stream=${stream} client=${client_id} server=${server_id} action=${action} ip=${ip} vhost=${vhost} app=${app} pageUrl=${pageUrl} stream_url=${stream_url} stream_id=${stream_id}`);

        res.status(200).json({ code: 0 });
    } catch (error: any) {
        console.error('[SRS-PLAY] Erro:', error.message);
        res.status(200).json({ code: 0 });
    }
});

// POST /api/srs/stop — on_stop
router.post('/stop', async (req, res) => {
    try {
        const {
            server_id,
            action,
            client_id,
            ip,
            vhost,
            app,
            stream,
            param,
            stream_url,
            stream_id
        } = req.body;

        const stopStreamKey = stream?.split('?')[0] || stream;
        if (stopStreamKey && stopStreamKey.endsWith('_transcoded')) {
            return res.status(200).json({ code: 0 });
        }

        console.log(`[SRS-STOP] stream=${stream} client=${client_id} server=${server_id} action=${action} ip=${ip} vhost=${vhost} app=${app} param=${param} stream_url=${stream_url} stream_id=${stream_id}`);

        res.status(200).json({ code: 0 });
    } catch (error: any) {
        console.error('[SRS-STOP] Erro:', error.message);
        res.status(200).json({ code: 0 });
    }
});

// POST /api/srs/hls — on_hls
router.post('/hls', async (req, res) => {
    try {
        const {
            server_id,
            action,
            client_id,
            ip,
            vhost,
            app,
            stream,
            param,
            duration,
            cwd,
            file,
            url,
            m3u8,
            m3u8_url,
            seq_no,
            stream_url,
            stream_id
        } = req.body;

        const hlsStreamKey = stream?.split('?')[0] || stream;
        if (hlsStreamKey && hlsStreamKey.endsWith('_transcoded')) {
            return res.status(200).json({ code: 0 });
        }

        console.log(`[SRS-HLS] stream=${stream} seq=${seq_no} server=${server_id} action=${action} client=${client_id} ip=${ip} vhost=${vhost} app=${app} param=${param} duration=${duration} cwd=${cwd} file=${file} url=${url} m3u8=${m3u8} m3u8_url=${m3u8_url} stream_url=${stream_url} stream_id=${stream_id}`);

        res.status(200).json({ code: 0 });
    } catch (error: any) {
        console.error('[SRS-HLS] Erro:', error.message);
        res.status(200).json({ code: 0 });
    }
});

// POST /api/srs/publish/:streamKey — WHIP publish (SDP exchange)
router.post('/publish/:streamKey', async (req, res) => {
    try {
        const { streamKey } = req.params;
        const { sdp } = req.body;

        if (!sdp) {
            return res.status(400).json({ success: false, error: 'SDP is required' });
        }

        console.log(`[SRS-WHIP] Recebendo SDP para publish stream=${streamKey}`);

        res.json({
            success: true,
            sdp: sdp,
            sessionid: `session_${streamKey}_${Date.now()}`
        });
    } catch (error: any) {
        console.error('[SRS-WHIP] Erro:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/srs/play/:streamKey — WHEP play (SDP exchange)
router.post('/play/:streamKey', async (req, res) => {
    try {
        const { streamKey } = req.params;
        const { sdp } = req.body;

        if (!sdp) {
            return res.status(400).json({ success: false, error: 'SDP is required' });
        }

        console.log(`[SRS-WHEP] Recebendo SDP para play stream=${streamKey}`);

        res.json({
            success: true,
            sdp: sdp,
            sessionid: `session_${streamKey}_${Date.now()}`
        });
    } catch (error: any) {
        console.error('[SRS-WHEP] Erro:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/srs/close/:streamKey — Close session
router.post('/close/:streamKey', async (req, res) => {
    try {
        const { streamKey } = req.params;
        const { sessionid } = req.body;

        console.log(`[SRS-CLOSE] Fechando sessão ${sessionid} para stream=${streamKey}`);

        res.json({ success: true });
    } catch (error: any) {
        console.error('[SRS-CLOSE] Erro:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
