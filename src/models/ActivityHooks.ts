import { activityLogger, createModelHook } from '../middleware/ActivityLogger';
import { Follow } from './Follow';
import { Block } from './Block';
import { Friendship } from './Friendship';
import { GiftTransaction } from './GiftTransaction';
import { ChatMessage } from './ChatMessage';
import { UserPhoto } from './UserPhoto';
import { UserVideo } from './UserVideo';
import { Like } from './Like';
import { Comment } from './Comment';
import { Visitor } from './Visitor';
import { Withdrawal } from './Withdrawal';
import { User } from './User';
import { Streamer } from './Streamer';

// Função para extrair userId do contexto da requisição
async function getUserIdFromContext(context?: any): Promise<string | undefined> {
    if (context?.userId) return context.userId;
    if (context?.req?.user?.id) return context.req.user.id;
    if (context?.user?.id) return context.user.id;
    try {
        const { getUserIdFromToken } = await import('../middleware/auth');
        if (context?.req) {
            return await getUserIdFromToken(context.req);
        }
    } catch (error) {
    }
    return undefined;
}

// Exportar função para inicializar todos os hooks
export function initializeActivityHooks() {
    console.log('Activity hooks initialized successfully');
}

// Exportar função para logging manual de atividades específicas
export async function logCustomActivity(userId: string, activityType: string, targetInfo?: { targetId?: string; targetType?: string; metadata?: any }) {
    await activityLogger.logManualActivity({
        userId,
        activityType: activityType as any,
        targetId: targetInfo?.targetId,
        targetType: targetInfo?.targetType,
        metadata: targetInfo?.metadata
    });
}

// Exportar função para logging de login/logout
export async function logAuthActivity(userId: string, isLogin: boolean, metadata?: any) {
    await activityLogger.logManualActivity({
        userId,
        activityType: isLogin ? 'login' as any : 'logout' as any,
        targetType: 'system',
        metadata: {
            timestamp: new Date(),
            ...metadata
        }
    });
}

// Exportar função para logging de mudança de avatar
export async function logAvatarChange(userId: string, avatarUrl: string, metadata?: any) {
    await activityLogger.logManualActivity({
        userId,
        activityType: 'change_avatar' as any,
        targetType: 'profile',
        metadata: {
            avatarUrl,
            changedAt: new Date(),
            ...metadata
        }
    });
}

// Exportar função para logging de compras
export async function logPurchaseActivity(userId: string, itemType: string, itemId: string, value: number, metadata?: any) {
    await activityLogger.logManualActivity({
        userId,
        activityType: 'purchase_item' as any,
        targetId: itemId,
        targetType: itemType,
        metadata: {
            value,
            purchaseDate: new Date(),
            ...metadata
        }
    });
}
