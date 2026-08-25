import express from 'express';
import { DeviceToken } from '../models/DeviceToken';
import { sendPushNotificationToMultiple, getPublicKey } from '../services/webPushService';
import { getUserIdFromToken } from '../middleware/auth';

const router = express.Router();

// GET /api/notifications/public-key - Chave pública VAPID (pública por natureza)
router.get('/notifications/public-key', (_req, res) => {
  const publicKey = getPublicKey();
  if (!publicKey) {
    return res.status(503).json({ error: 'Push não configurado no servidor' });
  }
  res.json({ publicKey });
});

// POST /api/notifications/register-token - Salvar subscription push do dispositivo
// Body (Web Push nativo): { subscription: { endpoint, keys: { p256dh, auth } }, platform? }
router.post('/notifications/register-token', async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const platform = req.body.platform || 'web';

    // ── Web Push nativo: recebe a PushSubscription completa ──
    const subscription = req.body.subscription;
    if (subscription?.endpoint && subscription?.keys?.p256dh && subscription?.keys?.auth) {
      const endpoint = String(subscription.endpoint);
      const tokenJson = JSON.stringify(subscription);

      await DeviceToken.findOneAndUpdate(
        { endpoint },
        { $set: { userId, token: tokenJson, endpoint, platform } },
        { upsert: true, returnDocument: 'after' }
      );

      console.log(`[WEB-PUSH] Subscription registrada para usuário ${userId}`);
      return res.json({ success: true, endpoint });
    }

    // ── Token legado (FCM antigo): NÃO armazenar mais — só Web Push nativo ──
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Subscription é obrigatória' });
    }
    console.log('[WEB-PUSH] Token legado ignorado (apenas subscriptions Web Push são aceitas)');
    return res.json({ success: true, ignored: true });
  } catch (error: any) {
    console.error('[WEB-PUSH] Erro ao registrar:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/notifications/unregister-token - Remover subscription/token do dispositivo
router.delete('/notifications/unregister-token', async (req, res) => {
  try {
    const { token, endpoint } = req.body;
    if (!token && !endpoint) {
      return res.status(400).json({ error: 'Token ou endpoint é obrigatório' });
    }

    if (endpoint) {
      await DeviceToken.deleteOne({ endpoint });
    } else {
      await DeviceToken.deleteOne({ token });
    }
    console.log('[WEB-PUSH] Subscription removida');
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
