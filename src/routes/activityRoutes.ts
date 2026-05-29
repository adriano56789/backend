import express from 'express';
import { UserActivity, ActivityType } from '../models/UserActivity';
import { activityLogger, logJoinLive, logFollowUser, logSendGift } from '../middleware/ActivityLogger';
import { activityEventService } from '../services/ActivityEventService';
import { getUserIdFromToken } from '../middleware/auth';

const router = express.Router();

// GET /activities - Listar atividades do usuário com paginação
router.get('/', async (req, res) => {
    try {
        const userId = await getUserIdFromToken(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const activityType = req.query.type as ActivityType;
        const targetType = req.query.targetType as string;
        const targetId = req.query.targetId as string;

        const filters: any = {};
        if (activityType) filters.activityType = activityType;
        if (targetType) filters.targetType = targetType;
        if (targetId) filters.targetId = targetId;

        const { UserActivity } = await import('../models/UserActivity');
        const result = await (UserActivity as any).findPaginated(page, limit, filters);
        
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar atividades' });
    }
});

// GET /activities/recent - Atividades recentes
router.get('/recent', async (req, res) => {
    try {
        const userId = await getUserIdFromToken(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }

        const limit = parseInt(req.query.limit as string) || 20;
        const { UserActivity } = await import('../models/UserActivity');
        const activities = await (UserActivity as any).findBasic(userId, limit);
        
        res.json({
            success: true,
            activities
        });
    } catch (error) {
        console.error('Error fetching recent activities:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar atividades recentes' });
    }
});

// GET /activities/stats - Estatísticas do usuário
router.get('/stats', async (req, res) => {
    try {
        const userId = await getUserIdFromToken(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }

        const days = parseInt(req.query.days as string) || 30;
        const { UserActivity } = await import('../models/UserActivity');
        const stats = await (UserActivity as any).getUserActivityStats(userId, days);
        
        res.json({
            success: true,
            stats,
            period: `${days} dias`
        });
    } catch (error) {
        console.error('Error fetching activity stats:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar estatísticas' });
    }
});

// GET /activities/global - Estatísticas globais (admin)
router.get('/global', async (req, res) => {
    try {
        const userId = await getUserIdFromToken(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }

        // TODO: Verificar se usuário é admin
        const days = parseInt(req.query.days as string) || 30;
        const { UserActivity } = await import('../models/UserActivity');
        const stats = await (UserActivity as any).getGlobalActivityStats(days);
        
        res.json({
            success: true,
            stats,
            period: `${days} dias`
        });
    } catch (error) {
        console.error('Error fetching global stats:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar estatísticas globais' });
    }
});

// GET /activities/types - Estatísticas por tipo
router.get('/types', async (req, res) => {
    try {
        const userId = await getUserIdFromToken(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }

        const days = parseInt(req.query.days as string) || 30;
        const { UserActivity } = await import('../models/UserActivity');
        const stats = await (UserActivity as any).getActivityTypesStats(days);
        
        res.json({
            success: true,
            stats,
            period: `${days} dias`
        });
    } catch (error) {
        console.error('Error fetching type stats:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar estatísticas por tipo' });
    }
});

// POST /activities/log - Log manual de atividade (para testes)
router.post('/log', async (req, res) => {
    try {
        const userId = await getUserIdFromToken(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }

        const { activityType, targetId, targetType, metadata } = req.body;

        if (!activityType || !Object.values(ActivityType).includes(activityType)) {
            return res.status(400).json({ success: false, error: 'Tipo de atividade inválido' });
        }

        await activityLogger.logManualActivity({
            userId,
            activityType,
            targetId,
            targetType,
            metadata,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            sessionId: req.headers['x-session-id'] as string
        });

        res.json({
            success: true,
            message: 'Atividade registrada com sucesso'
        });
    } catch (error) {
        console.error('Error logging activity:', error);
        res.status(500).json({ success: false, error: 'Erro ao registrar atividade' });
    }
});

// POST /activities/test - Testar sistema de atividades
router.post('/test', async (req, res) => {
    try {
        const userId = await getUserIdFromToken(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }

        // Criar atividades de teste
        const testActivities = [
            {
                userId,
                activityType: ActivityType.LOGIN,
                metadata: { test: true }
            },
            {
                userId,
                activityType: ActivityType.JOIN_LIVE,
                targetId: 'test_stream_123',
                targetType: 'live',
                metadata: { test: true, streamTitle: 'Test Live' }
            },
            {
                userId,
                activityType: ActivityType.SEND_GIFT,
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
                activityType: ActivityType.FOLLOW_USER,
                targetId: 'test_user_789',
                targetType: 'user',
                metadata: { test: true }
            }
        ];

        const results = [];
        for (const activity of testActivities) {
            await activityLogger.logManualActivity(activity);
            results.push(activity.activityType);
        }

        res.json({
            success: true,
            message: 'Atividades de teste criadas',
            activities: results
        });
    } catch (error) {
        console.error('Error creating test activities:', error);
        res.status(500).json({ success: false, error: 'Erro ao criar atividades de teste' });
    }
});

