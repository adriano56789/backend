import { Request, Response, NextFunction } from 'express';
import { UserActivity, ActivityType } from '../models/UserActivity';
import { getUserIdFromToken } from './auth';

// Interface para contexto da atividade
export interface ActivityContext {
    userId: string;
    activityType: ActivityType;
    targetId?: string;
    targetType?: string;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    location?: any;
    deviceInfo?: any;
}

// Classe principal do Activity Logger
export class ActivityLogger {
    private static instance: ActivityLogger;
    private isEnabled: boolean = true;
    
    private constructor() {}
    
    static getInstance(): ActivityLogger {
        if (!ActivityLogger.instance) {
            ActivityLogger.instance = new ActivityLogger();
        }
        return ActivityLogger.instance;
    }
    
    // Habilitar/desabilitar logging
    enable(enabled: boolean = true): void {
        this.isEnabled = enabled;
    }
    
    // Método principal para registrar atividade
    async logActivity(context: ActivityContext): Promise<void> {
        if (!this.isEnabled) return;
        
        try {
            const { UserActivity } = await import('../models/UserActivity');
            await (UserActivity as any).logActivity(context);
        } catch (error) {
            console.error('Error logging activity:', error);
            // Não lançar erro para não afetar a operação principal
        }
    }
    
    // Extrair informações do request
    private extractContext(req: Request): Partial<ActivityContext> {
        const context: Partial<ActivityContext> = {};
        
        // IP Address
        context.ipAddress = req.ip || 
                          req.connection.remoteAddress || 
                          req.socket.remoteAddress ||
                          (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim();
        
        // User Agent
        context.userAgent = req.headers['user-agent'];
        
        // Session ID (se existir)
        context.sessionId = (req as any).sessionId || 
                           (req as any).session?.id ||
                           req.headers['x-session-id'] as string;
        
        // Device Info
        if (context.userAgent) {
            context.deviceInfo = this.parseUserAgent(context.userAgent);
        }
        
        return context;
    }
    
    // Parse User Agent para extrair informações do dispositivo
    private parseUserAgent(userAgent: string): any {
        const deviceInfo: any = {};
        
        // Mobile detection
        deviceInfo.mobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
        
        // Browser detection
        if (userAgent.includes('Chrome')) deviceInfo.browser = 'Chrome';
        else if (userAgent.includes('Firefox')) deviceInfo.browser = 'Firefox';
        else if (userAgent.includes('Safari')) deviceInfo.browser = 'Safari';
        else if (userAgent.includes('Edge')) deviceInfo.browser = 'Edge';
        else if (userAgent.includes('Opera')) deviceInfo.browser = 'Opera';
        else deviceInfo.browser = 'Unknown';
        
        // Platform detection
        if (userAgent.includes('Windows')) deviceInfo.platform = 'Windows';
        else if (userAgent.includes('Mac')) deviceInfo.platform = 'macOS';
        else if (userAgent.includes('Linux')) deviceInfo.platform = 'Linux';
        else if (userAgent.includes('Android')) deviceInfo.platform = 'Android';
        else if (userAgent.includes('iOS')) deviceInfo.platform = 'iOS';
        else deviceInfo.platform = 'Unknown';
        
        return deviceInfo;
    }
    
    // Middleware Express para logging automático
    middleware(activityType: ActivityType, targetExtractor?: (req: Request, res: Response) => { targetId?: string; targetType?: string; metadata?: any }) {
        return async (req: Request, res: Response, next: NextFunction) => {
            if (!this.isEnabled) {
                return next();
            }
            
            // Executar a rota primeiro
            const originalSend = res.send;
            let responseData: any;
            let isSuccess = false;
            
            // Intercept response
            res.send = function(data) {
                responseData = data;
                isSuccess = res.statusCode >= 200 && res.statusCode < 300;
                return originalSend.call(this, data);
            };
            
            // Continuar com a requisição
            res.on('finish', async () => {
                // Só logar se a requisição foi bem-sucedida
                if (!isSuccess) return;
                
                try {
                    const userId = await getUserIdFromToken(req);
                    if (!userId) return;
                    
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
                    
                    await this.logActivity(context as ActivityContext);
                } catch (error) {
                    console.error('Error in activity middleware:', error);
                }
            });
            
            next();
        };
    }
    
    // Método para logging manual (para eventos internos)
    async logManualActivity(context: ActivityContext): Promise<void> {
        await this.logActivity(context);
    }
    
    // Método para logging de WebSocket
    async logWebSocketActivity(context: ActivityContext): Promise<void> {
        await this.logActivity(context);
    }
    
    // Método para logging de eventos de modelo
    async logModelActivity(modelName: string, action: string, userId: string, documentId: string, metadata?: any): Promise<void> {
        const activityType = this.getModelActivityType(modelName, action);
        if (!activityType) return;
        
        await this.logActivity({
            userId,
            activityType,
            targetId: documentId,
            targetType: modelName.toLowerCase(),
            metadata: { ...metadata, action, modelName }
        });
    }
    
    // Mapear ações de modelo para ActivityType
    private getModelActivityType(modelName: string, action: string): ActivityType | null {
        const mappings: Record<string, Record<string, ActivityType>> = {
            'Follow': {
                'create': ActivityType.FOLLOW_USER,
                'delete': ActivityType.UNFOLLOW_USER
            },
            'Block': {
                'create': ActivityType.BLOCK_USER,
                'delete': ActivityType.UNBLOCK_USER
            },
            'Friendship': {
                'create': ActivityType.SEND_FRIEND_REQUEST,
                'update': ActivityType.ACCEPT_FRIEND_REQUEST,
                'delete': ActivityType.REJECT_FRIEND_REQUEST
            },
            'GiftTransaction': {
                'create': ActivityType.SEND_GIFT
            },
            'ChatMessage': {
                'create': ActivityType.SEND_MESSAGE,
                'delete': ActivityType.DELETE_MESSAGE
            },
            'UserPhoto': {
                'create': ActivityType.UPLOAD_PHOTO,
                'delete': ActivityType.DELETE_PHOTO
            },
            'UserVideo': {
                'create': ActivityType.UPLOAD_VIDEO,
                'delete': ActivityType.DELETE_VIDEO
            },
            'Like': {
                'create': ActivityType.LIKE_CONTENT,
                'delete': ActivityType.UNLIKE_CONTENT
            },
            'Comment': {
                'create': ActivityType.COMMENT_CONTENT
            },
            'Visitor': {
                'create': ActivityType.JOIN_LIVE
            },
            'Withdrawal': {
                'create': ActivityType.WITHDRAW_FUNDS
            }
        };
        
        return mappings[modelName]?.[action] || null;
    }
}

// Exportar instância singleton
export const activityLogger = ActivityLogger.getInstance();

// Middleware factories para tipos específicos de atividades
export const logJoinLive = activityLogger.middleware(ActivityType.JOIN_LIVE, (req, res) => ({
    targetId: req.params.id || req.body.streamId,
    targetType: 'live',
    metadata: { streamTitle: req.body.title }
}));

export const logLeaveLive = activityLogger.middleware(ActivityType.LEAVE_LIVE, (req, res) => ({
    targetId: req.params.id || req.body.streamId,
    targetType: 'live'
}));

export const logFollowUser = activityLogger.middleware(ActivityType.FOLLOW_USER, (req, res) => ({
    targetId: req.params.userId || req.body.targetUserId,
    targetType: 'user',
    metadata: { followedAt: new Date() }
}));

export const logUnfollowUser = activityLogger.middleware(ActivityType.UNFOLLOW_USER, (req, res) => ({
    targetId: req.params.userId || req.body.targetUserId,
    targetType: 'user',
    metadata: { unfollowedAt: new Date() }
}));

export const logBlockUser = activityLogger.middleware(ActivityType.BLOCK_USER, (req, res) => ({
    targetId: req.params.userId || req.body.targetUserId,
    targetType: 'user',
    metadata: { reason: req.body.reason }
}));

export const logSendGift = activityLogger.middleware(ActivityType.SEND_GIFT, (req, res) => ({
    targetId: req.body.toUserId || req.params.userId,
    targetType: 'user',
    metadata: { 
        giftId: req.body.giftId,
        giftName: req.body.giftName,
        quantity: req.body.quantity,
        value: req.body.value
    }
}));

export const logSendMessage = activityLogger.middleware(ActivityType.SEND_MESSAGE, (req, res) => ({
    targetId: req.body.toUserId || req.params.conversationId,
    targetType: 'conversation',
    metadata: { 
        messageType: req.body.type,
        messageLength: req.body.content?.length || 0
    }
}));

export const logUploadPhoto = activityLogger.middleware(ActivityType.UPLOAD_PHOTO, (req, res) => ({
    targetType: 'photo',
    metadata: { 
        fileName: req.file?.originalname,
        fileSize: req.file?.size,
        contentType: req.file?.mimetype
    }
}));

export const logUploadVideo = activityLogger.middleware(ActivityType.UPLOAD_VIDEO, (req, res) => ({
    targetType: 'video',
    metadata: { 
        fileName: req.file?.originalname,
        fileSize: req.file?.size,
        duration: req.body.duration
    }
}));

export const logLogin = activityLogger.middleware(ActivityType.LOGIN, (req, res) => ({
    targetType: 'system',
    metadata: { 
        loginMethod: req.body.method || 'password',
        success: true
    }
}));

export const logLogout = activityLogger.middleware(ActivityType.LOGOUT, (req, res) => ({
    targetType: 'system',
    metadata: { logoutReason: 'user_action' }
}));

export const logUpdateProfile = activityLogger.middleware(ActivityType.UPDATE_PROFILE, (req, res) => ({
    targetType: 'profile',
    metadata: { 
        updatedFields: Object.keys(req.body),
        fieldsCount: Object.keys(req.body).length
    }
}));

// Função auxiliar para criar hooks de modelo
export function createModelHook(modelName: string) {
    return {
        async postSave(doc: any, userId?: string) {
            if (!userId) return;
            const action = doc.isNew ? 'create' : 'update';
            await activityLogger.logModelActivity(modelName, action, userId, doc.id, doc.toObject());
        },
        
        async postDelete(doc: any, userId?: string) {
            if (!userId) return;
            await activityLogger.logModelActivity(modelName, 'delete', userId, doc.id, doc.toObject());
        }
    };
}

// Função para logging de eventos WebSocket
export function logWebSocketEvent(userId: string, event: string, data: any, targetInfo?: { targetId?: string; targetType?: string }) {
    const activityType = getWebSocketActivityType(event);
    if (!activityType) return;
    
    return activityLogger.logWebSocketActivity({
        userId,
        activityType,
        targetId: targetInfo?.targetId,
        targetType: targetInfo?.targetType,
        metadata: { event, data }
    });
}

// Mapear eventos WebSocket para ActivityType
function getWebSocketActivityType(event: string): ActivityType | null {
    const mappings: Record<string, ActivityType> = {
        'join_live': ActivityType.JOIN_LIVE,
        'leave_live': ActivityType.LEAVE_LIVE,
        'send_gift': ActivityType.SEND_GIFT,
        'send_message': ActivityType.SEND_MESSAGE,
        'follow_user': ActivityType.FOLLOW_USER,
        'block_user': ActivityType.BLOCK_USER
    };
    
    return mappings[event] || null;
}
