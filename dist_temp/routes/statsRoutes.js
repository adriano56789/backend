"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const OnlineTracker_1 = require("../services/OnlineTracker");
const router = express_1.default.Router();
// GET /api/stats/online - Contagem de usuários online
// Query params: streamId (opcional) - se omitido, retorna total global
router.get('/online', async (req, res) => {
    try {
        const { streamId } = req.query;
        if (streamId) {
            const counts = await OnlineTracker_1.onlineTracker.getCounts(streamId);
            return res.json({
                success: true,
                streamId,
                fans: counts.fans,
                visitors: counts.visitors,
                total: counts.total
            });
        }
        const counts = await OnlineTracker_1.onlineTracker.getAllCounts();
        const streams = await OnlineTracker_1.onlineTracker.getStreams();
        res.json({
            success: true,
            fans: counts.fans,
            visitors: counts.visitors,
            total: counts.total,
            activeStreams: streams.length
        });
    }
    catch (error) {
        console.error('[STATS] Erro ao buscar online:', error);
        res.status(500).json({ success: false, error: 'Erro interno' });
    }
});
exports.default = router;
