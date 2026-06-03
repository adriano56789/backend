"use strict";
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
        console.log(`[SRS-PUBLISH] OK server=${server_id} stream=${stream} client=${client_id}`);
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
            await models_1.User.findOneAndUpdate({ id: updated.hostId }, { $set: { isLive: false, currentStreamId: null } });
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
