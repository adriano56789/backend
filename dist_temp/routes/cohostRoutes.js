"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const CoHostSession_1 = require("../models/CoHostSession");
const router = express_1.default.Router();
// POST /api/cohost/create
router.post('/cohost/create', async (req, res) => {
    try {
        const { hostId, streamId } = req.body;
        if (!hostId || !streamId) {
            return res.status(400).json({ error: 'hostId and streamId are required' });
        }
        const session = await CoHostSession_1.CoHostSession.create(hostId, streamId);
        res.json({ success: true, sessionId: session.sessionId, session });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// PUT /api/cohost/request
router.put('/cohost/request', async (req, res) => {
    try {
        const { sessionId, coHostId } = req.body;
        if (!sessionId || !coHostId) {
            return res.status(400).json({ error: 'sessionId and coHostId are required' });
        }
        const session = await CoHostSession_1.CoHostSession.request(sessionId, coHostId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        res.json({ success: true, session });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// PUT /api/cohost/accept
router.put('/cohost/accept', async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId is required' });
        }
        const session = await CoHostSession_1.CoHostSession.accept(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        res.json({ success: true, session });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// PUT /api/cohost/reject
router.put('/cohost/reject', async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId is required' });
        }
        const session = await CoHostSession_1.CoHostSession.reject(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        res.json({ success: true, session });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// PUT /api/cohost/exit
router.put('/cohost/exit', async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId is required' });
        }
        await CoHostSession_1.CoHostSession.exit(sessionId);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// PUT /api/cohost/mute
router.put('/cohost/mute', async (req, res) => {
    try {
        const { sessionId, muted } = req.body;
        if (!sessionId || typeof muted !== 'boolean') {
            return res.status(400).json({ error: 'sessionId and muted (boolean) required' });
        }
        const session = await CoHostSession_1.CoHostSession.mute(sessionId, muted);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        res.json({ success: true, session });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// GET /api/cohost/sessions/:hostId
router.get('/cohost/sessions/:hostId', async (req, res) => {
    try {
        const sessions = await CoHostSession_1.CoHostSession.getSessions(req.params.hostId);
        res.json({ sessions });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// DELETE /api/cohost/:sessionId
router.delete('/cohost/:sessionId', async (req, res) => {
    try {
        await CoHostSession_1.CoHostSession.delete(req.params.sessionId);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
