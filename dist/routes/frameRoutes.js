"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const models_1 = require("../models");
const router = express_1.default.Router();
console.log('[FRAME-ROUTES] Carregando rotas de frames...');
// Listar todos os frames disponíveis
router.get('/frames', async (req, res) => {
    try {
        console.log('[FRAME-ROUTES] GET /frames chamado');
        const frames = await models_1.Frame.find({ isActive: true }).exec();
        const framesList = frames.map((f) => {
            const data = f.toObject ? f.toObject() : f;
            // Remover referências circulares fazendo um parse/stringify
            return JSON.parse(JSON.stringify(data));
        });
        res.json(framesList);
    }
    catch (error) {
        console.error('[FRAME-ROUTES] Erro ao buscar frames:', error);
        res.status(500).json({ error: error.message });
    }
});
// Comprar um frame
router.post('/frames/:frameId/purchase', async (req, res) => {
    try {
        const { frameId } = req.params;
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }
        // Buscar frame da loja
        const frame = await models_1.Frame.findOne({ _id: frameId, isActive: true }).exec();
        if (!frame) {
            return res.status(404).json({ error: 'Frame não encontrado' });
        }
        // Verificar se usuário já possui este frame ativo
        const existingActive = await models_1.UserFrame.findOne({
            userId,
            frameId,
            isActive: true,
            expirationDate: { $gt: new Date() }
        }).exec();
        if (existingActive) {
            return res.status(400).json({ error: 'Você já possui este frame ativo' });
        }
        // Verificar diamonds do usuário
        const user = await models_1.User.findOne({ id: userId }).exec();
        if (!user || user.diamonds < frame.price) {
            return res.status(400).json({ error: 'Diamonds insuficientes' });
        }
        // Deduzir diamonds + persistir atividade
        user.diamonds -= frame.price;
        user.recentActivities = user.recentActivities || [];
        user.recentActivities.push({
            action: 'purchase',
            resource: 'avatar_frame',
            timestamp: new Date(),
            endpoint: '/api/frames/:frameId/purchase'
        });
        // Manter apenas as últimas 50 atividades
        if (user.recentActivities.length > 50) {
            user.recentActivities = user.recentActivities.slice(-50);
        }
        await user.save();
        // Calcular data de expiração
        const expirationDate = new Date(Date.now() + frame.duration * 24 * 60 * 60 * 1000);
        // Adicionar frame ao usuário
        const userFrame = await models_1.UserFrame.create({
            userId,
            frameId,
            purchaseDate: new Date(),
            expirationDate,
            isActive: true,
            isEquipped: false
        });
        res.json({
            success: true,
            userFrame: JSON.parse(JSON.stringify(userFrame.toObject ? userFrame.toObject() : userFrame)),
            userDiamonds: user.diamonds,
            expirationDate
        });
    }
    catch (error) {
        console.error('Erro ao comprar frame:', error);
        res.status(500).json({ error: error.message });
    }
});
// Listar frames do usuário
router.get('/frames/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        // Buscar frames do usuário que ainda não expiraram
        const userFrames = await models_1.UserFrame.find({
            userId,
            isActive: true,
            expirationDate: { $gt: new Date() }
        }).exec();
        const framesList = userFrames.map((f) => JSON.parse(JSON.stringify(f.toObject ? f.toObject() : f)));
        res.json(framesList);
    }
    catch (error) {
        console.error('Erro ao buscar frames do usuário:', error);
        res.status(500).json({ error: error.message });
    }
});
// Equipar um frame
router.post('/frames/:frameId/equip', async (req, res) => {
    try {
        const { frameId } = req.params;
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }
        // Verificar se frame pertence ao usuário e está ativo
        const userFrame = await models_1.UserFrame.findOne({
            userId,
            frameId,
            isActive: true,
            expirationDate: { $gt: new Date() }
        }).exec();
        if (!userFrame) {
            return res.status(404).json({ error: 'Frame não encontrado ou expirado' });
        }
        // Desmarcar todos os outros frames como equipados
        await models_1.UserFrame.updateMany({ userId, isActive: true }, { $set: { isEquipped: false } });
        // Marcar este frame como equipado
        userFrame.isEquipped = true;
        await userFrame.save();
        // Atualizar activeFrameId do usuário
        await models_1.User.findOneAndUpdate({ id: userId }, { $set: { activeFrameId: frameId, updatedAt: new Date() } }).exec();
        res.json({
            success: true,
            equippedFrame: JSON.parse(JSON.stringify(userFrame.toObject ? userFrame.toObject() : userFrame)),
            message: 'Frame equipado com sucesso'
        });
    }
    catch (error) {
        console.error('Erro ao equipar frame:', error);
        res.status(500).json({ error: error.message });
    }
});
// Obter frame equipado atual
router.get('/frames/current/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const currentFrame = await models_1.UserFrame.findOne({
            userId,
            isActive: true,
            isEquipped: true,
            expirationDate: { $gt: new Date() }
        }).exec();
        const frameData = currentFrame ? JSON.parse(JSON.stringify(currentFrame.toObject ? currentFrame.toObject() : currentFrame)) : null;
        res.json(frameData);
    }
    catch (error) {
        console.error('Erro ao buscar frame atual:', error);
        res.status(500).json({ error: error.message });
    }
});
// Limpar frames expirados (pode ser chamado por um cron job)
router.post('/frames/unequip', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }
        await models_1.UserFrame.updateMany({ userId, isActive: true }, { $set: { isEquipped: false } });
        await models_1.User.findOneAndUpdate({ id: userId }, { $set: { activeFrameId: null, updatedAt: new Date() } }).exec();
        res.json({ success: true, message: 'Frame desequipado com sucesso' });
    }
    catch (error) {
        console.error('Erro ao desequipar frame:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/frames/cleanup-expired', async (req, res) => {
    try {
        const result = await models_1.UserFrame.updateMany({
            isActive: true,
            expirationDate: { $lte: new Date() }
        }, { $set: { isActive: false } });
        res.json({
            success: true,
            expiredFrames: result.modifiedCount
        });
    }
    catch (error) {
        console.error('Erro ao limpar frames expirados:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
