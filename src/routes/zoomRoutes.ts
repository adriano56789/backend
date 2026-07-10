import express, { Request, Response } from 'express';
import { ZoomSettings } from '../models';
import { findUserByAnyId } from '../utils/idHelper';

const router = express.Router();

// Obter configurações de zoom do usuário
router.get('/user/:userId', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        
        // Usar helper estrito para buscar usuário e obter ID real
        const { User } = await import('../models');
        const user = await findUserByAnyId(User, userId);
        if (!user) {
            return res.status(404).json({ 
                error: 'Usuário não encontrado',
                userId 
            });
        }
        
        // Usar ID real do usuário para buscar configurações de zoom
        const userQuery = { userId: user.id };
        
        let zoomSettings = await ZoomSettings.findOne(userQuery);
        
        if (!zoomSettings) {
            // Criar configurações padrão automaticamente
            zoomSettings = await ZoomSettings.create({
                userId: user.id,
                zoomLevel: 100,
                isDefault: true,
                updatedAt: new Date().toISOString()
            });
            
            console.log(`✅ Configurações de zoom padrão criadas para usuário ${user.id}`);
        }

        // Persistir atividade de consulta de configurações de zoom
        await User.findOneAndUpdate(
            { id: user.id },
            { 
                $push: { recentActivities: { $each: [{
                        action: 'zoom_settings_viewed',
                        resource: 'user_preferences',
                        timestamp: new Date(),
                        endpoint: '/api/zoom/user/:userId'
                    }], $slice: -50 } }
            }
        ).catch(console.error);

        // Garantir que retorne apenas ID real da API, nunca MongoDB ID
        const response = {
            userId: user.id, // ID real da API
            zoomLevel: zoomSettings.zoomLevel,
            isDefault: zoomSettings.isDefault || false,
            updatedAt: zoomSettings.updatedAt || new Date().toISOString()
        };

        res.json(response);
    } catch (error: any) {
        console.error('Erro ao buscar configurações de zoom:', error);
        res.status(500).json({ error: error.message });
    }
});

// Atualizar configurações de zoom do usuário
router.put('/user/:userId', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { zoomLevel } = req.body;

        // Validar o nível de zoom
        if (zoomLevel < 50 || zoomLevel > 150) {
            return res.status(400).json({ error: 'Nível de zoom deve estar entre 50 e 150' });
        }

        // Usar helper estrito para buscar usuário e obter ID real
        const { User } = await import('../models');
        const user = await findUserByAnyId(User, userId);
        if (!user) {
            return res.status(404).json({ 
                error: 'Usuário não encontrado',
                userId 
            });
        }
        
        // Usar ID real do usuário para buscar configurações de zoom
        const userQuery = { userId: user.id };

        const zoomSettings = await ZoomSettings.findOneAndUpdate(
            userQuery,
            { 
                $set: {
                    zoomLevel,
                    isDefault: false,
                    updatedAt: new Date()
                }
            },
            { upsert: true, returnDocument: 'after' }
        );

        // Persistir atividade de atualização de configurações de zoom
        await User.findOneAndUpdate(
            { id: user.id },
            { 
                $push: { recentActivities: { $each: [{
                        action: 'zoom_settings_updated',
                        resource: 'user_preferences',
                        timestamp: new Date(),
                        endpoint: '/api/zoom/user/:userId'
                    }], $slice: -50 } }
            }
        ).catch(console.error);

        // Garantir que retorne apenas ID real da API, nunca MongoDB ID
        const response = {
            success: true, 
            zoomSettings: {
                userId: user.id,
                zoomLevel: zoomSettings!.zoomLevel,
                isDefault: zoomSettings!.isDefault || false,
                updatedAt: zoomSettings!.updatedAt || new Date().toISOString()
            },
            message: 'Configurações de zoom atualizadas com sucesso'
        };

        res.json(response);

    } catch (error: any) {
        console.error('Erro ao atualizar configurações de zoom:', error);
        res.status(500).json({ error: error.message });
    }
});

// Resetar zoom para o padrão
router.post('/user/:userId/reset', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        // Usar helper estrito para buscar usuário e obter ID real
        const { User } = await import('../models');
        const user = await findUserByAnyId(User, userId);
        if (!user) {
            return res.status(404).json({ 
                error: 'Usuário não encontrado',
                userId 
            });
        }
        
        // Usar ID real do usuário para buscar configurações de zoom
        const userQuery = { userId: user.id };

        const zoomSettings = await ZoomSettings.findOneAndUpdate(
            userQuery,
            { 
                $set: {
                    zoomLevel: 100,
                    isDefault: true,
                    updatedAt: new Date()
                }
            },
            { upsert: true, returnDocument: 'after' }
        );

        // Persistir atividade de reset de configurações de zoom
        await User.findOneAndUpdate(
            { id: user.id },
            { 
                $push: { recentActivities: { $each: [{
                        action: 'zoom_settings_reset',
                        resource: 'user_preferences',
                        timestamp: new Date(),
                        endpoint: '/api/zoom/user/:userId/reset'
                    }], $slice: -50 } }
            }
        ).catch(console.error);

        // Garantir que retorne apenas ID real da API, nunca MongoDB ID
        const response = {
            success: true, 
            zoomSettings: {
                userId: user.id,
                zoomLevel: zoomSettings!.zoomLevel,
                isDefault: zoomSettings!.isDefault || false,
                updatedAt: zoomSettings!.updatedAt || new Date().toISOString()
            },
            message: 'Zoom resetado para o padrão (100%)'
        };

        res.json(response);

    } catch (error: any) {
        console.error('Erro ao resetar zoom:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
