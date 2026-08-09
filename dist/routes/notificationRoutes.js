"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const DeviceToken_1 = require("../models/DeviceToken");
const firebaseService_1 = require("../services/firebaseService");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// POST /api/notifications/register-token - Salvar token do dispositivo
router.post('/notifications/register-token', async (req, res) => {
    try {
        const userId = (0, auth_1.getUserIdFromToken)(req);
        if (!userId) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }
        const { token, platform = 'web' } = req.body;
        if (!token) {
            return res.status(400).json({ error: 'Token é obrigatório' });
        }
        await DeviceToken_1.DeviceToken.findOneAndUpdate({ token }, { $set: { userId, token, platform } }, { upsert: true, returnDocument: 'after' });
        console.log(`[FCM] Token registrado para usuário ${userId}`);
        res.json({ success: true });
    }
    catch (error) {
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
        await DeviceToken_1.DeviceToken.deleteOne({ token });
        console.log('[FCM] Token removido:', token);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// GET /api/notifications/tokens/:userId - Listar tokens de um usuário
router.get('/notifications/tokens/:userId', async (req, res) => {
    try {
        const tokens = await DeviceToken_1.DeviceToken.find({ userId: req.params.userId }).lean();
        res.json({ success: true, tokens });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// POST /api/notifications/send - Enviar notificação para um usuário específico
router.post('/notifications/send', async (req, res) => {
    try {
        const adminId = (0, auth_1.getUserIdFromToken)(req);
        if (!adminId) {
            return res.status(401).json({ error: 'Não autorizado' });
        }
        const { userId, title, body, data } = req.body;
        if (!userId || !title || !body) {
            return res.status(400).json({ error: 'userId, title e body são obrigatórios' });
        }
        const tokens = await DeviceToken_1.DeviceToken.find({ userId }).lean();
        if (tokens.length === 0) {
            return res.json({ success: true, sent: 0, message: 'Usuário não possui dispositivos registrados' });
        }
        const tokenList = tokens.map(t => t.token);
        const failed = await (0, firebaseService_1.sendPushNotificationToMultiple)(tokenList, { title, body, data });
        if (failed.length > 0) {
            const failedTokens = failed.map(f => f.token);
            await DeviceToken_1.DeviceToken.deleteMany({ token: { $in: failedTokens } });
        }
        res.json({ success: true, sent: tokenList.length - failed.length, failed: failed.length });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// POST /api/notifications/send-to-all - Enviar para todos os usuários com token (broadcast)
router.post('/notifications/send-to-all', async (req, res) => {
    try {
        const adminId = (0, auth_1.getUserIdFromToken)(req);
        if (!adminId) {
            return res.status(401).json({ error: 'Não autorizado' });
        }
        const { title, body, data } = req.body;
        if (!title || !body) {
            return res.status(400).json({ error: 'title e body são obrigatórios' });
        }
        const allTokens = await DeviceToken_1.DeviceToken.find().lean();
        const tokenList = allTokens.map(t => t.token);
        if (tokenList.length === 0) {
            return res.json({ success: true, sent: 0 });
        }
        const failed = await (0, firebaseService_1.sendPushNotificationToMultiple)(tokenList, { title, body, data });
        if (failed.length > 0) {
            const failedTokens = failed.map(f => f.token);
            await DeviceToken_1.DeviceToken.deleteMany({ token: { $in: failedTokens } });
        }
        res.json({ success: true, sent: tokenList.length - failed.length, failed: failed.length });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
