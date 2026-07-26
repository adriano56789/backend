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
const UserSearchService_1 = require("../services/UserSearchService");
const models_1 = require("../models");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// @route GET /api/search/users?q=termo&limit=20
// Buscar usuários por ID ou nome
router.get('/users', async (req, res) => {
    try {
        const { q, limit = 20 } = req.query;
        if (!q || typeof q !== 'string') {
            return res.status(400).json({
                error: 'Parâmetro de busca "q" é obrigatório'
            });
        }
        // Obter ID do usuário para persistir atividade
        const userId = (0, auth_1.getUserIdFromToken)(req);
        const results = await UserSearchService_1.UserSearchService.searchUsers(q, parseInt(limit));
        // Persistir atividade de busca se usuário estiver autenticado
        if (userId) {
            await models_1.User.findOneAndUpdate({ id: userId }, {
                $inc: { searchesPerformed: 1 },
                $push: { recentActivities: { $each: [{
                                action: 'search',
                                resource: 'search_query',
                                timestamp: new Date(),
                                endpoint: '/api/search/users'
                            }], $slice: -50 } }
            }).catch(console.error); // Não falhar se não conseguir persistir
        }
        res.json({
            success: true,
            query: q,
            count: results.length,
            users: results
        });
    }
    catch (error) {
        console.error('Erro na busca de usuários:', error);
        res.status(500).json({
            error: 'Erro interno na busca de usuários'
        });
    }
});
// @route POST /api/search/sync
// Sincronizar manualmente todos os usuários (admin)
router.post('/sync', async (req, res) => {
    try {
        await UserSearchService_1.UserSearchService.syncAllUsers();
        res.json({
            success: true,
            message: 'Sincronização iniciada com sucesso'
        });
    }
    catch (error) {
        console.error('Erro na sincronização:', error);
        res.status(500).json({
            error: 'Erro na sincronização'
        });
    }
});
// @route POST /api/search/cleanup
// Limpar usuários inativos do índice (admin)
router.post('/cleanup', async (req, res) => {
    try {
        await UserSearchService_1.UserSearchService.cleanupInactiveUsers();
        res.json({
            success: true,
            message: 'Limpeza concluída com sucesso'
        });
    }
    catch (error) {
        console.error('Erro na limpeza:', error);
        res.status(500).json({
            error: 'Erro na limpeza'
        });
    }
});
// @route GET /api/search/stats
// Estatísticas do índice de busca
router.get('/stats', async (req, res) => {
    try {
        const { UserIndex } = await Promise.resolve().then(() => __importStar(require('../models')));
        const totalUsers = await UserIndex.countDocuments({ isActive: true });
        const inactiveUsers = await UserIndex.countDocuments({ isActive: false });
        res.json({
            success: true,
            stats: {
                totalActiveUsers: totalUsers,
                totalInactiveUsers: inactiveUsers,
                totalUsers: totalUsers + inactiveUsers
            }
        });
    }
    catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({
            error: 'Erro ao buscar estatísticas'
        });
    }
});
exports.default = router;
