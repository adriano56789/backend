import express from 'express';
import { onlineTracker } from '../services/OnlineTracker';

const router = express.Router();

// GET /api/stats/online - Contagem de usuários online
// Query params: streamId (opcional) - se omitido, retorna total global
router.get('/online', async (req, res) => {
    try {
        const { streamId } = req.query;

        if (streamId) {
            const counts = await onlineTracker.getCounts(streamId as string);
            return res.json({
                success: true,
                streamId,
                fans: counts.fans,
                visitors: counts.visitors,
                total: counts.total
            });
        }

        const counts = await onlineTracker.getAllCounts();
        const streams = await onlineTracker.getStreams();

        res.json({
            success: true,
            fans: counts.fans,
            visitors: counts.visitors,
            total: counts.total,
            activeStreams: streams.length
        });
    } catch (error) {
        console.error('[STATS] Erro ao buscar online:', error);
        res.status(500).json({ success: false, error: 'Erro interno' });
    }
});

export default router;
