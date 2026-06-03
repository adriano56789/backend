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
Object.defineProperty(exports, "__esModule", { value: true });
exports.logUpdateProfile = exports.logLogout = exports.logLogin = exports.logUploadVideo = exports.logUploadPhoto = exports.logSendMessage = exports.logSendGift = exports.logBlockUser = exports.logUnfollowUser = exports.logFollowUser = exports.logLeaveLive = exports.logJoinLive = exports.activityLogger = exports.ActivityLogger = void 0;
exports.createModelHook = createModelHook;
exports.logWebSocketEvent = logWebSocketEvent;
const UserActivity_1 = require("../models/UserActivity");
const auth_1 = require("./auth");
// Classe principal do Activity Logger
class ActivityLogger {
    constructor() {
        this.isEnabled = true;
    }
    static getInstance() {
        if (!ActivityLogger.instance) {
            ActivityLogger.instance = new ActivityLogger();
        }
        return ActivityLogger.instance;
    }
    // Habilitar/desabilitar logging
    enable(enabled = true) {
        this.isEnabled = enabled;
    }
    // Método principal para registrar atividade
    async logActivity(context) {
        if (!this.isEnabled)
            return;
        try {
            const { UserActivity } = await Promise.resolve().then(() => __importStar(require('../models/UserActivity')));
            await UserActivity.logActivity(context);
        }
        catch (error) {
            console.error('Error logging activity:', error);
            // Não lançar erro para não afetar a operação principal
        }
    }
    // Extrair informações do request
    extractContext(req) {
        const context = {};
        // IP Address
        context.ipAddress = req.ip ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.headers['x-forwarded-for']?.split(',')[0]?.trim();
        // User Agent
        context.userAgent = req.headers['user-agent'];
        // Session ID (se existir)
        context.sessionId = req.sessionId ||
            req.session?.id ||
            req.headers['x-session-id'];
        // Device Info
        if (context.userAgent) {
            context.deviceInfo = this.parseUserAgent(context.userAgent);
        }
        return context;
    }
    // Parse User Agent para extrair informações do dispositivo
    parseUserAgent(userAgent) {
        const deviceInfo = {};
        // Mobile detection
        deviceInfo.mobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
        // Browser detection
        if (userAgent.includes('Chrome'))
            deviceInfo.browser = 'Chrome';
        else if (userAgent.includes('Firefox'))
            deviceInfo.browser = 'Firefox';
        else if (userAgent.includes('Safari'))
            deviceInfo.browser = 'Safari';
        else if (userAgent.includes('Edge'))
            deviceInfo.browser = 'Edge';
        else if (userAgent.includes('Opera'))
            deviceInfo.browser = 'Opera';
        else
            deviceInfo.browser = 'Unknown';
        // Platform detection
        if (userAgent.includes('Windows'))
            deviceInfo.platform = 'Windows';
        else if (userAgent.includes('Mac'))
            deviceInfo.platform = 'macOS';
        else if (userAgent.includes('Linux'))
            deviceInfo.platform = 'Linux';
        else if (userAgent.includes('Android'))
            deviceInfo.platform = 'Android';
        else if (userAgent.includes('iOS'))
            deviceInfo.platform = 'iOS';
        else
            deviceInfo.platform = 'Unknown';
        return deviceInfo;
    }
    // Middleware Express para logging automático
    middleware(activityType, targetExtractor) {
        return async (req, res, next) => {
            if (!this.isEnabled) {
                return next();
            }
            // Executar a rota primeiro
            const originalSend = res.send;
            let responseData;
            let isSuccess = false;
            // Intercept response
            res.send = function (data) {
                responseData = data;
                isSuccess = res.statusCode >= 200 && res.statusCode < 300;
                return originalSend.call(this, data);
            };
            // Continuar com a requisição
            res.on('finish', async () => {
                // Só logar se a requisição foi bem-sucedida
                if (!isSuccess)
                    return;
                try {
                    const userId = await (0, auth_1.getUserIdFromToken)(req);
                    if (!userId)
                        return;
                    const context = this.extractContext(req);
                    context.userId = userId;
                    context.activityType = activityType;
                    // Extrair informações específicas do alvo
                    if (targetExtractor) {
                        const targetInfo = targetExtractor(req, res);
                        context.targetId = targetInfo.targetId;
                        context.targetType = targetInfo.targetType;
                        context.metadata = targetInfo.metadata;
                    }
                    await this.logActivity(context);
                }
                catch (error) {
                    console.error('Error in activity middleware:', error);
                }
            });
            next();
        };
    }
    // Método para logging manual (para eventos internos)
    async logManualActivity(context) {
        await this.logActivity(context);
    }
    // Método para logging de WebSocket
    async logWebSocketActivity(context) {
        await this.logActivity(context);
    }
    // Método para logging de eventos de modelo
    async logModelActivity(modelName, action, userId, documentId, metadata) {
        const activityType = this.getModelActivityType(modelName, action);
        if (!activityType)
            return;
        await this.logActivity({
            userId,
            activityType,
            targetId: documentId,
            targetType: modelName.toLowerCase(),
            metadata: { ...metadata, action, modelName }
        });
    }
    // Mapear ações de modelo para ActivityType
    getModelActivityType(modelName, action) {
        const mappings = {
            'Follow': {
                'create': UserActivity_1.ActivityType.FOLLOW_USER,
                'delete': UserActivity_1.ActivityType.UNFOLLOW_USER
            },
            'Block': {
                'create': UserActivity_1.ActivityType.BLOCK_USER,
                'delete': UserActivity_1.ActivityType.UNBLOCK_USER
            },
            'Friendship': {
                'create': UserActivity_1.ActivityType.SEND_FRIEND_REQUEST,
                'update': UserActivity_1.ActivityType.ACCEPT_FRIEND_REQUEST,
                'delete': UserActivity_1.ActivityType.REJECT_FRIEND_REQUEST
            },
            'GiftTransaction': {
                'create': UserActivity_1.ActivityType.SEND_GIFT
            },
            'ChatMessage': {
                'create': UserActivity_1.ActivityType.SEND_MESSAGE,
                'delete': UserActivity_1.ActivityType.DELETE_MESSAGE
            },
            'UserPhoto': {
                'create': UserActivity_1.ActivityType.UPLOAD_PHOTO,
                'delete': UserActivity_1.ActivityType.DELETE_PHOTO
            },
            'UserVideo': {
                'create': UserActivity_1.ActivityType.UPLOAD_VIDEO,
                'delete': UserActivity_1.ActivityType.DELETE_VIDEO
            },
            'Like': {
                'create': UserActivity_1.ActivityType.LIKE_CONTENT,
                'delete': UserActivity_1.ActivityType.UNLIKE_CONTENT
            },
            'Comment': {
                'create': UserActivity_1.ActivityType.COMMENT_CONTENT
            },
            'Visitor': {
                'create': UserActivity_1.ActivityType.JOIN_LIVE
            },
            'Withdrawal': {
                'create': UserActivity_1.ActivityType.WITHDRAW_FUNDS
            }
        };
        return mappings[modelName]?.[action] || null;
    }
}
exports.ActivityLogger = ActivityLogger;
// Exportar instância singleton
exports.activityLogger = ActivityLogger.getInstance();
// Middleware factories para tipos específicos de atividades
exports.logJoinLive = exports.activityLogger.middleware(UserActivity_1.ActivityType.JOIN_LIVE, (req, res) => ({
    targetId: req.params.id || req.body.streamId,
    targetType: 'live',
    metadata: { streamTitle: req.body.title }
}));
exports.logLeaveLive = exports.activityLogger.middleware(UserActivity_1.ActivityType.LEAVE_LIVE, (req, res) => ({
    targetId: req.params.id || req.body.streamId,
    targetType: 'live'
}));
exports.logFollowUser = exports.activityLogger.middleware(UserActivity_1.ActivityType.FOLLOW_USER, (req, res) => ({
    targetId: req.params.userId || req.body.targetUserId,
    targetType: 'user',
    metadata: { followedAt: new Date() }
}));
exports.logUnfollowUser = exports.activityLogger.middleware(UserActivity_1.ActivityType.UNFOLLOW_USER, (req, res) => ({
    targetId: req.params.userId || req.body.targetUserId,
    targetType: 'user',
    metadata: { unfollowedAt: new Date() }
}));
exports.logBlockUser = exports.activityLogger.middleware(UserActivity_1.ActivityType.BLOCK_USER, (req, res) => ({
    targetId: req.params.userId || req.body.targetUserId,
    targetType: 'user',
    metadata: { reason: req.body.reason }
}));
exports.logSendGift = exports.activityLogger.middleware(UserActivity_1.ActivityType.SEND_GIFT, (req, res) => ({
    targetId: req.body.toUserId || req.params.userId,
    targetType: 'user',
    metadata: {
        giftId: req.body.giftId,
        giftName: req.body.giftName,
        quantity: req.body.quantity,
        value: req.body.value
    }
}));
exports.logSendMessage = exports.activityLogger.middleware(UserActivity_1.ActivityType.SEND_MESSAGE, (req, res) => ({
    targetId: req.body.toUserId || req.params.conversationId,
    targetType: 'conversation',
    metadata: {
        messageType: req.body.type,
        messageLength: req.body.content?.length || 0
    }
}));
exports.logUploadPhoto = exports.activityLogger.middleware(UserActivity_1.ActivityType.UPLOAD_PHOTO, (req, res) => ({
    targetType: 'photo',
    metadata: {
        fileName: req.file?.originalname,
        fileSize: req.file?.size,
        contentType: req.file?.mimetype
    }
}));
exports.logUploadVideo = exports.activityLogger.middleware(UserActivity_1.ActivityType.UPLOAD_VIDEO, (req, res) => ({
    targetType: 'video',
    metadata: {
        fileName: req.file?.originalname,
        fileSize: req.file?.size,
        duration: req.body.duration
    }
}));
exports.logLogin = exports.activityLogger.middleware(UserActivity_1.ActivityType.LOGIN, (req, res) => ({
    targetType: 'system',
    metadata: {
        loginMethod: req.body.method || 'password',
        success: true
    }
}));
exports.logLogout = exports.activityLogger.middleware(UserActivity_1.ActivityType.LOGOUT, (req, res) => ({
    targetType: 'system',
    metadata: { logoutReason: 'user_action' }
}));
exports.logUpdateProfile = exports.activityLogger.middleware(UserActivity_1.ActivityType.UPDATE_PROFILE, (req, res) => ({
    targetType: 'profile',
    metadata: {
        updatedFields: Object.keys(req.body),
        fieldsCount: Object.keys(req.body).length
    }
}));
// Função auxiliar para criar hooks de modelo
function createModelHook(modelName) {
    return {
        async postSave(doc, userId) {
            if (!userId)
                return;
            const action = doc.isNew ? 'create' : 'update';
            await exports.activityLogger.logModelActivity(modelName, action, userId, doc.id, doc.toObject());
        },
        async postDelete(doc, userId) {
            if (!userId)
                return;
            await exports.activityLogger.logModelActivity(modelName, 'delete', userId, doc.id, doc.toObject());
        }
    };
}
// Função para logging de eventos WebSocket
function logWebSocketEvent(userId, event, data, targetInfo) {
    const activityType = getWebSocketActivityType(event);
    if (!activityType)
        return;
    return exports.activityLogger.logWebSocketActivity({
        userId,
        activityType,
        targetId: targetInfo?.targetId,
        targetType: targetInfo?.targetType,
        metadata: { event, data }
    });
}
// Mapear eventos WebSocket para ActivityType
function getWebSocketActivityType(event) {
    const mappings = {
        'join_live': UserActivity_1.ActivityType.JOIN_LIVE,
        'leave_live': UserActivity_1.ActivityType.LEAVE_LIVE,
        'send_gift': UserActivity_1.ActivityType.SEND_GIFT,
        'send_message': UserActivity_1.ActivityType.SEND_MESSAGE,
        'follow_user': UserActivity_1.ActivityType.FOLLOW_USER,
        'block_user': UserActivity_1.ActivityType.BLOCK_USER
    };
    return mappings[event] || null;
}
