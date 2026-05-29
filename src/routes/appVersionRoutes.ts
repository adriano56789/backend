import express from 'express';
import { AppVersion, User } from '../models';

const router = express.Router();

// GET /api/version/:app - Buscar versão mais recente de um app
router.get('/:app', async (req, res) => {
    try {
        const { app } = req.params;
        
        // Validar nome do app
        if (!['livenza', 'livego'].includes(app)) {
            return res.status(400).json({ 
                error: 'App inválido',
                supportedApps: ['livenza', 'livego']
            });
        }

        const version = await AppVersion.getLatestVersion(app);
        
        if (!version) {
            return res.status(404).json({ 
                error: 'Versão não encontrada para este app' 
            });
        }

        res.json({
            success: true,
            version: {
                app: version.app,
                latestVersion: version.latestVersion,
                forceUpdate: version.forceUpdate,
                message: version.message,
                updateUrl: version.updateUrl,
                websiteUrl: version.websiteUrl,
                changelog: version.changelog,
                minSupportedVersion: version.minSupportedVersion,
                updatedAt: version.updatedAt
            }
        });
    } catch (error: any) {
        console.error('Erro ao buscar versão:', error);
        res.status(500).json({ 
            error: 'Erro ao buscar versão',
            message: error.message 
        });
    }
});

// POST /api/version/check - Verificar se precisa atualizar
router.post('/check', async (req, res) => {
    try {
        const { app, currentVersion, userId } = req.body;
        
        if (!app || !currentVersion) {
            return res.status(400).json({ 
                error: 'App e currentVersion são obrigatórios' 
            });
        }

        const needsUpdate = await AppVersion.needsUpdate(app, currentVersion);
        const latest = await AppVersion.getLatestVersion(app);

        // Persistir atividade de verificação de versão se userId fornecido
        if (userId) {
            await User.findOneAndUpdate(
                { id: userId },
                { 
                    $push: { 
                        recentActivities: {
                            action: 'version_check',
                            resource: 'app_version',
                            timestamp: new Date(),
                            endpoint: '/api/version/check'
                        }
                    }
                }
            ).catch(console.error); // Não falhar se não conseguir persistir
        }

        res.json({
            success: true,
            needsUpdate,
            currentVersion,
            latest: latest ? {
                latestVersion: latest.latestVersion,
                forceUpdate: latest.forceUpdate,
                message: latest.message,
                updateUrl: latest.updateUrl,
                websiteUrl: latest.websiteUrl,
                changelog: latest.changelog,
                minSupportedVersion: latest.minSupportedVersion
            } : null
        });
    } catch (error: any) {
        console.error('Erro ao verificar versão:', error);
        res.status(500).json({ 
            error: 'Erro ao verificar versão',
            message: error.message 
        });
    }
});

// POST /api/version - Criar ou atualizar versão (admin)
router.post('/', async (req, res) => {
    try {
        const versionData = req.body;
        
        // Campos obrigatórios
        const required = ['app', 'latestVersion', 'forceUpdate', 'message'];
        const missing = required.filter(field => !versionData[field]);
        
        if (missing.length > 0) {
            return res.status(400).json({ 
                error: 'Campos obrigatórios faltando', 
                missing 
            });
        }

        const version = await AppVersion.upsertVersion(versionData.app, versionData);
        
        // Persistir atividade de administrador se adminId fornecido
        if (versionData.adminId) {
            await User.findOneAndUpdate(
                { id: versionData.adminId },
                { 
                    $push: { 
                        recentActivities: {
                            action: 'admin_version_update',
                            resource: 'app_version',
                            timestamp: new Date(),
                            endpoint: '/api/version'
                        }
                    }
                }
            ).catch(console.error); // Não falhar se não conseguir persistir
        }
        
        console.log(`✅ Versão ${versionData.latestVersion} ${versionData.app} ${versionData._id ? 'atualizada' : 'criada'}`);
        
        res.json({
            success: true,
            message: `Versão ${versionData.latestVersion} ${versionData._id ? 'atualizada' : 'criada'} com sucesso`,
            version
        });
    } catch (error: any) {
        console.error('Erro ao salvar versão:', error);
        res.status(500).json({ 
            error: 'Erro ao salvar versão',
            message: error.message 
        });
    }
});

// GET /api/version - Listar todas as versões (admin)
router.get('/', async (req, res) => {
    try {
        const { app } = req.query;
        
        let filter = {};
        if (app) {
            filter = { app };
        }

        const versions = await AppVersion.find(filter)
            .sort({ updatedAt: -1 })
            .limit(50); // Limitar para performance

        res.json({
            success: true,
            count: versions.length,
            versions
        });
    } catch (error: any) {
        console.error('Erro ao listar versões:', error);
        res.status(500).json({ 
            error: 'Erro ao listar versões',
            message: error.message 
        });
    }
});

export default router;