// GET /activities/cleanup - Limpar atividades antigas (admin)
router.post('/cleanup', async (req, res) => {
    try {
        const userId = await getUserIdFromToken(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }

        // TODO: Verificar se usuário é admin
        const daysOld = parseInt(req.body.daysOld as string) || 90;
        const { UserActivity } = await import('../models/UserActivity');
        const result = await (UserActivity as any).cleanupOldActivities(daysOld);
        
        res.json({
            success: true,
            message: `Atividades antigas (${daysOld} dias) removidas`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Error cleaning up activities:', error);
        res.status(500).json({ success: false, error: 'Erro ao limpar atividades antigas' });
    }
});

// GET /activities/export - Exportar atividades do usuário
router.get('/export', async (req, res) => {
    try {
        const userId = await getUserIdFromToken(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }

        const days = parseInt(req.query.days as string) || 30;
        const format = req.query.format as string || 'json';

        const threshold = new Date();
        threshold.setDate(threshold.getDate() - days);

        const activities = await UserActivity.find({
            userId,
            timestamp: { $gte: threshold }
        }).sort({ timestamp: -1 });

        if (format === 'csv') {
            // Exportar como CSV
            const csvHeader = 'ID,Usuario,Tipo de Atividade,Alvo,Tipo do Alvo,Data,Metadata\n';
            const csvData = activities.map(activity => 
                `${activity.id},${activity.userId},${activity.activityType},${activity.targetId || ''},${activity.targetType || ''},${activity.timestamp.toISOString()},"${JSON.stringify(activity.metadata || {}).replace(/"/g, '""')}"`
            ).join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="activities_${userId}.csv"`);
            res.send(csvHeader + csvData);
        } else {
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
    } catch (error) {
        console.error('Error exporting activities:', error);
        res.status(500).json({ success: false, error: 'Erro ao exportar atividades' });
    }
});

// GET /activities/live/:streamId - Atividades de uma live específica
router.get('/live/:streamId', async (req, res) => {
    try {
        const userId = await getUserIdFromToken(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }

        const { streamId } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;

        const { UserActivity } = await import('../models/UserActivity');
        const activities = await (UserActivity as any).getTargetActivities(streamId, 'live', limit);
        
        res.json({
            success: true,
            streamId,
            activities
        });
    } catch (error) {
        console.error('Error fetching live activities:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar atividades da live' });
    }
});

// GET /activities/user/:targetUserId - Atividades sobre um usuário específico
router.get('/user/:targetUserId', async (req, res) => {
    try {
        const userId = await getUserIdFromToken(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }

        const { targetUserId } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;

        const { UserActivity } = await import('../models/UserActivity');
        const activities = await (UserActivity as any).getTargetActivities(targetUserId, 'user', limit);
        
        res.json({
            success: true,
            targetUserId,
            activities
        });
    } catch (error) {
        console.error('Error fetching user activities:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar atividades do usuário' });
    }
});

// GET /activity-types - Listar todos os tipos de atividades disponíveis
router.get('/types', async (req, res) => {
    try {
        const types = Object.values(ActivityType).map(type => ({
            value: type,
            label: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            category: getActivityCategory(type)
        }));

        res.json({
            success: true,
            types
        });
    } catch (error) {
        console.error('Error fetching activity types:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar tipos de atividades' });
    }
});

// Função auxiliar para obter categoria do tipo de atividade
function getActivityCategory(activityType: ActivityType): string {
    const categories = {
        [ActivityType.JOIN_LIVE]: 'live',
        [ActivityType.LEAVE_LIVE]: 'live',
        [ActivityType.START_LIVE]: 'live',
        [ActivityType.END_LIVE]: 'live',
        [ActivityType.FOLLOW_USER]: 'social',
        [ActivityType.UNFOLLOW_USER]: 'social',
        [ActivityType.BLOCK_USER]: 'social',
        [ActivityType.UNBLOCK_USER]: 'social',
        [ActivityType.SEND_FRIEND_REQUEST]: 'social',
        [ActivityType.ACCEPT_FRIEND_REQUEST]: 'social',
        [ActivityType.REJECT_FRIEND_REQUEST]: 'social',
        [ActivityType.SEND_GIFT]: 'economy',
        [ActivityType.RECEIVE_GIFT]: 'economy',
        [ActivityType.PURCHASE_ITEM]: 'economy',
        [ActivityType.WITHDRAW_FUNDS]: 'economy',
        [ActivityType.UPLOAD_PHOTO]: 'content',
        [ActivityType.UPLOAD_VIDEO]: 'content',
        [ActivityType.DELETE_PHOTO]: 'content',
        [ActivityType.DELETE_VIDEO]: 'content',
        [ActivityType.LIKE_CONTENT]: 'content',
        [ActivityType.UNLIKE_CONTENT]: 'content',
        [ActivityType.COMMENT_CONTENT]: 'content',
        [ActivityType.SEND_MESSAGE]: 'communication',
        [ActivityType.READ_MESSAGE]: 'communication',
        [ActivityType.DELETE_MESSAGE]: 'communication',
        [ActivityType.UPDATE_PROFILE]: 'profile',
        [ActivityType.CHANGE_AVATAR]: 'profile',
        [ActivityType.UPDATE_STATUS]: 'profile',
        [ActivityType.LOGIN]: 'system',
        [ActivityType.LOGOUT]: 'system',
        [ActivityType.CHANGE_SETTINGS]: 'system',
        [ActivityType.REPORT_CONTENT]: 'system'
    };
    
    return categories[activityType] || 'other';
}

export default router;
