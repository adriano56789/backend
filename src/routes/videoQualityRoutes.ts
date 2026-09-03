import express from 'express';
import { VideoQualitySettings } from '../models/VideoQualitySettings';

const router = express.Router();

// GET /api/video-quality/:userId
router.get('/video-quality/:userId', async (req, res) => {
  try {
    const settings = await VideoQualitySettings.getSettings(req.params.userId);
    res.json(settings);
  } catch (error: any) {
    console.error('[VIDEO_QUALITY] GET error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/video-quality/:userId
router.post('/video-quality/:userId', async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings) {
      return res.status(400).json({ error: 'Settings are required' });
    }
    const saved = await VideoQualitySettings.upsertSettings(req.params.userId, settings);
    res.json({ success: true, settings: saved?.settings });
  } catch (error: any) {
    console.error('[VIDEO_QUALITY] POST error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/video-quality/:userId/denoise
router.put('/video-quality/:userId/denoise', async (req, res) => {
  try {
    const { level } = req.body;
    if (typeof level !== 'number' || level < 0 || level > 100) {
      return res.status(400).json({ error: 'Level must be 0-100' });
    }
    const current = await VideoQualitySettings.getSettings(req.params.userId);
    current.denoiseLevel = level;
    const saved = await VideoQualitySettings.upsertSettings(req.params.userId, current);
    res.json({ success: true, settings: saved?.settings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/video-quality/:userId/resolution
router.put('/video-quality/:userId/resolution', async (req, res) => {
  try {
    const { resolution } = req.body;
    const valid = ['1080p', '720p', '480p', '360p', 'auto'];
    if (!valid.includes(resolution)) {
      return res.status(400).json({ error: 'Invalid resolution' });
    }
    const current = await VideoQualitySettings.getSettings(req.params.userId);
    current.resolution = resolution;
    const saved = await VideoQualitySettings.upsertSettings(req.params.userId, current);
    res.json({ success: true, settings: saved?.settings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/video-quality/:userId/reset
router.put('/video-quality/:userId/reset', async (req, res) => {
  try {
    const saved = await VideoQualitySettings.resetSettings(req.params.userId);
    res.json({ success: true, settings: saved?.settings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
