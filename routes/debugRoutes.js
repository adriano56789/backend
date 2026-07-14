"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const index_1 = require("../models/index");
const router = express_1.default.Router();
router.get('/debug/empty-logs', async (req, res) => {
    try {
        const { limit = 50, offset = 0, endpoint } = req.query;
        const filter = {};
        if (endpoint)
            filter.endpoint = endpoint;
        const docs = await index_1.EmptyApiLog.find(filter)
            .sort({ createdAt: -1 })
            .skip(parseInt(offset) || 0)
            .limit(Math.min(parseInt(limit) || 50, 200))
            .lean();
        const total = await index_1.EmptyApiLog.countDocuments(filter);
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
    }
    catch (error) {
        res.status(500).json({ code: 1, msg: error.message });
    }
});
router.get('/debug/empty-logs/stats', async (req, res) => {
    try {
        const stats = await index_1.EmptyApiLog.aggregate([
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
    }
    catch (error) {
        res.status(500).json({ code: 1, msg: error.message });
    }
});
router.delete('/debug/empty-logs', async (req, res) => {
    try {
        await index_1.EmptyApiLog.deleteMany({});
        res.json({ code: 0, msg: 'OK', data: { deleted: true } });
    }
    catch (error) {
        res.status(500).json({ code: 1, msg: error.message });
    }
});
exports.default = router;
