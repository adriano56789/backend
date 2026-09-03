"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addOwnerCheck = exports.isAppOwner = exports.blockProtection = exports.kickProtection = exports.appOwnerProtection = void 0;
/**
 * Middleware de Proteção do Dono do Aplicativo
 * Impede que qualquer ação maliciosa seja tomada contra o dono do aplicativo
 */
const appOwnerProtection = (action) => {
    return (req, res, next) => {
        try {
            // 🔐 ID DO DONO DO APLICATIVO - PROTEÇÃO MÁXIMA
            const APP_OWNER_ID = '  89366388';
            // Verificar se o ID do dono está presente nos parâmetros ou body
            const targetUserId = req.params.userId || req.params.id || req.body.userId || req.body.toUserId;
            if (targetUserId === APP_OWNER_ID) {
                console.log(`🛡️ [OWNER_PROTECTION] AÇÃO BLOQUEADA: ${action} contra o DONO do aplicativo (${APP_OWNER_ID})`);
                console.log(`   IP: ${req.ip}, User-Agent: ${req.get('User-Agent')}`);
                console.log(`   Body:`, JSON.stringify(req.body, null, 2));
                return res.status(403).json({
                    success: false,
                    error: 'PROIBIDO: Ação não permitida contra o dono do aplicativo',
                    protection: 'APP_OWNER_PROTECTED',
                    action: action,
                    targetUserId: targetUserId
                });
            }
            // Verificar se alguém tentando se passar pelo dono
            const currentUserId = req.body.currentUserId || req.body.kickerId || req.body.fromUserId;
            if (currentUserId === APP_OWNER_ID) {
                console.log(`👑 [OWNER_ACTION] Dono do aplicativo executando: ${action}`);
                // Permitir ação do dono
            }
            next();
        }
        catch (error) {
            console.error('❌ [OWNER_PROTECTION] Erro no middleware:', error);
            next();
        }
    };
};
exports.appOwnerProtection = appOwnerProtection;
/**
 * Middleware específico para proteção contra expulsão (kick)
 */
const kickProtection = (req, res, next) => {
    try {
        const APP_OWNER_ID = 'adriano56789';
        const { userId, kickerId } = req.body;
        // 🔐 PROTEÇÃO: Dono não pode ser expulso por NINGUÉM
        if (userId === APP_OWNER_ID) {
            console.log(`🛡️ [KICK_PROTECTION] TENTATIVA DE EXPULSAR DONO BLOQUEADA!`);
            console.log(`   Alvo: ${userId}, Tentativa por: ${kickerId}`);
            console.log(`   IP: ${req.ip}, Stream: ${req.params.id}`);
            return res.status(403).json({
                success: false,
                error: 'PROIBIDO: O dono do aplicativo não pode ser expulso',
                protection: 'APP_OWNER_KICK_PROTECTED',
                targetUserId: userId,
                attemptedBy: kickerId
            });
        }
        next();
    }
    catch (error) {
        console.error('❌ [KICK_PROTECTION] Erro no middleware:', error);
        next();
    }
};
exports.kickProtection = kickProtection;
/**
 * Middleware específico para proteção contra bloqueio (block)
 */
const blockProtection = () => {
    return (req, res, next) => {
        try {
            const APP_OWNER_ID = 'adriano56789';
            const { blockedId } = req.body;
            // 🔐 PROTEÇÃO: Dono não pode ser bloqueado por NINGUÉM
            if (blockedId === APP_OWNER_ID) {
                console.log(`🛡️ [BLOCK_PROTECTION] TENTATIVA DE BLOQUEAR DONO BLOQUEADA!`);
                console.log(`   Alvo: ${blockedId}, IP: ${req.ip}`);
                return res.status(403).json({
                    success: false,
                    error: 'PROIBIDO: O dono do aplicativo não pode ser bloqueado',
                    protection: 'APP_OWNER_BLOCK_PROTECTED',
                    targetUserId: blockedId
                });
            }
            next();
        }
        catch (error) {
            console.error('❌ [BLOCK_PROTECTION] Erro no middleware:', error);
            next();
        }
    };
};
exports.blockProtection = blockProtection;
/**
 * Verifica se o usuário atual é o dono do aplicativo
 */
const isAppOwner = (userId) => {
    const APP_OWNER_ID = 'adriano56789';
    return userId === APP_OWNER_ID;
};
exports.isAppOwner = isAppOwner;
/**
 * Middleware que adiciona verificação de dono em todas as requisições
 */
const addOwnerCheck = (req, res, next) => {
    try {
        const APP_OWNER_ID = 'adriano56789';
        // Adicionar flag de dono na requisição para uso posterior
        const currentUserId = req.body.userId || req.body.currentUserId || req.body.kickerId || req.params.userId;
        req.isAppOwner = currentUserId === APP_OWNER_ID;
        if (req.isAppOwner) {
            console.log(`👑 [OWNER_CHECK] Dono do aplicativo detectado: ${currentUserId}`);
        }
        next();
    }
    catch (error) {
        console.error('❌ [OWNER_CHECK] Erro no middleware:', error);
        next();
    }
};
exports.addOwnerCheck = addOwnerCheck;
exports.default = {
    appOwnerProtection: exports.appOwnerProtection,
    kickProtection: exports.kickProtection,
    blockProtection: exports.blockProtection,
    isAppOwner: exports.isAppOwner,
    addOwnerCheck: exports.addOwnerCheck
};
