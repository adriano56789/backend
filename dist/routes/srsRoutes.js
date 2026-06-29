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
const router = express_1.default.Router();
// Idempotência: evita processar callbacks duplicados do SRS
const processedCallbacks = new Set();
const RECONNECT_WINDOW_MS = 15000;
const reconnectionTimers = new Map();
function isDuplicate(clientId, action) {
    const key = `${action}:${clientId}`;
    if (processedCallbacks.has(key))
        return true;
    processedCallbacks.add(key);
    setTimeout(() => processedCallbacks.delete(key), 5000);
    return false;
}
// POST /api/srs/publish — on_publish
// Doc SRS: https://ossrs.net/lts/en-us/docs/v7/doc/http-callback
router.post('/publish', async (req, res) => {
    try {
        const { server_id, action, client_id, ip, vhost, app, tcUrl, stream, param, stream_url, stream_id } = req.body;
        console.log(`[SRS-PUBLISH] stream=${stream} client=${client_id}`);
        if (client_id && isDuplicate(client_id, 'on_publish')) {
            return res.status(200).json({ code: 0 });
        }
        const realStreamKey = stream?.split('?')[0] || stream;
        if (realStreamKey && reconnectionTimers.has(realStreamKey)) {
            const timer = reconnectionTimers.get(realStreamKey);
            clearTimeout(timer);
            reconnectionTimers.delete(realStreamKey);
            console.log(`[SRS-PUBLISH] Reconexão detectada — stream ${realStreamKey}`);
        }
        // Buscar documento Streamer existente por streamKey ou id
        const existingStream = realStreamKey
            ? await models_1.Streamer.findOne({
                $or: [
                    { streamKey: realStreamKey },
                    { id: realStreamKey }
                ]
            }).lean()
            : null;
        let userId = existingStream?.hostId || null;
        // Se não achou pelo Streamer, tentar pelo User (currentStreamId)
        if (!userId && realStreamKey) {
            const userByStream = await models_1.User.findOne({ currentStreamId: realStreamKey }).lean();
            if (userByStream) {
                userId = userByStream.id;
            }
        }
        if (!userId) {
            console.log(`[SRS-PUBLISH] Nenhum usuário encontrado para streamKey=${realStreamKey}`);
            return res.status(200).json({ code: 0 });
        }
        const user = await models_1.User.findOne({ id: userId });
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
        const finalCategory = (existingStream?.category || 'popular').toLowerCase();
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
            category: finalCategory,
            country: user.country || 'BR',
            rtmpIngestUrl: existingStream?.rtmpIngestUrl || pushUrl,
            playbackUrl: existingStream?.playbackUrl || httpFlvUrl,
            hlsUrl: existingStream?.hlsUrl || hlsUrl,
            vhost: vhost || '__defaultVhost__',
            app: app || 'live',
            stream: realStreamKey
        };
        await models_1.Streamer.findOneAndUpdate({ id: realStreamKey }, { $set: streamerData }, { upsert: true, new: true });
        // Atualizar status do usuário
        await models_1.User.findOneAndUpdate({ id: userId }, { $set: { isLive: true, currentStreamId: realStreamKey } });
        console.log(`[SRS-PUBLISH] Transmissão registrada: ${realStreamKey} para usuário ${userId}`);
        // Criar/atualizar LiveCard
        try {
            const { LiveCard } = await Promise.resolve().then(() => __importStar(require('../models/index')));
            const finalCountry = (existingStream?.country || user.country || 'BR').toLowerCase();
            await LiveCard.findOneAndUpdate({ hostId: userId }, { $set: {
                    hostId: userId,
                    name: user.name || userId,
                    avatar: user.avatarUrl || '',
                    title: existingStream?.title || streamTitle,
                    streamKey: realStreamKey,
                    playbackUrl: existingStream?.playbackUrl || httpFlvUrl,
                    hlsUrl: existingStream?.hlsUrl || hlsUrl,
                    country: finalCountry,
                    isLive: true,
                    streamStatus: 'active',
                    category: finalCategory,
                    startTime: existingStream?.startTime || new Date(),
                    updatedAt: new Date()
                } }, { upsert: true });
        }
        catch (cardErr) {
            console.warn('[SRS-PUBLISH] Erro ao criar/atualizar LiveCard:', cardErr);
        }
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
    }
    catch (error) {
        console.error('[SRS-PUBLISH] Erro:', error.message);
        res.status(200).json({ code: 0 });
    }
});
// POST /api/srs/unpublish — on_unpublish
router.post('/unpublish', async (req, res) => {
    try {
        const { server_id, action, client_id, ip, vhost, app, tcUrl, stream, param, stream_url, stream_id } = req.body;
        console.log(`[SRS-UNPUBLISH] stream=${stream} client=${client_id}`);
        if (client_id && isDuplicate(client_id, 'on_unpublish')) {
            return res.status(200).json({ code: 0 });
        }
        const realStreamKey = stream?.split('?')[0] || stream;
        if (realStreamKey && reconnectionTimers.has(realStreamKey)) {
            return res.status(200).json({ code: 0 });
        }
        // Atualizar status da stream para offline
        const updated = await models_1.Streamer.findOneAndUpdate({ id: realStreamKey, isLive: true }, { $set: { isLive: false, streamStatus: 'ended', endTime: new Date() } });
        if (updated) {
            await models_1.User.findOneAndUpdate({ id: updated.hostId }, { $set: { isLive: false, isOnline: false, currentStreamId: null } });
            // Atualizar LiveCard para ended
            try {
                const { LiveCard } = await Promise.resolve().then(() => __importStar(require('../models/index')));
                await LiveCard.findOneAndUpdate({ hostId: updated.hostId }, { $set: {
                        isLive: false,
                        streamStatus: 'ended',
                        endTime: new Date(),
                        updatedAt: new Date()
                    } });
            }
            catch (cardErr) {
                console.warn('[SRS-UNPUBLISH] Erro ao atualizar LiveCard:', cardErr);
            }
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
    }
    catch (error) {
        console.error('[SRS-UNPUBLISH] Erro:', error.message);
        res.status(200).json({ code: 0 });
    }
});
// POST /api/srs/play — on_play
router.post('/play', async (req, res) => {
    try {
        const { server_id, action, client_id, ip, vhost, app, stream, param, pageUrl, stream_url, stream_id } = req.body;
        console.log(`[SRS-PLAY] stream=${stream} client=${client_id}`);
        res.status(200).json({ code: 0 });
    }
    catch (error) {
        console.error('[SRS-PLAY] Erro:', error.message);
        res.status(200).json({ code: 0 });
    }
});
// POST /api/srs/stop — on_stop
router.post('/stop', async (req, res) => {
    try {
        const { server_id, action, client_id, ip, vhost, app, stream, param, stream_url, stream_id } = req.body;
        console.log(`[SRS-STOP] stream=${stream} client=${client_id}`);
        res.status(200).json({ code: 0 });
    }
    catch (error) {
        console.error('[SRS-STOP] Erro:', error.message);
        res.status(200).json({ code: 0 });
    }
});
// POST /api/srs/hls — on_hls
router.post('/hls', async (req, res) => {
    try {
        const { server_id, action, client_id, ip, vhost, app, stream, param, duration, cwd, file, url, m3u8, m3u8_url, seq_no, stream_url, stream_id } = req.body;
        console.log(`[SRS-HLS] stream=${stream} seq=${seq_no}`);
        res.status(200).json({ code: 0 });
    }
    catch (error) {
        console.error('[SRS-HLS] Erro:', error.message);
        res.status(200).json({ code: 0 });
    }
});
exports.default = router;
