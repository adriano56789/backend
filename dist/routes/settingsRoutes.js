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
const models_1 = require("../models");
const userResponse_1 = require("../utils/userResponse");
const idHelper_1 = require("../utils/idHelper");
const router = express_1.default.Router();
// Notification Settings - Usa campos do User
router.get('/notifications/settings/:id', async (req, res) => {
    try {
        // 🔄 CONVERSOR DE ID: MongoDB ID → ID Real da API
        let userId = req.params.id;
        if (req.needsIdConversion && req.originalMongoId) {
            // Se o middleware detectou MongoDB ID, converter para ID real
            const user = await (0, idHelper_1.findUserByAnyId)(models_1.User, req.originalMongoId);
            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }
            userId = user.id;
            console.log(`🔄 [NOTIFICATIONS-GET] MongoDB ID ${req.originalMongoId} convertido para ID real: ${userId}`);
        }
        const user = await (0, idHelper_1.findUserByAnyId)(models_1.User, userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Retornar configurações baseadas nos campos existentes do usuário
        const settings = {
            userId: user.id,
            newMessages: user.showActivityStatus !== false, // usa campo existente
            streamerLive: user.showActivityStatus !== false, // usa campo existente
            followedPosts: true, // padrão (não tem campo específico)
            pedido: true, // padrão (não tem campo específico)
            interactive: user.showActivityStatus !== false, // usa campo existente
        };
        res.json(settings);
    }
    catch (error) {
        console.error('Error getting notification settings:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/notifications/settings/:id', async (req, res) => {
    try {
        // 🔄 CONVERSOR DE ID: MongoDB ID → ID Real da API
        let userId = req.params.id;
        if (req.needsIdConversion && req.originalMongoId) {
            // Se o middleware detectou MongoDB ID, converter para ID real
            const user = await (0, idHelper_1.findUserByAnyId)(models_1.User, req.originalMongoId);
            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }
            userId = user.id;
            console.log(`🔄 [NOTIFICATIONS-POST] MongoDB ID ${req.originalMongoId} convertido para ID real: ${userId}`);
        }
        console.log('🔍 [DEBUG] Request body:', req.body);
        console.log('🔍 [DEBUG] UserId:', userId);
        // Aceita tanto { settings: {... } } quanto direto { ... }
        let settings = req.body.settings;
        if (!settings) {
            // Se não tem settings, usa o body diretamente
            settings = req.body;
        }
        if (!settings || typeof settings !== 'object') {
            console.log('❌ [DEBUG] Settings is invalid:', settings);
            return res.status(400).json({ error: 'Settings are required' });
        }
        // Salvar configurações nos campos existentes do User
        const updateData = {
            lastSeen: new Date().toISOString()
        };
        // Usar showActivityStatus para controle geral de notificações
        if (settings.interactive !== undefined) {
            updateData.showActivityStatus = Boolean(settings.interactive);
        }
        if (settings.newMessages !== undefined) {
            updateData.showActivityStatus = Boolean(settings.newMessages);
        }
        if (settings.streamerLive !== undefined) {
            updateData.showActivityStatus = Boolean(settings.streamerLive);
        }
        // Adicionar persistência de atividade de configuração
        updateData.$push = {
            recentActivities: {
                action: 'settings_change',
                resource: 'notification_settings',
                timestamp: new Date(),
                endpoint: '/api/settings/notifications/settings/:id'
            }
        };
        const updatedUser = await (0, idHelper_1.updateUserByRealId)(models_1.User, userId, updateData);
        console.log(`✅ Configurações de notificação salvas para usuário ${userId}`);
        res.json({ success: true, settings });
    }
    catch (error) {
        console.error('Error updating notification settings:', error);
        res.status(500).json({ error: error.message });
    }
});
// Gift Notification Settings - Usa campos do User
router.get('/settings/gift-notifications/:id', async (req, res) => {
    try {
        const user = await (0, idHelper_1.findUserByAnyId)(models_1.User, req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Retornar configurações baseadas em showActivityStatus
        const settings = {
            enabled: user.showActivityStatus || true
        };
        res.json({ settings });
    }
    catch (error) {
        console.error('Error getting gift notification settings:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/settings/gift-notifications/:id', async (req, res) => {
    try {
        // 🔄 CONVERSOR DE ID: MongoDB ID → ID Real da API
        let userId = req.params.id;
        if (req.needsIdConversion && req.originalMongoId) {
            // Se o middleware detectou MongoDB ID, converter para ID real
            const user = await (0, idHelper_1.findUserByAnyId)(models_1.User, req.originalMongoId);
            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }
            userId = user.id;
            console.log(`🔄 [GIFT-NOTIFICATIONS] MongoDB ID ${req.originalMongoId} convertido para ID real: ${userId}`);
        }
        const { settings } = req.body;
        if (!settings) {
            return res.status(400).json({ error: 'Settings are required' });
        }
        // Salvar configurações em showActivityStatus + persistir atividade
        const updatedUser = await (0, idHelper_1.updateUserByRealId)(models_1.User, userId, {
            showActivityStatus: Boolean(settings.enabled),
            $push: { recentActivities: { $each: [{
                            action: 'settings_change',
                            resource: 'gift_notification_settings',
                            timestamp: new Date(),
                            endpoint: '/api/settings/gift-notifications/:id'
                        }], $slice: -50 } }
        });
        res.json({ success: true, settings });
    }
    catch (error) {
        console.error('Error updating gift notification settings:', error);
        res.status(500).json({ error: error.message });
    }
});
// Beauty Settings - Usa campos do User
router.get('/settings/beauty/:id', async (req, res) => {
    try {
        // 🔄 CONVERSOR DE ID: MongoDB ID → ID Real da API
        let userId = req.params.id;
        if (req.needsIdConversion && req.originalMongoId) {
            // Se o middleware detectou MongoDB ID, converter para ID real
            const user = await (0, idHelper_1.findUserByAnyId)(models_1.User, req.originalMongoId);
            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }
            userId = user.id;
            console.log(`🔄 [BEAUTY-GET] MongoDB ID ${req.originalMongoId} convertido para ID real: ${userId}`);
        }
        console.log('🔍 [BEAUTY_SETTINGS] GET - Requisição recebida para usuário:', userId);
        console.log('📋 [BEAUTY_SETTINGS] Headers:', req.headers);
        console.log('🌐 [BEAUTY_SETTINGS] IP:', req.ip);
        const user = await (0, idHelper_1.findUserByAnyId)(models_1.User, userId);
        if (!user) {
            console.log('❌ [BEAUTY_SETTINGS] Usuário não encontrado:', userId);
            return res.status(404).json({ error: 'User not found' });
        }
        console.log('✅ [BEAUTY_SETTINGS] Usuário encontrado:', user.name);
        // Buscar configurações de beleza do modelo BeautySettings
        const beautySettings = await models_1.BeautySettings.getSettingsOnly(userId);
        console.log('📋 [BEAUTY_SETTINGS] Configurações encontradas:', beautySettings);
        console.log('📤 [BEAUTY_SETTINGS] Enviando configurações:', beautySettings);
        res.json(beautySettings);
    }
    catch (error) {
        console.error('❌ [BEAUTY_SETTINGS] Erro ao buscar configurações de beleza:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/settings/beauty/:id', async (req, res) => {
    try {
        // 🔄 CONVERSOR DE ID: MongoDB ID → ID Real da API
        let userId = req.params.id;
        if (req.needsIdConversion && req.originalMongoId) {
            // Se o middleware detectou MongoDB ID, converter para ID real
            const user = await (0, idHelper_1.findUserByAnyId)(models_1.User, req.originalMongoId);
            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }
            userId = user.id;
            console.log(`🔄 [BEAUTY-POST] MongoDB ID ${req.originalMongoId} convertido para ID real: ${userId}`);
        }
        const { settings } = req.body;
        console.log('🔍 [BEAUTY_SETTINGS] POST - Requisição recebida para usuário:', userId);
        console.log('📋 [BEAUTY_SETTINGS] Headers:', req.headers);
        console.log('📦 [BEAUTY_SETTINGS] Settings recebidos:', settings);
        console.log('🌐 [BEAUTY_SETTINGS] IP:', req.ip);
        if (!settings) {
            console.log('❌ [BEAUTY_SETTINGS] Settings não fornecidos');
            return res.status(400).json({ error: 'Settings are required' });
        }
        // Salvar configurações usando o modelo BeautySettings
        console.log('💾 [BEAUTY_SETTINGS] Salvando configurações no MongoDB...');
        try {
            const savedSettings = await models_1.BeautySettings.upsertSettings(userId, settings);
            console.log('✅ [BEAUTY_SETTINGS] Configurações salvas com sucesso:', savedSettings);
            const response = { success: true, settings: savedSettings.settings };
            console.log('📤 [BEAUTY_SETTINGS] Enviando resposta:', response);
            res.json(response);
        }
        catch (saveError) {
            console.error('❌ [BEAUTY_SETTINGS] Erro ao salvar configurações:', saveError);
            throw saveError;
        }
    }
    catch (error) {
        console.error('❌ [BEAUTY_SETTINGS] Erro ao atualizar configurações de beleza:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/settings/private-stream/:id', async (req, res) => {
    try {
        // 🔄 CONVERSOR DE ID: MongoDB ID → ID Real da API
        let userId = req.params.id;
        if (req.needsIdConversion && req.originalMongoId) {
            // Se o middleware detectou MongoDB ID, converter para ID real
            const user = await (0, idHelper_1.findUserByAnyId)(models_1.User, req.originalMongoId);
            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }
            userId = user.id;
            console.log(`🔄 [PRIVATE-STREAM-GET] MongoDB ID ${req.originalMongoId} convertido para ID real: ${userId}`);
        }
        const user = await (0, idHelper_1.findUserByAnyId)(models_1.User, userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Retornar configurações padrão se não existirem
        const defaultSettings = {
            privateInvite: false,
            followersOnly: false,
            fansOnly: false,
            friendsOnly: false
        };
        const settings = user.privateStreamSettings || defaultSettings;
        console.log(`🔓 Getting private stream settings for user ${req.params.id}:`, settings);
        res.json({ settings });
    }
    catch (error) {
        console.error('Error getting private stream settings:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/settings/private-stream/:id', async (req, res) => {
    try {
        const { settings } = req.body;
        // 🔄 CONVERSOR DE ID: MongoDB ID → ID Real da API
        let userId = req.params.id;
        if (req.needsIdConversion && req.originalMongoId) {
            // Se o middleware detectou MongoDB ID, converter para ID real
            const user = await (0, idHelper_1.findUserByAnyId)(models_1.User, req.originalMongoId);
            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }
            userId = user.id;
            console.log(`🔄 [PRIVATE-STREAM] MongoDB ID ${req.originalMongoId} convertido para ID real: ${userId}`);
        }
        if (!settings) {
            return res.status(400).json({ error: 'Settings are required' });
        }
        // Validar configurações
        const validSettings = {
            privateInvite: Boolean(settings.privateInvite),
            followersOnly: Boolean(settings.followersOnly),
            fansOnly: Boolean(settings.fansOnly),
            friendsOnly: Boolean(settings.friendsOnly)
        };
        console.log(`🔒 Updating private stream settings for user ${userId}:`, validSettings);
        const user = await (0, idHelper_1.updateUserByRealId)(models_1.User, userId, { privateStreamSettings: validSettings });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ success: true, user: (0, userResponse_1.standardizeUserResponse)(user) });
    }
    catch (error) {
        console.error('Error updating private stream settings:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/settings/pip/toggle/:id', async (req, res) => {
    try {
        const updatedUser = await (0, idHelper_1.updateUserByRealId)(models_1.User, req.params.id, { pipEnabled: req.body.enabled });
        res.json({ success: !!updatedUser, user: (0, userResponse_1.standardizeUserResponse)(updatedUser) || {} });
    }
    catch (error) {
        if (error.message === 'User not found') {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(500).json({ error: error.message });
    }
});
router.get('/permissions/camera/:id', async (req, res) => {
    try {
        const user = await (0, idHelper_1.findUserByAnyId)(models_1.User, req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ status: user.cameraPermissionStatus || 'granted' });
    }
    catch (error) {
        console.error('Error getting camera permissions:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/permissions/camera/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const userId = req.params.id;
        if (!status || !['granted', 'denied', 'prompt'].includes(status)) {
            return res.status(400).json({ error: 'Invalid permission status' });
        }
        const updatedUser = await (0, idHelper_1.updateUserByRealId)(models_1.User, userId, { cameraPermissionStatus: status });
        res.json({ success: !!updatedUser, status: status });
    }
    catch (error) {
        console.error('Error updating camera permissions:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/permissions/microphone/:id', async (req, res) => {
    try {
        const user = await (0, idHelper_1.findUserByAnyId)(models_1.User, req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ status: user.microphonePermissionStatus || 'granted' });
    }
    catch (error) {
        console.error('Error getting microphone permissions:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/permissions/microphone/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const userId = req.params.id;
        if (!status || !['granted', 'denied', 'prompt'].includes(status)) {
            return res.status(400).json({ error: 'Invalid permission status' });
        }
        const updatedUser = await (0, idHelper_1.updateUserByRealId)(models_1.User, userId, { microphonePermissionStatus: status });
        res.json({ success: !!updatedUser, status: status });
    }
    catch (error) {
        console.error('Error updating microphone permissions:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/chat-permission/status/:id', async (req, res) => {
    const user = await (0, idHelper_1.findUserByAnyId)(models_1.User, req.params.id);
    res.json({ permission: user?.chatPermission || 'all' });
});
// Push Notification Settings (notificações individuais por streamer)
router.get('/settings/push/:id', async (req, res) => {
    try {
        let userId = req.params.id;
        if (req.needsIdConversion && req.originalMongoId) {
            const user = await (0, idHelper_1.findUserByAnyId)(models_1.User, req.originalMongoId);
            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }
            userId = user.id;
        }
        const user = await (0, idHelper_1.findUserByAnyId)(models_1.User, userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const settings = user.pushNotificationSettings || {};
        res.json({ settings });
    }
    catch (error) {
        console.error('Error getting push notification settings:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/settings/push/:id', async (req, res) => {
    try {
        let userId = req.params.id;
        if (req.needsIdConversion && req.originalMongoId) {
            const user = await (0, idHelper_1.findUserByAnyId)(models_1.User, req.originalMongoId);
            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }
            userId = user.id;
        }
        const { settings } = req.body;
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ error: 'Settings object is required' });
        }
        const updatedUser = await (0, idHelper_1.updateUserByRealId)(models_1.User, userId, { pushNotificationSettings: settings });
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ success: true, settings: updatedUser.pushNotificationSettings || {} });
    }
    catch (error) {
        console.error('Error updating push notification settings:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/can-send-message/:fromId/:toId', async (req, res) => {
    try {
        const { fromId, toId } = req.params;
        const { canSendMessage } = await Promise.resolve().then(() => __importStar(require('../utils/chatPermission')));
        const result = await canSendMessage(fromId, toId);
        res.json({ allowed: result.allowed, reason: result.reason || null });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/chat-permission/update/:id', async (req, res) => {
    try {
        const validPermissions = ['all', 'followers', 'following', 'friends', 'none'];
        const permission = req.body.permission;
        if (!validPermissions.includes(permission)) {
            return res.status(400).json({ error: 'Permissão de mensagem inválida' });
        }
        const user = await (0, idHelper_1.updateUserByRealId)(models_1.User, req.params.id, { chatPermission: permission });
        res.json({ success: !!user, user: (0, userResponse_1.standardizeUserResponse)(user) || {} });
    }
    catch (error) {
        if (error.message === 'User not found') {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
