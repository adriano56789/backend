"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateStreamKey = void 0;
const models_1 = require("../models");
const auth_1 = require("./auth");
const validateStreamKey = async (req, res, next) => {
    const { streamUrl, streamKey } = req.body;
    if (!streamKey) {
        return res.status(403).json({ error: 'Stream key required' });
    }
    // Extrair streamId: webrtc://server/live/streamId
    const streamId = streamUrl.split('/').pop();
    if (!streamId) {
        return res.status(400).json({ error: 'Invalid stream URL' });
    }
    try {
        const stream = await models_1.Streamer.findOne({ id: streamId, streamKey });
        if (!stream) {
            return res.status(403).json({ error: 'Invalid stream key' });
        }
        const userId = (0, auth_1.getUserIdFromToken)(req);
        if (stream.hostId !== userId) {
            return res.status(403).json({ error: 'Only stream owner can publish' });
        }
        req.stream = stream;
        next();
    }
    catch (error) {
        console.error('[StreamAuth] Error validating stream key:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.validateStreamKey = validateStreamKey;
