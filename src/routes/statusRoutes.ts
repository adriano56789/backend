import express from 'express';
import { User } from '../models/index';

const router = express.Router();

// GET /api/status - Buscar status de usuários
router.get('/', async (req, res) => {
    try {
        const { userIds } = req.query;
        
        if (!userIds) {
            return res.status(400).json({ error: 'userIds é obrigatório' });
        }

        const userIdArray = Array.isArray(userIds) ? userIds : [userIds];
        
        // Garantir que todos os IDs sejam strings
        const stringUserIds = userIdArray.map(id => String(id));
        
        console.log(`🔍 Buscando status para ${stringUserIds.length} usuários`);

        // Persistir atividade de consulta de status (para cada usuário)
        await Promise.all(
            stringUserIds.map(async (userId: string) => {
                await User.findOneAndUpdate(
                    { id: userId },
                    { 
                        $push: { recentActivities: { $each: [{
                                action: 'status_viewed',
                                resource: 'user_status',
                                timestamp: new Date(),
                                endpoint: '/api/status'
                            }], $slice: -50 } }
                    }
                ).catch(console.error);
            })
        );

        const users = await User.find({ 
            id: { $in: stringUserIds } 
        }).select('id name isOnline lastSeen avatarUrl');

        const statusMap = users.reduce((acc, user) => {
            acc[user.id] = {
                id: user.id,
                name: user.name,
                isOnline: user.isOnline || false,
                lastSeen: user.lastSeen,
                avatarUrl: user.avatarUrl
            };
            return acc;
        }, {} as any);

        res.json({
            success: true,
            statuses: statusMap
        });

    } catch (error: any) {
        console.error('❌ Erro ao buscar status:', error);
        res.status(500).json({ error: 'Erro interno ao buscar status' });
    }
});

// POST /api/status/online - Atualizar status online
router.post('/online', async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId é obrigatório' });
        }

        console.log(`🟢 Usuário ${userId} ficou online (REST)`);
        const now = new Date();

        // 1. Atualizar UserStatus (Mongoose)
        const { UserStatus } = await import('../models');
        await UserStatus.findOneAndUpdate(
            { userId },
            { $set: { isOnline: true, lastSeen: now } },
            { upsert: true }
        );

        await User.findOneAndUpdate(
            { id: userId },
            { 
                $set: { isOnline: true, lastSeen: now },
                $push: { recentActivities: { $each: [{
                        action: 'status_set_online',
                        resource: 'user_status',
                        timestamp: now,
                        endpoint: '/api/status/online'
                    }], $slice: -50 } }
            }
        );

        // Notificar via WebSocket
        const io = req.app.get('io');
        if (io) {
            io.emit('user_status_changed', {
                userId,
                isOnline: true,
                lastSeen: now.toISOString()
            });
        }

        res.json({
            success: true,
            status: 'online'
        });

    } catch (error: any) {
        console.error('❌ Erro ao atualizar status online:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar status' });
    }
});

// POST /api/status/offline - Atualizar status offline
router.post('/offline', async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId é obrigatório' });
        }

        console.log(`🔴 Usuário ${userId} ficou offline (REST)`);
        const now = new Date();

        // 1. Atualizar UserStatus (Mongoose)
        const { UserStatus } = await import('../models');
        await UserStatus.findOneAndUpdate(
            { userId },
            { $set: { isOnline: false, lastSeen: now } },
            { upsert: true }
        );

        await User.findOneAndUpdate(
            { id: userId },
            { 
                $set: { isOnline: false, lastSeen: now },
                $push: { recentActivities: { $each: [{
                        action: 'status_set_offline',
                        resource: 'user_status',
                        timestamp: now,
                        endpoint: '/api/status/offline'
                    }], $slice: -50 } }
            }
        );

        // Notificar via WebSocket
        const io = req.app.get('io');
        if (io) {
            io.emit('user_status_changed', {
                userId,
                isOnline: false,
                lastSeen: now.toISOString()
            });
        }

        res.json({
            success: true,
            status: 'offline'
        });

    } catch (error: any) {
        console.error('❌ Erro ao atualizar status offline:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar status' });
    }
});

export default router;
