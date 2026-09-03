import express from 'express';
import { CoHostSession } from '../models/CoHostSession';

const router = express.Router();

// POST /api/cohost/create
router.post('/cohost/create', async (req, res) => {
  try {
    const { hostId, streamId } = req.body;
    if (!hostId || !streamId) {
      return res.status(400).json({ error: 'hostId and streamId are required' });
    }
    const session = await CoHostSession.create(hostId, streamId);
    res.json({ success: true, sessionId: session.sessionId, session });
  } catch (error: any) {
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
    const session = await CoHostSession.request(sessionId, coHostId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ success: true, session });
  } catch (error: any) {
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
    const session = await CoHostSession.accept(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ success: true, session });
  } catch (error: any) {
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
    const session = await CoHostSession.reject(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ success: true, session });
  } catch (error: any) {
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
    await CoHostSession.exit(sessionId);
    res.json({ success: true });
  } catch (error: any) {
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
    const session = await CoHostSession.mute(sessionId, muted);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ success: true, session });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/cohost/sessions/:hostId
router.get('/cohost/sessions/:hostId', async (req, res) => {
  try {
    const sessions = await CoHostSession.getSessions(req.params.hostId);
    res.json({ sessions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/cohost/:sessionId
router.delete('/cohost/:sessionId', async (req, res) => {
  try {
    await CoHostSession.delete(req.params.sessionId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
