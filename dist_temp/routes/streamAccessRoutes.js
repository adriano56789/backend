"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const models_1 = require("../models");
const router = express_1.default.Router();
router.use(auth_1.protect);
router.post('/validate-access', async (req, res) => {
    try {
        const { streamId, action } = req.body;
        const userId = req.user.id;
        if (!streamId || !action) {
            return res.status(400).json({ allowed: false, reason: 'streamId e action são obrigatórios' });
        }
        if (action !== 'publish' && action !== 'play') {
            return res.status(400).json({ allowed: false, reason: 'action deve ser publish ou play' });
        }
        const stream = await models_1.Streamer.findOne({
            $or: [
                { id: streamId },
                { streamKey: streamId }
            ]
        }).lean();
        if (!stream) {
            return res.status(404).json({ allowed: false, reason: 'Transmissão não encontrada' });
        }
        if (action === 'publish') {
            if (stream.hostId !== userId) {
                return res.status(403).json({
                    allowed: false,
                    reason: 'Apenas o host da transmissão pode publicar'
                });
            }
            return res.json({ allowed: true });
        }
        if (action === 'play') {
            if (stream.kickedUsers?.includes(userId)) {
                return res.status(403).json({
                    allowed: false,
                    reason: 'Você foi removido desta transmissão'
                });
            }
            if (stream.isPrivate) {
                const isAuthorized = userId === stream.hostId ||
                    stream.moderators?.includes(userId);
                if (!isAuthorized) {
                    return res.status(403).json({
                        allowed: false,
                        reason: 'Esta transmissão é privada'
                    });
                }
            }
            return res.json({ allowed: true });
        }
    }
    catch (error) {
        console.error('[STREAM-ACCESS] Erro ao validar acesso:', error.message);
        res.status(500).json({ allowed: false, reason: 'Erro interno ao validar acesso' });
    }
});
exports.default = router;
