import express from 'express';
import { EmptyApiLog } from '../models/index';

const router = express.Router();

router.get('/debug/empty-logs', async (req, res) => {
    try {
        const { limit = 50, offset = 0, endpoint } = req.query;

        const filter: any = {};
        if (endpoint) filter.endpoint = endpoint;

        const docs = await EmptyApiLog.find(filter)
            .sort({ createdAt: -1 })
            .skip(parseInt(offset as string) || 0)
            .limit(Math.min(parseInt(limit as string) || 50, 200))
            .lean();

        const total = await EmptyApiLog.countDocuments(filter);

        res.json({
            code: 0,
            msg: 'OK',
            data: {
                logs: docs.map(d => ({
                    id: d._id,
                    method: d.method,
                    endpoint: d.endpoint,
                    query: d.query,
                    statusCode: d.statusCode,
                    userId: d.userId,
                    responseSummary: d.responseSummary,
                    userAgent: d.userAgent,
                    createdAt: d.createdAt
                })),
                total
            }
        });
    } catch (error: any) {
        res.status(500).json({ code: 1, msg: error.message });
    }
});

router.get('/debug/empty-logs/stats', async (req, res) => {
    try {
        const stats = await EmptyApiLog.aggregate([
            { $group: { _id: '$endpoint', count: { $sum: 1 }, lastAt: { $max: '$createdAt' } } },
            { $sort: { count: -1 } },
            { $limit: 30 }
        ]);

        res.json({
            code: 0,
            msg: 'OK',
            data: stats.map(s => ({
                endpoint: s._id,
                count: s.count,
                lastAt: s.lastAt
            }))
        });
    } catch (error: any) {
        res.status(500).json({ code: 1, msg: error.message });
    }
});

router.delete('/debug/empty-logs', async (req, res) => {
    try {
        await EmptyApiLog.deleteMany({});
        res.json({ code: 0, msg: 'OK', data: { deleted: true } });
    } catch (error: any) {
        res.status(500).json({ code: 1, msg: error.message });
    }
});

export default router;
