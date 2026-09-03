import express from 'express';
import { BeautySettings } from '../models/BeautySettings';

const router = express.Router();

const DEFAULTS: Record<string, number> = {
  'Branquear': 42,
  'Alisar a pele': 40,
  'Ruborizar': 32,
  'Contraste': 18,
  'Balanço de Branco': 48,
  'Rosto Bebê': 38,
  'Clarear dentes': 24,
  'Suavizar rugas': 45,
  'Clarear olheiras': 35,
  'Remover manchas': 70,
  'Reduzir brilho': 28,
  'Nitidez': 60,
  'Efeito 3D': 50,
  'Limpar Chiado': 70,
  'Suavização do rosto': 35,
};

// GET /api/beauty-store/:userId
router.get('/beauty-store/:userId', async (req, res) => {
  try {
    const settings = await BeautySettings.getSettingsOnly(req.params.userId);
    res.json({ success: true, settings: Object.keys(settings).length ? settings : DEFAULTS });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/beauty-store/:userId/smooth
router.put('/beauty-store/:userId/smooth', async (req, res) => {
  try {
    const { level } = req.body;
    if (typeof level !== 'number' || level < 0 || level > 100) {
      return res.status(400).json({ error: 'Level must be 0-100' });
    }
    const current = await BeautySettings.getSettingsOnly(req.params.userId);
    const s = Object.keys(current).length ? { ...current } : { ...DEFAULTS };
    s['Alisar a pele'] = level;
    s['Suavização do rosto'] = level;
    await BeautySettings.upsertSettings(req.params.userId, s);
    res.json({ success: true, settings: s });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/beauty-store/:userId/whiten
router.put('/beauty-store/:userId/whiten', async (req, res) => {
  try {
    const { level } = req.body;
    if (typeof level !== 'number' || level < 0 || level > 100) {
      return res.status(400).json({ error: 'Level must be 0-100' });
    }
    const current = await BeautySettings.getSettingsOnly(req.params.userId);
    const s = Object.keys(current).length ? { ...current } : { ...DEFAULTS };
    s['Branquear'] = level;
    await BeautySettings.upsertSettings(req.params.userId, s);
    res.json({ success: true, settings: s });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/beauty-store/:userId/ruddy
router.put('/beauty-store/:userId/ruddy', async (req, res) => {
  try {
    const { level } = req.body;
    if (typeof level !== 'number' || level < 0 || level > 100) {
      return res.status(400).json({ error: 'Level must be 0-100' });
    }
    const current = await BeautySettings.getSettingsOnly(req.params.userId);
    const s = Object.keys(current).length ? { ...current } : { ...DEFAULTS };
    s['Ruborizar'] = level;
    await BeautySettings.upsertSettings(req.params.userId, s);
    res.json({ success: true, settings: s });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/beauty-store/:userId/denoise
router.put('/beauty-store/:userId/denoise', async (req, res) => {
  try {
    const { level } = req.body;
    if (typeof level !== 'number' || level < 0 || level > 100) {
      return res.status(400).json({ error: 'Level must be 0-100' });
    }
    const current = await BeautySettings.getSettingsOnly(req.params.userId);
    const s = Object.keys(current).length ? { ...current } : { ...DEFAULTS };
    s['Limpar Chiado'] = level;
    await BeautySettings.upsertSettings(req.params.userId, s);
    res.json({ success: true, settings: s });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/beauty-store/:userId/sharpness
router.put('/beauty-store/:userId/sharpness', async (req, res) => {
  try {
    const { level } = req.body;
    if (typeof level !== 'number' || level < 0 || level > 100) {
      return res.status(400).json({ error: 'Level must be 0-100' });
    }
    const current = await BeautySettings.getSettingsOnly(req.params.userId);
    const s = Object.keys(current).length ? { ...current } : { ...DEFAULTS };
    s['Nitidez'] = level;
    await BeautySettings.upsertSettings(req.params.userId, s);
    res.json({ success: true, settings: s });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/beauty-store/:userId/reset
router.put('/beauty-store/:userId/reset', async (req, res) => {
  try {
    await BeautySettings.upsertSettings(req.params.userId, { ...DEFAULTS });
    res.json({ success: true, settings: { ...DEFAULTS } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/beauty-store/:userId/all
router.put('/beauty-store/:userId/all', async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings) {
      return res.status(400).json({ error: 'Settings are required' });
    }
    const current = await BeautySettings.getSettingsOnly(req.params.userId);
    const merged = Object.keys(current).length ? { ...current, ...settings } : { ...DEFAULTS, ...settings };
    await BeautySettings.upsertSettings(req.params.userId, merged);
    res.json({ success: true, settings: merged });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
