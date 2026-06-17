import express from 'express';
import { Streamer, User } from '../models';

const router = express.Router();

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

        console.log(`[SRS-PUBLISH] stream=${stream} client=${client_id}`);

        if (client_id && isDuplicate(client_id, 'on_publish')) {
            return res.status(200).json({ code: 0 });
        }

        const realStreamKey = stream?.split('?')[0] || stream;

        if (realStreamKey && reconnectionTimers.has(realStreamKey)) {
            const timer = reconnectionTimers.get(realStreamKey);
            clearTimeout(timer!);
            reconnectionTimers.delete(realStreamKey);
            console.log(`[SRS-PUBLISH] Reconexão detectada — stream ${realStreamKey}`);
        }

        // Buscar documento Streamer existente por streamKey ou id
        const existingStream = realStreamKey
            ? await Streamer.findOne({
                $or: [
                    { streamKey: realStreamKey },
                    { id: realStreamKey }
                ]
              }).lean()
            : null;

        let userId: string | null = existingStream?.hostId || null;

        // Se não achou pelo Streamer, tentar pelo User (currentStreamId)
        if (!userId && realStreamKey) {
            const userByStream = await User.findOne({ currentStreamId: realStreamKey }).lean();
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

        // URLs SRS
        const srsHost = process.env.SRS_HOST || '72.60.249.175';
        const srsPort = process.env.SRS_RTMP_PORT || '1935';
        const BACKEND_URL = process.env.BACKEND_URL || 'https://api.livego.store';
        const pushUrl = `rtmp://${srsHost}:${srsPort}/${app || 'live'}/${realStreamKey}`;
        const httpFlvUrl = `${BACKEND_URL}/api/video/http/live/${realStreamKey}.flv`;
        const hlsUrl = `${BACKEND_URL}/api/video/http/live/${realStreamKey}.m3u8`;

        // Criar/atualizar stream no banco com isLive: true
        const streamerData = {
            id: realStreamKey,
            hostId: userId,
            name: user.name || 'Streamer',
            avatar: user.avatarUrl || '',
            location: user.country || 'BR',
            time: 'Ao Vivo',
            message: streamTitle,
            tags: existingStream?.tags || ['live'],
            isLive: true,
            streamStatus: 'active',
            startTime: existingStream?.startTime || new Date(),
            streamKey: realStreamKey,
            title: existingStream?.title || '',
            country: user.country || 'BR',
            rtmpIngestUrl: existingStream?.rtmpIngestUrl || pushUrl,
            playbackUrl: existingStream?.playbackUrl || httpFlvUrl,
            hlsUrl: existingStream?.hlsUrl || hlsUrl,
            vhost: vhost || '__defaultVhost__',
            app: app || 'live',
            stream: realStreamKey
        };

        await Streamer.findOneAndUpdate(
            { id: realStreamKey },
            { $set: streamerData },
            { upsert: true, new: true }
        );

        // Atualizar status do usuário
        await User.findOneAndUpdate(
            { id: userId },
            { $set: { isLive: true, currentStreamId: realStreamKey } }
        );

        console.log(`[SRS-PUBLISH] Transmissão registrada: ${realStreamKey} para usuário ${userId}`);

        // Emitir eventos via socket
        const io = req.app.get('io');
        if (io) {
            io.emit('new_live', {
                id: realStreamKey,
                hostId: userId,
                name: user.name || 'Live',
                avatar: user.avatarUrl || '',
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

        res.status(200).json({ code: 0 });
    } catch (error: any) {
        console.error('[SRS-PUBLISH] Erro:', error.message);
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

        console.log(`[SRS-UNPUBLISH] stream=${stream} client=${client_id}`);

        if (client_id && isDuplicate(client_id, 'on_unpublish')) {
            return res.status(200).json({ code: 0 });
        }

        const realStreamKey = stream?.split('?')[0] || stream;

        if (realStreamKey && reconnectionTimers.has(realStreamKey)) {
            return res.status(200).json({ code: 0 });
        }

        // Atualizar status da stream para offline
        const updated = await Streamer.findOneAndUpdate(
            { id: realStreamKey, isLive: true },
            { $set: { isLive: false, streamStatus: 'ended', endTime: new Date() } }
        );

        if (updated) {
            await User.findOneAndUpdate(
                { id: updated.hostId },
                { $set: { isLive: false, isOnline: false, currentStreamId: null } }
            );

            const io = req.app.get('io');
            if (io) {
                io.emit('card_removed', {
                    streamId: realStreamKey || updated?.id,
                    hostId: updated?.hostId || '',
                    timestamp: new Date().toISOString()
                });
                io.emit('stream_ended', {
                    streamId: realStreamKey || updated?.id,
                    hostId: updated?.hostId || '',
                    timestamp: new Date().toISOString()
                });
                io.emit('stream_stopped', {
                    streamId: realStreamKey || updated?.id,
                    hostId: updated?.hostId || '',
                    timestamp: new Date().toISOString()
                });
            }
        }

        res.status(200).json({ code: 0 });
    } catch (error: any) {
        console.error('[SRS-UNPUBLISH] Erro:', error.message);
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

        console.log(`[SRS-PLAY] stream=${stream} client=${client_id}`);

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

        console.log(`[SRS-STOP] stream=${stream} client=${client_id}`);

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

        console.log(`[SRS-HLS] stream=${stream} seq=${seq_no}`);

        res.status(200).json({ code: 0 });
    } catch (error: any) {
        console.error('[SRS-HLS] Erro:', error.message);
        res.status(200).json({ code: 0 });
    }
});

export default router;
