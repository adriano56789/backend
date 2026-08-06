import express from 'express';
import { DeviceToken } from '../models/DeviceToken';
import { sendPushNotification, sendPushNotificationToMultiple } from '../services/firebaseService';
import { getUserIdFromToken } from '../middleware/auth';

const router = express.Router();

// POST /api/notifications/register-token - Salvar token do dispositivo
router.post('/notifications/register-token', async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const { token, platform = 'web' } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token é obrigatório' });
    }

    await DeviceToken.findOneAndUpdate(
      { token },
      { $set: { userId, token, platform } },
      { upsert: true, returnDocument: 'after' }
    );

    console.log(`[FCM] Token registrado para usuário ${userId}`);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[FCM] Erro ao registrar token:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/notifications/unregister-token - Remover token do dispositivo
router.delete('/notifications/unregister-token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token é obrigatório' });
    }

    await DeviceToken.deleteOne({ token });
    console.log('[FCM] Token removido:', token);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/notifications/tokens/:userId - Listar tokens de um usuário
router.get('/notifications/tokens/:userId', async (req, res) => {
  try {
    const tokens = await DeviceToken.find({ userId: req.params.userId }).lean();
    res.json({ success: true, tokens });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/notifications/send - Enviar notificação para um usuário específico
router.post('/notifications/send', async (req, res) => {
  try {
    const adminId = getUserIdFromToken(req);
    if (!adminId) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const { userId, title, body, data } = req.body;
    if (!userId || !title || !body) {
      return res.status(400).json({ error: 'userId, title e body são obrigatórios' });
    }

    const tokens = await DeviceToken.find({ userId }).lean();
    if (tokens.length === 0) {
      return res.json({ success: true, sent: 0, message: 'Usuário não possui dispositivos registrados' });
    }

    const tokenList = tokens.map(t => t.token);
    const failed = await sendPushNotificationToMultiple(tokenList, { title, body, data });

    if (failed.length > 0) {
      const failedTokens = failed.map(f => f.token);
      await DeviceToken.deleteMany({ token: { $in: failedTokens } });
    }

    res.json({ success: true, sent: tokenList.length - failed.length, failed: failed.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/notifications/send-to-all - Enviar para todos os usuários com token (broadcast)
router.post('/notifications/send-to-all', async (req, res) => {
  try {
    const adminId = getUserIdFromToken(req);
    if (!adminId) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const { title, body, data } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: 'title e body são obrigatórios' });
    }

    const allTokens = await DeviceToken.find().lean();
    const tokenList = allTokens.map(t => t.token);

    if (tokenList.length === 0) {
      return res.json({ success: true, sent: 0 });
    }

    const failed = await sendPushNotificationToMultiple(tokenList, { title, body, data });

    if (failed.length > 0) {
      const failedTokens = failed.map(f => f.token);
      await DeviceToken.deleteMany({ token: { $in: failedTokens } });
    }

    res.json({ success: true, sent: tokenList.length - failed.length, failed: failed.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
