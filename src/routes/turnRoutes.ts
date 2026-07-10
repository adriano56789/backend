import express from 'express';
import crypto from 'crypto';
import { User } from '../models';
import Security from '../utils/Security';
import { ENV } from '../config/env';
import { turnSecurityMiddleware } from '../middleware/TurnSecurity';
import { pushRecentActivity } from '../utils/activityHelpers';

const router = express.Router();

// NOTA: middleware de segurança TURN aplicado individualmente em cada rota
// para evitar bloquear outras rotas sob o mesmo prefixo /api

interface ActiveCredential {
  username: string;
  credential: string;
  expiry: number;
  userId: string;
  streamId: string;
  region: string;
}

interface RecentActivity {
  action: string;
  resource?: string;
  timestamp?: Date;
  endpoint?: string;
}

const activeCredentials = new Map<string, ActiveCredential>();
const requestTracker = new Map<string, number>();

const TURN_SECRET = ENV.TURN_SECRET || 'dev_turn_secret_key_change_me';
const TURN_HOST = process.env.TURN_HOST || '2.25.192.154';
const TURN_PORT = process.env.TURN_PORT || '3478';

interface TurnConfig {
  urls: string[];
  maxConnections: number;
  secret: string;
}

const TURN_CONFIGS: Record<string, TurnConfig> = {
  BR: { urls: [`turn:${TURN_HOST}:${TURN_PORT}`], maxConnections: 2000, secret: TURN_SECRET },
  US: { urls: [`turn:${TURN_HOST}:${TURN_PORT}`], maxConnections: 2000, secret: TURN_SECRET },
  EU: { urls: [`turn:${TURN_HOST}:${TURN_PORT}`], maxConnections: 2000, secret: TURN_SECRET },
};

// Helper para registrar atividade recente no User (usa o helper compartilhado)

// POST /api/turn/credentials
router.post('/turn/credentials', turnSecurityMiddleware, async (req, res) => {
  try {
    const { userId, streamId, region = 'BR' } = req.body;
    const clientIP = req.ip || req.socket.remoteAddress || 'unknown';

    if (!userId || !streamId) {
      return res.status(400).json({ error: 'userId and streamId are required' });
    }

    // Rate limiting: 1 requisição por minuto por usuário
    const rateKey = `${userId}_${clientIP}`;
    const lastRequest = requestTracker.get(rateKey) || 0;
    const now = Date.now();

    if (now - lastRequest < 60000) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((60000 - (now - lastRequest)) / 1000),
      });
    }
    requestTracker.set(rateKey, now);

    // Detecção de abuso
    const recentRequests = Security.getRecentRequests(userId, requestTracker);
    if (Security.detectAbuse(userId, recentRequests)) {
      await Security.blockAbusiveUser(userId, 'Abuso detectado - TURN credentials');
      return res.status(403).json({ error: 'Abuse detected' });
    }

    const user = await User.findOne({ id: userId });
    if (!user) return res.status(401).json({ error: 'Unauthorized - User not found' });
    if (user.currentStreamId !== streamId) {
      return res.status(403).json({ error: 'Forbidden - Stream access denied' });
    }

    const turnConfig = TURN_CONFIGS[region] || TURN_CONFIGS.BR;
    const ttl = 5 * 60;
    const expiry = now + (ttl * 1000);
    // Formato padrão Coturn REST API: username=<timestamp>:<userId>
    // HMAC-SHA1(secret, <timestamp>:<userId>) = credential
    const timestamp = Math.floor(now / 1000) + ttl;
    const temporaryUsername = `${timestamp}:${userId}`;
    const temporaryCredential = crypto.createHmac('sha1', turnConfig.secret)
      .update(temporaryUsername)
      .digest('base64');

    // Limpar credenciais expiradas deste usuário
    for (const [key, cred] of activeCredentials.entries()) {
      if (cred.userId === userId && cred.expiry < now) activeCredentials.delete(key);
    }

    const credentialKey = `${userId}_${streamId}_${region}`;
    activeCredentials.set(credentialKey, {
      username: temporaryUsername,
      credential: temporaryCredential,
      expiry, userId, streamId, region,
    });

    setTimeout(() => { activeCredentials.delete(credentialKey); }, 5 * 60 * 1000);

    await pushRecentActivity(userId, {
      action: 'turn_credentials_generated',
      resource: 'turn_server',
      timestamp: new Date(),
      endpoint: '/api/turn/credentials',
    });

    res.json({
      username: temporaryUsername,
      credential: temporaryCredential,
      urls: turnConfig.urls,
      ttl,
      expiry: new Date(expiry).toISOString(),
      region,
      maxConnections: turnConfig.maxConnections,
    });
  } catch (error) {
    console.error('[TURN CREDS] Erro:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/turn/validate
router.post('/turn/validate', turnSecurityMiddleware, async (req, res) => {
  try {
    const { username, credential, region = 'BR' } = req.body;

    if (!username || !credential) {
      return res.status(400).json({ error: 'username and credential are required' });
    }

    let foundCredentials: ActiveCredential | null = null;
    for (const [, cred] of activeCredentials.entries()) {
      if (cred.username === username && cred.credential === credential && cred.region === region) {
        foundCredentials = cred;
        break;
      }
    }

    if (!foundCredentials) return res.status(401).json({ error: 'Invalid credentials' });

    if (foundCredentials.expiry < Date.now()) {
      activeCredentials.delete(`${foundCredentials.userId}_${foundCredentials.streamId}_${foundCredentials.region}`);
      return res.status(401).json({ error: 'Credentials expired' });
    }

    await pushRecentActivity(foundCredentials.userId, {
      action: 'turn_credentials_validated',
      resource: 'turn_server',
      timestamp: new Date(),
      endpoint: '/api/turn/validate',
    });

    res.json({
      valid: true,
      remainingTime: Math.max(0, foundCredentials.expiry - Date.now()),
      userId: foundCredentials.userId,
      streamId: foundCredentials.streamId,
    });
  } catch (error) {
    console.error('[TURN VALIDATE] Erro:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/turn/revoke
router.post('/turn/revoke', turnSecurityMiddleware, async (req, res) => {
  try {
    const { userId, streamId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    let revokedCount = 0;
    for (const [key, cred] of activeCredentials.entries()) {
      if (cred.userId === userId && (!streamId || cred.streamId === streamId)) {
        activeCredentials.delete(key);
        revokedCount++;
      }
    }

    await pushRecentActivity(userId, {
      action: 'turn_credentials_revoked',
      resource: 'turn_server',
      timestamp: new Date(),
      endpoint: '/api/turn/revoke',
    });

    res.json({ success: true, revokedCount, message: `${revokedCount} credenciais revogadas` });
  } catch (error) {
    console.error('[TURN REVOKE] Erro:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/turn/status
router.get('/turn/status', turnSecurityMiddleware, async (req, res) => {
  try {
    const now = Date.now();
    const active = Array.from(activeCredentials.entries()).map(([key, cred]) => ({
      key,
      remainingTime: Math.max(0, cred.expiry - now),
      expiry: new Date(cred.expiry).toISOString(),
    }));

    res.json({ total: active.length, timestamp: new Date(now).toISOString() });
  } catch (error) {
    console.error('[TURN STATUS] Erro:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
