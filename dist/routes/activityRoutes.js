"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const UserActivity_1 = require("../models/UserActivity");
const ActivityLogger_1 = require("../middleware/ActivityLogger");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// GET /activities - Listar atividades do usuário com paginação
router.get('/', async (req, res) => {
    try {
        const userId = await (0, auth_1.getUserIdFromToken)(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const activityType = req.query.type;
        const targetType = req.query.targetType;
        const targetId = req.query.targetId;
        const filters = {};
        if (activityType)
            filters.activityType = activityType;
        if (targetType)
            filters.targetType = targetType;
        if (targetId)
            filters.targetId = targetId;
        const { UserActivity } = await Promise.resolve().then(() => __importStar(require('../models/UserActivity')));
        const result = await UserActivity.findPaginated(page, limit, filters);
        res.json({
            success: true,
            ...result
        });
    }
    catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar atividades' });
    }
});
// GET /activities/recent - Atividades recentes
router.get('/recent', async (req, res) => {
    try {
        const userId = await (0, auth_1.getUserIdFromToken)(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }
        const limit = parseInt(req.query.limit) || 20;
        const { UserActivity } = await Promise.resolve().then(() => __importStar(require('../models/UserActivity')));
        const activities = await UserActivity.findBasic(userId, limit);
        res.json({
            success: true,
            activities
        });
    }
    catch (error) {
        console.error('Error fetching recent activities:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar atividades recentes' });
    }
});
// GET /activities/stats - Estatísticas do usuário
router.get('/stats', async (req, res) => {
    try {
        const userId = await (0, auth_1.getUserIdFromToken)(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }
        const days = parseInt(req.query.days) || 30;
        const { UserActivity } = await Promise.resolve().then(() => __importStar(require('../models/UserActivity')));
        const stats = await UserActivity.getUserActivityStats(userId, days);
        res.json({
            success: true,
            stats,
            period: `${days} dias`
        });
    }
    catch (error) {
        console.error('Error fetching activity stats:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar estatísticas' });
    }
});
// GET /activities/global - Estatísticas globais (admin)
router.get('/global', async (req, res) => {
    try {
        const userId = await (0, auth_1.getUserIdFromToken)(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }
        // TODO: Verificar se usuário é admin
        const days = parseInt(req.query.days) || 30;
        const { UserActivity } = await Promise.resolve().then(() => __importStar(require('../models/UserActivity')));
        const stats = await UserActivity.getGlobalActivityStats(days);
        res.json({
            success: true,
            stats,
            period: `${days} dias`
        });
    }
    catch (error) {
        console.error('Error fetching global stats:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar estatísticas globais' });
    }
});
// GET /activities/types - Estatísticas por tipo
router.get('/types', async (req, res) => {
    try {
        const userId = await (0, auth_1.getUserIdFromToken)(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }
        const days = parseInt(req.query.days) || 30;
        const { UserActivity } = await Promise.resolve().then(() => __importStar(require('../models/UserActivity')));
        const stats = await UserActivity.getActivityTypesStats(days);
        res.json({
            success: true,
            stats,
            period: `${days} dias`
        });
    }
    catch (error) {
        console.error('Error fetching type stats:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar estatísticas por tipo' });
    }
});
// POST /activities/log - Log manual de atividade (para testes)
router.post('/log', async (req, res) => {
    try {
        const userId = await (0, auth_1.getUserIdFromToken)(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }
        const { activityType, targetId, targetType, metadata } = req.body;
        if (!activityType || !Object.values(UserActivity_1.ActivityType).includes(activityType)) {
            return res.status(400).json({ success: false, error: 'Tipo de atividade inválido' });
        }
        await ActivityLogger_1.activityLogger.logManualActivity({
            userId,
            activityType,
            targetId,
            targetType,
            metadata,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            sessionId: req.headers['x-session-id']
        });
        res.json({
            success: true,
            message: 'Atividade registrada com sucesso'
        });
    }
    catch (error) {
        console.error('Error logging activity:', error);
        res.status(500).json({ success: false, error: 'Erro ao registrar atividade' });
    }
});
// POST /activities/test - Testar sistema de atividades
router.post('/test', async (req, res) => {
    try {
        const userId = await (0, auth_1.getUserIdFromToken)(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }
        // Criar atividades de teste
        const testActivities = [
            {
                userId,
                activityType: UserActivity_1.ActivityType.LOGIN,
                metadata: { test: true }
            },
            {
                userId,
                activityType: UserActivity_1.ActivityType.JOIN_LIVE,
                targetId: 'test_stream_123',
                targetType: 'live',
                metadata: { test: true, streamTitle: 'Test Live' }
            },
            {
                userId,
                activityType: UserActivity_1.ActivityType.SEND_GIFT,
                targetId: 'test_user_456',
                targetType: 'user',
                metadata: {
                    test: true,
                    giftId: 'gift_123',
                    giftName: 'Rose',
                    quantity: 1,
                    value: 10
                }
            },
            {
                userId,
                activityType: UserActivity_1.ActivityType.FOLLOW_USER,
                targetId: 'test_user_789',
                targetType: 'user',
                metadata: { test: true }
            }
        ];
        const results = [];
        for (const activity of testActivities) {
            await ActivityLogger_1.activityLogger.logManualActivity(activity);
            results.push(activity.activityType);
        }
        res.json({
            success: true,
            message: 'Atividades de teste criadas',
            activities: results
        });
    }
    catch (error) {
        console.error('Error creating test activities:', error);
        res.status(500).json({ success: false, error: 'Erro ao criar atividades de teste' });
    }
});
// GET /activities/cleanup - Limpar atividades antigas (admin)
router.post('/cleanup', async (req, res) => {
    try {
        const userId = await (0, auth_1.getUserIdFromToken)(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }
        // TODO: Verificar se usuário é admin
        const daysOld = parseInt(req.body.daysOld) || 90;
        const { UserActivity } = await Promise.resolve().then(() => __importStar(require('../models/UserActivity')));
        const result = await UserActivity.cleanupOldActivities(daysOld);
        res.json({
            success: true,
            message: `Atividades antigas (${daysOld} dias) removidas`,
            deletedCount: result.deletedCount
        });
    }
    catch (error) {
        console.error('Error cleaning up activities:', error);
        res.status(500).json({ success: false, error: 'Erro ao limpar atividades antigas' });
    }
});
// GET /activities/export - Exportar atividades do usuário
router.get('/export', async (req, res) => {
    try {
        const userId = await (0, auth_1.getUserIdFromToken)(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }
        const days = parseInt(req.query.days) || 30;
        const format = req.query.format || 'json';
        const threshold = new Date();
        threshold.setDate(threshold.getDate() - days);
        const activities = await UserActivity_1.UserActivity.find({
            userId,
            timestamp: { $gte: threshold }
        }).sort({ timestamp: -1 });
        if (format === 'csv') {
            // Exportar como CSV
            const csvHeader = 'ID,Usuario,Tipo de Atividade,Alvo,Tipo do Alvo,Data,Metadata\n';
            const csvData = activities.map(activity => `${activity.id},${activity.userId},${activity.activityType},${activity.targetId || ''},${activity.targetType || ''},${activity.timestamp.toISOString()},"${JSON.stringify(activity.metadata || {}).replace(/"/g, '""')}"`).join('\n');
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="activities_${userId}.csv"`);
            res.send(csvHeader + csvData);
        }
        else {
            // Exportar como JSON
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="activities_${userId}.json"`);
            res.json({
                userId,
                exportDate: new Date().toISOString(),
                period: `${days} dias`,
                activities
            });
        }
    }
    catch (error) {
        console.error('Error exporting activities:', error);
        res.status(500).json({ success: false, error: 'Erro ao exportar atividades' });
    }
});
// GET /activities/live/:streamId - Atividades de uma live específica
router.get('/live/:streamId', async (req, res) => {
    try {
        const userId = await (0, auth_1.getUserIdFromToken)(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }
        const { streamId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const { UserActivity } = await Promise.resolve().then(() => __importStar(require('../models/UserActivity')));
        const activities = await UserActivity.getTargetActivities(streamId, 'live', limit);
        res.json({
            success: true,
            streamId,
            activities
        });
    }
    catch (error) {
        console.error('Error fetching live activities:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar atividades da live' });
    }
});
// GET /activities/user/:targetUserId - Atividades sobre um usuário específico
router.get('/user/:targetUserId', async (req, res) => {
    try {
        const userId = await (0, auth_1.getUserIdFromToken)(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }
        const { targetUserId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const { UserActivity } = await Promise.resolve().then(() => __importStar(require('../models/UserActivity')));
        const activities = await UserActivity.getTargetActivities(targetUserId, 'user', limit);
        res.json({
            success: true,
            targetUserId,
            activities
        });
    }
    catch (error) {
        console.error('Error fetching user activities:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar atividades do usuário' });
    }
});
// GET /activity-types - Listar todos os tipos de atividades disponíveis
router.get('/types', async (req, res) => {
    try {
        const types = Object.values(UserActivity_1.ActivityType).map(type => ({
            value: type,
            label: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            category: getActivityCategory(type)
        }));
        res.json({
            success: true,
            types
        });
    }
    catch (error) {
        console.error('Error fetching activity types:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar tipos de atividades' });
    }
});
// Função auxiliar para obter categoria do tipo de atividade
function getActivityCategory(activityType) {
    const categories = {
        [UserActivity_1.ActivityType.JOIN_LIVE]: 'live',
        [UserActivity_1.ActivityType.LEAVE_LIVE]: 'live',
        [UserActivity_1.ActivityType.START_LIVE]: 'live',
        [UserActivity_1.ActivityType.END_LIVE]: 'live',
        [UserActivity_1.ActivityType.FOLLOW_USER]: 'social',
        [UserActivity_1.ActivityType.UNFOLLOW_USER]: 'social',
        [UserActivity_1.ActivityType.BLOCK_USER]: 'social',
        [UserActivity_1.ActivityType.UNBLOCK_USER]: 'social',
        [UserActivity_1.ActivityType.SEND_FRIEND_REQUEST]: 'social',
        [UserActivity_1.ActivityType.ACCEPT_FRIEND_REQUEST]: 'social',
        [UserActivity_1.ActivityType.REJECT_FRIEND_REQUEST]: 'social',
        [UserActivity_1.ActivityType.SEND_GIFT]: 'economy',
        [UserActivity_1.ActivityType.RECEIVE_GIFT]: 'economy',
        [UserActivity_1.ActivityType.PURCHASE_ITEM]: 'economy',
        [UserActivity_1.ActivityType.WITHDRAW_FUNDS]: 'economy',
        [UserActivity_1.ActivityType.UPLOAD_PHOTO]: 'content',
        [UserActivity_1.ActivityType.UPLOAD_VIDEO]: 'content',
        [UserActivity_1.ActivityType.DELETE_PHOTO]: 'content',
        [UserActivity_1.ActivityType.DELETE_VIDEO]: 'content',
        [UserActivity_1.ActivityType.LIKE_CONTENT]: 'content',
        [UserActivity_1.ActivityType.UNLIKE_CONTENT]: 'content',
        [UserActivity_1.ActivityType.COMMENT_CONTENT]: 'content',
        [UserActivity_1.ActivityType.SEND_MESSAGE]: 'communication',
        [UserActivity_1.ActivityType.READ_MESSAGE]: 'communication',
        [UserActivity_1.ActivityType.DELETE_MESSAGE]: 'communication',
        [UserActivity_1.ActivityType.UPDATE_PROFILE]: 'profile',
        [UserActivity_1.ActivityType.CHANGE_AVATAR]: 'profile',
        [UserActivity_1.ActivityType.UPDATE_STATUS]: 'profile',
        [UserActivity_1.ActivityType.LOGIN]: 'system',
        [UserActivity_1.ActivityType.LOGOUT]: 'system',
        [UserActivity_1.ActivityType.CHANGE_SETTINGS]: 'system',
        [UserActivity_1.ActivityType.REPORT_CONTENT]: 'system'
    };
    return categories[activityType] || 'other';
}
exports.default = router;
