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
exports.initializeActivityHooks = initializeActivityHooks;
exports.logCustomActivity = logCustomActivity;
exports.logAuthActivity = logAuthActivity;
exports.logAvatarChange = logAvatarChange;
exports.logPurchaseActivity = logPurchaseActivity;
const ActivityLogger_1 = require("../middleware/ActivityLogger");
// Função para extrair userId do contexto da requisição
async function getUserIdFromContext(context) {
    if (context?.userId)
        return context.userId;
    if (context?.req?.user?.id)
        return context.req.user.id;
    if (context?.user?.id)
        return context.user.id;
    try {
        const { getUserIdFromToken } = await Promise.resolve().then(() => __importStar(require('../middleware/auth')));
        if (context?.req) {
            return await getUserIdFromToken(context.req);
        }
    }
    catch (error) {
    }
    return undefined;
}
// Exportar função para inicializar todos os hooks
function initializeActivityHooks() {
    console.log('Activity hooks initialized successfully');
}
// Exportar função para logging manual de atividades específicas
async function logCustomActivity(userId, activityType, targetInfo) {
    await ActivityLogger_1.activityLogger.logManualActivity({
        userId,
        activityType: activityType,
        targetId: targetInfo?.targetId,
        targetType: targetInfo?.targetType,
        metadata: targetInfo?.metadata
    });
}
// Exportar função para logging de login/logout
async function logAuthActivity(userId, isLogin, metadata) {
    await ActivityLogger_1.activityLogger.logManualActivity({
        userId,
        activityType: isLogin ? 'login' : 'logout',
        targetType: 'system',
        metadata: {
            timestamp: new Date(),
            ...metadata
        }
    });
}
// Exportar função para logging de mudança de avatar
async function logAvatarChange(userId, avatarUrl, metadata) {
    await ActivityLogger_1.activityLogger.logManualActivity({
        userId,
        activityType: 'change_avatar',
        targetType: 'profile',
        metadata: {
            avatarUrl,
            changedAt: new Date(),
            ...metadata
        }
    });
}
// Exportar função para logging de compras
async function logPurchaseActivity(userId, itemType, itemId, value, metadata) {
    await ActivityLogger_1.activityLogger.logManualActivity({
        userId,
        activityType: 'purchase_item',
        targetId: itemId,
        targetType: itemType,
        metadata: {
            value,
            purchaseDate: new Date(),
            ...metadata
        }
    });
}
