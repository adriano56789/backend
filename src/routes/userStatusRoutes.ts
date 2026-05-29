import express, { Request, Response } from 'express';
import { User, UserStatus } from '../models';

const router = express.Router();

// GET /users/:id/status - Obter status do usuário
router.get('/users/:id/status', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        console.log(`[DEBUG] Buscando status para usuário ID: ${id}`);
        
        // Persistir atividade de consulta de status
        await User.findOneAndUpdate(
            { id: id },
            { 
                $push: { 
                    recentActivities: {
                        action: 'user_status_viewed',
                        resource: 'user_status',
                        timestamp: new Date(),
                        endpoint: '/users/:id/status'
                    }
                }
            }
        ).catch(console.error);
        
        let userStatus = await UserStatus.findOne({ userId: id });
        
        console.log(`[DEBUG] Status encontrado:`, userStatus ? 'SIM' : 'NÃO');
        
        if (!userStatus) {
            // Criar status padrão se não existir com upsert automático
            userStatus = await UserStatus.findOneAndUpdate(
                { userId: id },
                { $setOnInsert: { userId: id, isOnline: false, lastSeen: new Date() } },
                { upsert: true, new: true }
            );
        }

        res.json({
            userId: userStatus?.userId || id,
            isOnline: userStatus?.isOnline || false,
            lastSeen: userStatus?.lastSeen,
            updated_at: userStatus?.updatedAt || new Date()
        });
    } catch (error: any) {
        console.error('Erro ao buscar status do usuário:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /users/:id/online - Marcar usuário como online
router.post('/users/:id/online', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const now = new Date();

        console.log(`🟢 [STATUS] Marcando usuário ${id} como ONLINE`);

        // 1. Atualizar modelo UserStatus
        await UserStatus.findOneAndUpdate(
            { userId: id },
            { $set: { isOnline: true, lastSeen: now } },
            { upsert: true, new: true }
        );

        await User.findOneAndUpdate(
            { id: id },
            { 
                $set: { isOnline: true, lastSeen: now },
                $push: {
                    recentActivities: {
                        action: 'user_status_set_online',
                        resource: 'user_status',
                        timestamp: now,
                        endpoint: '/users/:id/online'
                    }
                }
            }
        ).catch(err => console.error(`Erro ao sincronizar User ${id}:`, err));
        
        // 3. Notificar via WebSocket se disponível
        const io = req.app.get('io');
        if (io) {
            io.emit('user_status_changed', {
                userId: id,
                isOnline: true,
                lastSeen: now,
                timestamp: now
            });
        }

        res.json({ 
            success: true, 
            message: 'Usuário marcado como online',
            userId: id,
            isOnline: true,
            lastSeen: now
        });

    } catch (error: any) {
        console.error('Erro ao marcar usuário como online:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /users/:id/offline - Marcar usuário como offline
router.post('/users/:id/offline', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const now = new Date();

        console.log(`🔴 [STATUS] Marcando usuário ${id} como OFFLINE`);

        // 1. Atualizar modelo UserStatus
        await UserStatus.findOneAndUpdate(
            { userId: id },
            { $set: { isOnline: false, lastSeen: now } },
            { upsert: true, new: true }
        );

        await User.findOneAndUpdate(
            { id: id },
            { 
                $set: { isOnline: false, lastSeen: now },
                $push: {
                    recentActivities: {
                        action: 'user_status_set_offline',
                        resource: 'user_status',
                        timestamp: now,
                        endpoint: '/users/:id/offline'
                    }
                }
            }
        ).catch(err => console.error(`Erro ao sincronizar User ${id}:`, err));

        // 3. Notificar via WebSocket
        const io = req.app.get('io');
        if (io) {
            io.emit('user_status_changed', {
                userId: id,
                isOnline: false,
                lastSeen: now,
                timestamp: now
            });
        }

        res.json({ 
            success: true, 
            message: 'Usuário marcado como offline',
            userId: id,
            isOnline: false,
            lastSeen: now
        });

    } catch (error: any) {
        console.error('Erro ao marcar usuário como offline:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /users/:id/status - Atualizar status (unificado)
router.put('/users/:id/status', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { isOnline } = req.body;

        if (typeof isOnline !== 'boolean') {
            return res.status(400).json({ error: 'isOnline deve ser booleano' });
        }

        // Persistir atividade de atualização de status
        await User.findOneAndUpdate(
            { id: id },
            { 
                $push: { 
                    recentActivities: {
                        action: 'user_status_updated',
                        resource: 'user_status',
                        timestamp: new Date(),
                        endpoint: '/users/:id/status'
                    }
                }
            }
        ).catch(console.error);

        const updateData: any = { isOnline, updatedAt: new Date() };
        if (!isOnline) updateData.lastSeen = new Date();

        const userStatus = await UserStatus.findOneAndUpdate(
            { userId: id },
            { $set: updateData },
            { upsert: true, new: true }
        );

        res.json({ 
            success: true, 
            message: `Usuário marcado como ${isOnline ? 'online' : 'offline'}`,
            userId: userStatus?.userId || id,
            isOnline: userStatus?.isOnline || false,
            lastSeen: userStatus?.lastSeen,
            updated_at: userStatus?.updatedAt || new Date()
        });

    } catch (error: any) {
        console.error('Erro ao atualizar status do usuário:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /online - Lista de usuários online
router.get('/online', async (req: Request, res: Response) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        
        console.log(`[ONLINE-USERS] Buscando usuários online...`);
        
        // Buscar usuários online com dados completos
        const onlineUsers = await User.find({ isOnline: true })
            .sort({ lastSeen: -1 })
            .limit(Number(limit))
            .skip(Number(offset))
            .select('id name avatarUrl level country isOnline lastSeen identification activeFrameId frameExpiration');

        console.log(`[ONLINE-USERS] Encontrados ${onlineUsers.length} usuários online`);

        // Persistir atividade de consulta de usuários online para cada usuário online
        onlineUsers.forEach(async (user) => {
            await User.findOneAndUpdate(
                { id: user.id },
                { 
                    $push: { 
                        recentActivities: {
                            action: 'online_users_listed',
                            resource: 'user_status',
                            timestamp: new Date(),
                            endpoint: '/online'
                        }
                    }
                }
            ).catch(console.error);
        });

        res.json({
            users: onlineUsers,
            total: onlineUsers.length,
            limit: Number(limit),
            offset: Number(offset)
        });

    } catch (error: any) {
        console.error('[ONLINE-USERS] Erro ao buscar usuários online:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /batch-status - Obter status de múltiplos usuários
router.post('/batch-status', async (req: Request, res: Response) => {
    try {
        const { userIds } = req.body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ error: 'userIds deve ser um array não vazio' });
        }

        // Persistir atividade de consulta de status em lote para cada usuário
        userIds.forEach(async (userId: string) => {
            await User.findOneAndUpdate(
                { id: userId },
                { 
                    $push: { 
                        recentActivities: {
                            action: 'batch_status_viewed',
                            resource: 'user_status',
                            timestamp: new Date(),
                            endpoint: '/batch-status'
                        }
                    }
                }
            ).catch(console.error);
        });

        const userStatuses = await UserStatus.find({ 
            userId: { $in: userIds } 
        }).select('userId isOnline lastSeen updatedAt');

        // Criar mapa para fácil acesso
        const statusMap = new Map();
        userStatuses.forEach(status => {
            statusMap.set(status.userId, status);
        });

        // Garantir que todos os IDs solicitados tenham uma resposta
        const result = userIds.map(userId => {
            const status = statusMap.get(userId);
            if (status) {
                return status;
            } else {
                // Status padrão para usuários não encontrados
                return {
                    userId: userId,
                    isOnline: false,
                    lastSeen: new Date(),
                    updated_at: new Date()
                };
            }
        });

        res.json({
            users: result,
            total: result.length
        });

    } catch (error: any) {
        console.error('Erro ao buscar status em lote:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
