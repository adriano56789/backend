"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const UserIdService_1 = require("../services/UserIdService");
const router = express_1.default.Router();
// GET /api/user-id/generate - Generate a new unique 7-digit ID
router.get('/generate', async (req, res) => {
    try {
        const newId = await UserIdService_1.UserIdService.generateUniqueId();
        res.json({
            success: true,
            data: {
                id: newId,
                length: newId.length,
                generatedAt: new Date().toISOString()
            }
        });
    }
    catch (error) {
        console.error('[USER-ID] Erro ao gerar ID:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// GET /api/user-id/validate/:id - Check if an ID is available
router.get('/validate/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || !/^\d{7}$/.test(id)) {
            return res.json({
                success: true,
                data: {
                    id,
                    available: false,
                    valid: false,
                    message: 'O ID deve ser um numero de 7 digitos'
                }
            });
        }
        const available = await UserIdService_1.UserIdService.isIdAvailable(id);
        res.json({
            success: true,
            data: {
                id,
                available,
                valid: true,
                message: available ? 'ID disponivel' : 'ID ja esta em uso'
            }
        });
    }
    catch (error) {
        console.error('[USER-ID] Erro ao validar ID:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// GET /api/user-id/lookup/:id - Lookup user by numeric ID
router.get('/lookup/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userInfo = await UserIdService_1.UserIdService.getPublicUserInfo(id);
        if (!userInfo) {
            return res.status(404).json({
                success: false,
                error: 'Usuario nao encontrado',
                data: null
            });
        }
        res.json({
            success: true,
            data: userInfo
        });
    }
    catch (error) {
        console.error('[USER-ID] Erro ao buscar usuario:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// POST /api/user-id/assign - Assign a specific ID to a user
router.post('/assign', async (req, res) => {
    try {
        const { userId, idToAssign } = req.body;
        if (!userId || !idToAssign) {
            return res.status(400).json({
                success: false,
                error: 'userId e idToAssign sao obrigatorios'
            });
        }
        if (!/^\d{7}$/.test(idToAssign)) {
            return res.status(400).json({
                success: false,
                error: 'O ID deve ser um numero de 7 digitos'
            });
        }
        const assigned = await UserIdService_1.UserIdService.assignIdToUser(userId, idToAssign);
        if (!assigned) {
            return res.status(409).json({
                success: false,
                error: 'ID ja esta em uso ou usuario nao encontrado'
            });
        }
        res.json({
            success: true,
            data: {
                userId,
                assignedId: idToAssign,
                assignedAt: new Date().toISOString()
            }
        });
    }
    catch (error) {
        console.error('[USER-ID] Erro ao atribuir ID:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// GET /api/user-id/stats - ID usage statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await UserIdService_1.UserIdService.getStats();
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        console.error('[USER-ID] Erro ao buscar estatisticas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// POST /api/user-id/batch-generate - Generate multiple IDs at once
router.post('/batch-generate', async (req, res) => {
    try {
        const { count = 5 } = req.body;
        const maxCount = Math.min(Math.max(1, count), 50);
        const ids = await UserIdService_1.UserIdService.generateBatch(maxCount);
        res.json({
            success: true,
            data: {
                ids,
                count: ids.length,
                generatedAt: new Date().toISOString()
            }
        });
    }
    catch (error) {
        console.error('[USER-ID] Erro ao gerar IDs em lote:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
