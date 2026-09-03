"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const models_1 = require("../models");
const router = express_1.default.Router();
// POST /api/visitors/record - Registrar visita ao perfil
router.post('/record', async (req, res) => {
    try {
        const { profileName, visitorName } = req.body;
        if (!profileName || !visitorName) {
            return res.status(400).json({ error: 'profileName e visitorName são obrigatórios' });
        }
        if (profileName === visitorName) {
            return res.status(400).json({ error: 'Usuário não pode visitar o próprio perfil' });
        }
        // Salva a visita imediatamente sem depender de User.findOne
        const visitorDocId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        await models_1.Visitor.findOneAndUpdate({ visitorId: visitorName, visitedId: profileName }, {
            $set: {
                id: visitorDocId,
                visitorId: visitorName,
                visitedId: profileName,
                visitedAt: new Date(),
                visitorName: visitorName,
                visitorAvatar: ''
            }
        }, { upsert: true, returnDocument: 'after' });
        // Tenta enriquecer com dados do usuário (não bloqueante)
        try {
            const userData = await models_1.User.findOne({ name: visitorName }).select('name avatarUrl');
            if (userData) {
                await models_1.Visitor.findOneAndUpdate({ visitorId: visitorName, visitedId: profileName }, { $set: { visitorName: userData.name, visitorAvatar: userData.avatarUrl || '' } });
            }
        }
        catch { /* fallback silencioso */ }
        // Incrementa profileViews (tenta name e id)
        await models_1.User.findOneAndUpdate({ name: profileName }, { $inc: { profileViews: 1 } }).catch(() => { });
        await models_1.User.findOneAndUpdate({ id: profileName }, { $inc: { profileViews: 1 } }).catch(() => { });
        res.json({ success: true });
    }
    catch (error) {
        console.error('[VISITOR] Erro ao registrar visita:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});
exports.default = router;
