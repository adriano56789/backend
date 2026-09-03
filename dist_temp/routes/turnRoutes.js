"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const crypto_1 = __importDefault(require("crypto"));
const models_1 = require("../models");
const Security_1 = __importDefault(require("../utils/Security"));
const env_1 = require("../config/env");
const TurnSecurity_1 = require("../middleware/TurnSecurity");
const auth_1 = require("../middleware/auth");
const activityHelpers_1 = require("../utils/activityHelpers");
const router = express_1.default.Router();
const activeCredentials = new Map();
const requestTracker = new Map();
const TURN_SECRET = env_1.ENV.TURN_SECRET || 'dev_turn_secret_key_change_me';
const TURN_HOST = process.env.TURN_HOST || '2.25.192.154';
const TURN_PORT = process.env.TURN_PORT || '3478';
const TURN_CONFIGS = {
    BR: { urls: [`turn:${TURN_HOST}:${TURN_PORT}`], maxConnections: 2000, secret: TURN_SECRET },
    US: { urls: [`turn:${TURN_HOST}:${TURN_PORT}`], maxConnections: 2000, secret: TURN_SECRET },
    EU: { urls: [`turn:${TURN_HOST}:${TURN_PORT}`], maxConnections: 2000, secret: TURN_SECRET },
};
// Helper para registrar atividade recente no User (usa o helper compartilhado)
// POST /api/turn/credentials
router.post('/turn/credentials', TurnSecurity_1.turnSecurityMiddleware, async (req, res) => {
    try {
        const userId = (0, auth_1.getUserIdFromToken)(req) || req.body.userId;
        const { streamId, region = 'BR' } = req.body;
        const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
        if (!userId || !streamId) {
            return res.status(400).json({ error: 'userId and streamId are required' });
        }
        // Rate limiting: 5 requisições por minuto por usuário (12s entre cada)
        const rateKey = `${userId}_${clientIP}`;
        const lastRequest = requestTracker.get(rateKey) || 0;
        const now = Date.now();
        if (now - lastRequest < 12000) {
            return res.status(429).json({
                error: 'Too many requests',
                retryAfter: Math.ceil((12000 - (now - lastRequest)) / 1000),
            });
        }
        requestTracker.set(rateKey, now);
        // Detecção de abuso
        const recentRequests = Security_1.default.getRecentRequests(userId, requestTracker);
        if (Security_1.default.detectAbuse(userId, recentRequests)) {
            await Security_1.default.blockAbusiveUser(userId, 'Abuso detectado - TURN credentials');
            return res.status(403).json({ error: 'Abuse detected' });
        }
        const user = await models_1.User.findOne({ id: userId });
        if (!user)
            return res.status(401).json({ error: 'Unauthorized - User not found' });
        // Corrigido: não bloquear se currentStreamId não coincidir.
        // Viewers podem não ter currentStreamId definido, mas ainda precisam de TURN.
        // A validação de acesso à stream é feita pelo WebRTC (WHIP/WHEP) e pelo Socket.IO.
        const turnConfig = TURN_CONFIGS[region] || TURN_CONFIGS.BR;
        const ttl = 5 * 60;
        const expiry = now + (ttl * 1000);
        // Formato padrão Coturn REST API: username=<timestamp>:<userId>
        // HMAC-SHA1(secret, <timestamp>:<userId>) = credential
        const timestamp = Math.floor(now / 1000) + ttl;
        const temporaryUsername = `${timestamp}:${userId}`;
        const temporaryCredential = crypto_1.default.createHmac('sha1', turnConfig.secret)
            .update(temporaryUsername)
            .digest('base64');
        // Limpar credenciais expiradas deste usuário
        for (const [key, cred] of activeCredentials.entries()) {
            if (cred.userId === userId && cred.expiry < now)
                activeCredentials.delete(key);
        }
        const credentialKey = `${userId}_${streamId}_${region}`;
        activeCredentials.set(credentialKey, {
            username: temporaryUsername,
            credential: temporaryCredential,
            expiry, userId, streamId, region,
        });
        setTimeout(() => { activeCredentials.delete(credentialKey); }, 5 * 60 * 1000);
        await (0, activityHelpers_1.pushRecentActivity)(userId, {
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
    }
    catch (error) {
        console.error('[TURN CREDS] Erro:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/turn/validate
router.post('/turn/validate', TurnSecurity_1.turnSecurityMiddleware, async (req, res) => {
    try {
        const { username, credential, region = 'BR' } = req.body;
        if (!username || !credential) {
            return res.status(400).json({ error: 'username and credential are required' });
        }
        let foundCredentials = null;
        for (const [, cred] of activeCredentials.entries()) {
            if (cred.username === username && cred.credential === credential && cred.region === region) {
                foundCredentials = cred;
                break;
            }
        }
        if (!foundCredentials)
            return res.status(401).json({ error: 'Invalid credentials' });
        if (foundCredentials.expiry < Date.now()) {
            activeCredentials.delete(`${foundCredentials.userId}_${foundCredentials.streamId}_${foundCredentials.region}`);
            return res.status(401).json({ error: 'Credentials expired' });
        }
        await (0, activityHelpers_1.pushRecentActivity)(foundCredentials.userId, {
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
    }
    catch (error) {
        console.error('[TURN VALIDATE] Erro:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/turn/revoke
router.post('/turn/revoke', TurnSecurity_1.turnSecurityMiddleware, async (req, res) => {
    try {
        const { userId, streamId } = req.body;
        if (!userId)
            return res.status(400).json({ error: 'userId is required' });
        let revokedCount = 0;
        for (const [key, cred] of activeCredentials.entries()) {
            if (cred.userId === userId && (!streamId || cred.streamId === streamId)) {
                activeCredentials.delete(key);
                revokedCount++;
            }
        }
        await (0, activityHelpers_1.pushRecentActivity)(userId, {
            action: 'turn_credentials_revoked',
            resource: 'turn_server',
            timestamp: new Date(),
            endpoint: '/api/turn/revoke',
        });
        res.json({ success: true, revokedCount, message: `${revokedCount} credenciais revogadas` });
    }
    catch (error) {
        console.error('[TURN REVOKE] Erro:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/turn/status
router.get('/turn/status', TurnSecurity_1.turnSecurityMiddleware, async (req, res) => {
    try {
        const now = Date.now();
        const active = Array.from(activeCredentials.entries()).map(([key, cred]) => ({
            key,
            remainingTime: Math.max(0, cred.expiry - now),
            expiry: new Date(cred.expiry).toISOString(),
        }));
        res.json({ total: active.length, timestamp: new Date(now).toISOString() });
    }
    catch (error) {
        console.error('[TURN STATUS] Erro:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
