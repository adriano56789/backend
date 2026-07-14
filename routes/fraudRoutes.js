"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FraudManagementRoutes = void 0;
const BannedEntity_1 = require("../models/BannedEntity");
const models_1 = require("../models");
const fraudDetection_1 = __importDefault(require("../middleware/fraudDetection"));
class FraudManagementRoutes {
    static setup(router) {
        // Banir entidade manualmente (admin)
        router.post('/ban/entity', async (req, res) => {
            try {
                const { entityType, entityId, reason, evidence, permanent } = req.body;
                if (!entityType || !entityId || !reason) {
                    return res.status(400).json({
                        error: 'Campos obrigatórios: entityType, entityId, reason'
                    });
                }
                const ban = await fraudDetection_1.default.banEntity(entityType, entityId, reason, evidence, permanent !== false);
                // Persistir atividade administrativa de banimento
                if (req.headers['admin-user-id']) {
                    await models_1.User.findOneAndUpdate({ id: req.headers['admin-user-id'] }, {
                        $push: {
                            recentActivities: {
                                action: 'admin_entity_banned',
                                resource: 'fraud_management',
                                timestamp: new Date(),
                                endpoint: '/api/fraud/ban/entity'
                            }
                        }
                    }).catch(console.error);
                }
                res.json({
                    success: true,
                    ban: {
                        entityType: ban.entityType,
                        entityId: ban.entityId,
                        reason: ban.reason,
                        permanent: ban.permanent,
                        expiresAt: ban.expiresAt,
                        bannedAt: ban.bannedAt
                    }
                });
            }
            catch (error) {
                console.error('❌ [FRAUD ADMIN] Erro ao banir entidade:', error);
                res.status(500).json({ error: error.message });
            }
        });
        // Banir múltiplas entidades relacionadas (admin)
        router.post('/ban/related', async (req, res) => {
            try {
                const { ip, deviceFingerprint, userId, userEmail, reason, evidence } = req.body;
                if (!reason) {
                    return res.status(400).json({
                        error: 'Campo obrigatório: reason'
                    });
                }
                const bans = await fraudDetection_1.default.banRelatedEntities(ip, deviceFingerprint, userId, userEmail, reason, evidence);
                // Persistir atividade administrativa de banimento em massa
                if (req.headers['admin-user-id']) {
                    await models_1.User.findOneAndUpdate({ id: req.headers['admin-user-id'] }, {
                        $push: {
                            recentActivities: {
                                action: 'admin_related_entities_banned',
                                resource: 'fraud_management',
                                timestamp: new Date(),
                                endpoint: '/api/fraud/ban/related'
                            }
                        }
                    }).catch(console.error);
                }
                res.json({
                    success: true,
                    bansCount: bans.length,
                    bans: bans.map(ban => ({
                        entityType: ban.entityType,
                        entityId: ban.entityId,
                        reason: ban.reason,
                        permanent: ban.permanent,
                        expiresAt: ban.expiresAt
                    }))
                });
            }
            catch (error) {
                console.error('❌ [FRAUD ADMIN] Erro ao banir entidades relacionadas:', error);
                res.status(500).json({ error: error.message });
            }
        });
        // Listar entidades banidas (admin)
        router.get('/banned', async (req, res) => {
            try {
                const { entityType, active, page = 1, limit = 50 } = req.query;
                const filter = {};
                if (entityType)
                    filter.entityType = entityType;
                if (active !== undefined)
                    filter.active = active === 'true';
                const skip = (Number(page) - 1) * Number(limit);
                const bans = await BannedEntity_1.BannedEntity.find(filter)
                    .sort({ bannedAt: -1 })
                    .skip(skip)
                    .limit(Number(limit));
                const total = await BannedEntity_1.BannedEntity.countDocuments(filter);
                res.json({
                    success: true,
                    bans,
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total,
                        pages: Math.ceil(total / Number(limit))
                    }
                });
            }
            catch (error) {
                console.error('❌ [FRAUD ADMIN] Erro ao listar banimentos:', error);
                res.status(500).json({ error: error.message });
            }
        });
        // Desbanir entidade (admin)
        router.post('/unban/:entityType/:entityId', async (req, res) => {
            try {
                const { entityType, entityId } = req.params;
                const ban = await BannedEntity_1.BannedEntity.findOneAndUpdate({ entityType, entityId, active: true }, { $set: { active: false } }, { returnDocument: 'after' });
                if (!ban) {
                    return res.status(404).json({
                        error: 'Banimento não encontrado ou já inativo'
                    });
                }
                // Persistir atividade administrativa de desbanimento
                if (req.headers['admin-user-id']) {
                    await models_1.User.findOneAndUpdate({ id: req.headers['admin-user-id'] }, {
                        $push: {
                            recentActivities: {
                                action: 'admin_entity_unbanned',
                                resource: 'fraud_management',
                                timestamp: new Date(),
                                endpoint: '/api/fraud/unban/:entityType/:entityId'
                            }
                        }
                    }).catch(console.error);
                }
                console.log(`✅ [FRAUD ADMIN] Entidade desbanida: ${entityType}:${entityId}`);
                res.json({
                    success: true,
                    unbanned: {
                        entityType: ban.entityType,
                        entityId: ban.entityId,
                        reason: ban.reason,
                        bannedAt: ban.bannedAt,
                        unbannedAt: new Date()
                    }
                });
            }
            catch (error) {
                console.error('❌ [FRAUD ADMIN] Erro ao desbanir entidade:', error);
                res.status(500).json({ error: error.message });
            }
        });
        // Verificar se entidade está banida
        router.get('/check/:entityType/:entityId', async (req, res) => {
            try {
                const { entityType, entityId } = req.params;
                const ban = await BannedEntity_1.BannedEntity.findOne({
                    entityType,
                    entityId,
                    active: true,
                    $or: [
                        { permanent: true },
                        { expiresAt: { $gt: new Date() } }
                    ]
                });
                const isBanned = !!ban;
                res.json({
                    success: true,
                    isBanned,
                    ban: isBanned ? {
                        entityType: ban.entityType,
                        entityId: ban.entityId,
                        reason: ban.reason,
                        permanent: ban.permanent,
                        expiresAt: ban.expiresAt,
                        bannedAt: ban.bannedAt
                    } : null
                });
            }
            catch (error) {
                console.error('❌ [FRAUD ADMIN] Erro ao verificar banimento:', error);
                res.status(500).json({ error: error.message });
            }
        });
        // Estatísticas de fraudes (admin)
        router.get('/stats', async (req, res) => {
            try {
                const stats = await BannedEntity_1.BannedEntity.aggregate([
                    {
                        $match: { active: true }
                    },
                    {
                        $group: {
                            _id: '$entityType',
                            count: { $sum: 1 },
                            permanent: { $sum: { $cond: ['$permanent', 1, 0] } },
                            temporary: { $sum: { $cond: ['$permanent', 0, 1] } }
                        }
                    }
                ]).toArray();
                const totalBanned = await BannedEntity_1.BannedEntity.countDocuments({ active: true });
                const totalPermanent = await BannedEntity_1.BannedEntity.countDocuments({ active: true, permanent: true });
                const totalTemporary = totalBanned - totalPermanent;
                // Banimentos dos últimos 7 dias
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                const recentBans = await BannedEntity_1.BannedEntity.countDocuments({
                    bannedAt: { $gte: sevenDaysAgo }
                });
                res.json({
                    success: true,
                    stats: {
                        total: totalBanned,
                        permanent: totalPermanent,
                        temporary: totalTemporary,
                        recent7days: recentBans,
                        byType: stats.reduce((acc, stat) => {
                            acc[stat._id] = {
                                total: stat.count,
                                permanent: stat.permanent,
                                temporary: stat.temporary
                            };
                            return acc;
                        }, {})
                    }
                });
            }
            catch (error) {
                console.error('❌ [FRAUD ADMIN] Erro ao buscar estatísticas:', error);
                res.status(500).json({ error: error.message });
            }
        });
        // Limpar banimentos expirados (admin)
        router.post('/cleanup', async (req, res) => {
            try {
                const result = await BannedEntity_1.BannedEntity.updateMany({
                    active: true,
                    permanent: false,
                    expiresAt: { $lt: new Date() }
                }, { $set: { active: false } });
                // Persistir atividade administrativa de limpeza
                if (req.headers['admin-user-id']) {
                    await models_1.User.findOneAndUpdate({ id: req.headers['admin-user-id'] }, {
                        $push: {
                            recentActivities: {
                                action: 'admin_bans_cleanup',
                                resource: 'fraud_management',
                                timestamp: new Date(),
                                endpoint: '/api/fraud/cleanup'
                            }
                        }
                    }).catch(console.error);
                }
                console.log(`🧹 [FRAUD ADMIN] Limpeza de banimentos expirados: ${result.modifiedCount} atualizados`);
                res.json({
                    success: true,
                    cleaned: result.modifiedCount,
                    message: `${result.modifiedCount} banimentos expirados foram desativados`
                });
            }
            catch (error) {
                console.error('❌ [FRAUD ADMIN] Erro na limpeza de banimentos:', error);
                res.status(500).json({ error: error.message });
            }
        });
    }
}
exports.FraudManagementRoutes = FraudManagementRoutes;
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
// Configurar todas as rotas da classe
FraudManagementRoutes.setup(router);
exports.default = router;
