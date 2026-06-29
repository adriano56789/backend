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
exports.UserRoutes = void 0;
const express_1 = __importDefault(require("express"));
const models_1 = require("../models");
const auth_1 = require("../middleware/auth");
const userResponse_1 = require("../utils/userResponse");
const idHelper_1 = require("../utils/idHelper");
const appOwnerProtection_1 = require("../middleware/appOwnerProtection");
const db_1 = require("../config/db");
exports.UserRoutes = express_1.default.Router();
exports.UserRoutes.get('/me', auth_1.protect, async (req, res) => {
    try {
        // Get user ID from authenticated request (middleware protect already decoded token)
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'ID de usuário não encontrado no token' });
        }
        // Find user by ID from token (forçar leitura fresh do banco)
        let user = await models_1.User.findOne({ id: userId }).lean();
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        // Retornar resposta padronizada com status online garantido
        res.json((0, userResponse_1.standardizeUserResponse)(user));
    }
    catch (error) {
        console.error('Error in /api/users/me:', error);
        res.status(401).json({ error: 'Token inválido' });
    }
});
exports.UserRoutes.get('/', async (req, res) => {
    try {
        console.log('[USERS-LIST] Listando todos os usuários...');
        const users = await models_1.User.find().lean();
        console.log(`[USERS-LIST] Encontrados ${users.length} usuários`);
        if (!users || users.length === 0) {
            console.log('[USERS-LIST] Nenhum usuário encontrado');
            return res.json([]);
        }
        const standardizedUsers = (0, userResponse_1.standardizeUsersList)(users);
        console.log(`[USERS-LIST] Retornando ${standardizedUsers.length} usuários padronizados`);
        res.json(standardizedUsers);
    }
    catch (error) {
        console.error('[USERS-LIST] Erro ao listar usuários:', error);
        res.status(500).json({ error: 'Não foi possível carregar os usuários' });
    }
});
exports.UserRoutes.get('/:id', async (req, res) => {
    try {
        console.log(`[USER-PROFILE] Buscando perfil: ${req.params.id}`);
        // Verificar se o ID é um ObjectId válido (24 chars hex) ou ID customizado
        const paramId = req.params.id;
        let query;
        // Se for um ObjectId válido (24 chars hex), buscar por _id
        if (paramId.length === 24 && /^[0-9a-fA-F]{24}$/.test(paramId)) {
            query = { _id: paramId };
        }
        else {
            // Primeiro tenta match exato (usa índice)
            let user = await models_1.User.findOne({ id: paramId }).lean();
            if (user) {
                const userObj = typeof user.toObject === 'function' ? user.toObject() : user;
                req.params.id = user.id;
                return res.json((0, userResponse_1.standardizeUserResponse)(userObj));
            }
            // Fallback: case-insensitive
            query = { id: { $regex: new RegExp('^' + paramId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } };
        }
        const user = await models_1.User.findOne(query).lean();
        if (user) {
            // Persistir visualização de perfil se usuário estiver autenticado e for diferente do perfil visitado
            const currentUserId = (0, auth_1.getUserIdFromToken)(req);
            if (currentUserId && currentUserId !== user.id) {
                await models_1.User.findOneAndUpdate({ id: user.id }, {
                    $inc: { profileViews: 1 },
                    $push: {
                        recentActivities: {
                            action: 'profile_visit',
                            resource: 'user_profile',
                            timestamp: new Date(),
                            endpoint: `/api/users/${paramId}`
                        }
                    }
                }).catch(console.error); // Não falhar se não conseguir persistir
            }
            // Calcular distância do usuário atual até este perfil
            if (currentUserId && currentUserId !== user.id && user.location?.coordinates) {
                try {
                    const currentUser = await models_1.User.findOne({ id: currentUserId }).select('location').lean();
                    if (currentUser?.location?.coordinates) {
                        const [lng2, lat2] = user.location.coordinates;
                        const [lng1, lat1] = currentUser.location.coordinates;
                        const R = 6371;
                        const dLat = ((lat2 - lat1) * Math.PI) / 180;
                        const dLng = ((lng2 - lng1) * Math.PI) / 180;
                        const a = Math.sin(dLat / 2) ** 2 +
                            Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
                                Math.sin(dLng / 2) ** 2;
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                        const km = R * c;
                        user.distance = `${km.toFixed(0)} km de distância`;
                    }
                }
                catch { /* distance stays as-is */ }
            }
            const userObj = typeof user.toObject === 'function' ? user.toObject() : user;
            // Buscar contagens REAIS diretamente do banco (não usar campos cacheados)
            const [realFans, realFollowing] = await Promise.all([
                models_1.Followers.countDocuments({ followingId: user.id, isActive: true }),
                models_1.Followers.countDocuments({ followerId: user.id, isActive: true })
            ]);
            userObj.fans = realFans > 0 ? realFans : (userObj.followersList?.length || 0);
            userObj.following = realFollowing > 0 ? realFollowing : (userObj.followingList?.length || 0);
            return res.json((0, userResponse_1.standardizeUserResponse)(userObj));
        }
        res.status(404).json({ error: 'User not found' });
    }
    catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});
// REMOVIDO: Rota /:id/status conflitante - agora handled por userStatusRoutes
exports.UserRoutes.delete('/:id', async (req, res) => {
    await models_1.User.deleteOne({ id: req.params.id });
    res.json({ success: true });
});
exports.UserRoutes.patch("/:id", async (req, res) => {
    try {
        const paramId = req.params.id;
        let user;
        // Primeiro tenta match exato
        user = await models_1.User.findOneAndUpdate({ id: paramId }, req.body, { new: true });
        if (!user) {
            // Fallback case-insensitive
            user = await models_1.User.findOneAndUpdate({ id: { $regex: new RegExp('^' + paramId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } }, req.body, { new: true });
        }
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        if (req.body.avatarUrl) {
            const io = req.app.get("io");
            if (io)
                io.emit("avatar_updated", { userId: user.id, avatarUrl: user.avatarUrl, timestamp: new Date().toISOString() });
        }
        res.json({ success: true, user: (0, userResponse_1.standardizeUserResponse)(user) });
    }
    catch (error) {
        console.error("Erro ao atualizar perfil do usuário:", error);
        res.status(500).json({ error: error.message || "Erro interno ao atualizar perfil" });
    }
});
exports.UserRoutes.delete('/:userId/photos/:photoId', async (req, res) => {
    try {
        const { userId, photoId } = req.params;
        const user = await models_1.User.findOne({ id: userId }).select('id obras avatarUrl');
        if (!user)
            return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
        const obras = Array.isArray(user.obras) ? user.obras : [];
        const newObras = obras.filter((o) => o && o.id !== photoId);
        const foundInObras = newObras.length !== obras.length;
        if (!foundInObras) {
            const profilePhoto = await models_1.ProfilePhoto.findOne({ obraId: photoId, userId, isActive: true });
            if (!profilePhoto) {
                return res.status(404).json({ success: false, error: 'Foto não encontrada' });
            }
            await models_1.ProfilePhoto.updateOne({ obraId: photoId, userId }, { $set: { isActive: false, updatedAt: new Date() } });
            return res.json({ success: true, message: 'Foto removida com sucesso' });
        }
        const newAvatarUrl = newObras.length > 0 && newObras[0]?.id ? newObras[0].id : '';
        const updated = await models_1.User.findOneAndUpdate({ id: userId }, { $set: { obras: newObras, avatarUrl: newAvatarUrl } }, { new: true });
        await models_1.ProfilePhoto.updateOne({ obraId: photoId, userId }, { $set: { isActive: false, updatedAt: new Date() } }).catch(() => { });
        const io = req.app.get('io');
        if (io && updated)
            io.emit('avatar_updated', { userId: updated.id, avatarUrl: newAvatarUrl, timestamp: new Date().toISOString() });
        res.json({ success: true, message: 'Foto removida com sucesso' });
    }
    catch (error) {
        console.error('Erro ao remover foto:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.UserRoutes.post('/:id/toggle-follow', async (req, res) => {
    try {
        const followerId = (0, auth_1.getUserIdFromToken)(req);
        if (!followerId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const followingId = req.params.id;
        if (followerId === followingId) {
            return res.status(400).json({ error: 'Cannot follow yourself' });
        }
        // Verificar se já existe um follow
        const existingFollow = await models_1.Followers.findOne({
            followerId,
            followingId,
            isActive: true
        });
        if (existingFollow) {
            // Dar unfollow
            await models_1.Followers.findOneAndUpdate({ followerId, followingId, isActive: true }, {
                $set: {
                    isActive: false,
                    unfollowedAt: new Date()
                }
            });
            // Atualizar contadores E listas usando helper estrito
            await (0, idHelper_1.updateUserByRealId)(models_1.User, followerId, {
                $inc: { following: -1 },
                $pull: { followingList: followingId }
            });
            await (0, idHelper_1.updateUserByRealId)(models_1.User, followingId, {
                $inc: { fans: -1 },
                $pull: { followersList: followerId },
                isFollowed: false
            });
            res.json({
                success: true,
                isFollowing: false,
                message: 'Deixou de seguir com sucesso',
                updatedFollowed: {
                    id: followingId,
                    isFollowed: false,
                    isFriend: false
                }
            });
        }
        else {
            // Dar follow
            // Verificar se já existe um follow inativo para reativar
            const inactiveFollow = await models_1.Followers.findOne({
                followerId,
                followingId,
                isActive: false
            });
            if (inactiveFollow) {
                // Reativar follow existente
                await models_1.Followers.findOneAndUpdate({ followerId, followingId, isActive: false }, {
                    $set: {
                        isActive: true,
                        followedAt: new Date(),
                        unfollowedAt: undefined
                    }
                });
            }
            else {
                // Criar novo follow
                await models_1.Followers.create({
                    id: `followers_${followerId}_${followingId}`,
                    followerId,
                    followingId,
                    followedAt: new Date(),
                    isActive: true
                });
            }
            // Verificar se a pessoa já segue de volta (follow recíproco)
            const reciprocalFollow = await models_1.Followers.findOne({
                followerId: followingId,
                followingId: followerId,
                isActive: true
            });
            let isFriendship = false;
            // Se houver follow recíproco, criar amizade
            if (reciprocalFollow) {
                // Verificar se amizade já existe
                const existingFriendship = await models_1.Friendship.findOne({
                    $or: [
                        { userId1: followerId, userId2: followingId },
                        { userId1: followingId, userId2: followerId }
                    ],
                    isActive: true
                });
                if (!existingFriendship) {
                    // Criar nova amizade
                    await models_1.Friendship.create({
                        id: `friendship_${followerId}_${followingId}_${Date.now()}`,
                        userId1: followerId,
                        userId2: followingId,
                        initiatedBy: followerId,
                        friendshipStartedAt: new Date(),
                        isActive: true
                    });
                    // Atualizar friendsList de ambos os usuários
                    await models_1.User.findOneAndUpdate({ id: followerId }, {
                        $push: { friendsList: followingId }
                    });
                    await models_1.User.findOneAndUpdate({ id: followingId }, {
                        $push: { friendsList: followerId }
                    });
                    isFriendship = true;
                }
            }
            // Atualizar contadores E listas usando helper estrito
            await (0, idHelper_1.updateUserByRealId)(models_1.User, followerId, {
                $inc: { following: 1 },
                $push: { followingList: followingId }
            });
            await (0, idHelper_1.updateUserByRealId)(models_1.User, followingId, {
                $inc: { fans: 1 },
                $push: { followersList: followerId },
                isFollowed: true
            });
            // 🔧 INCREMENTAR SEGUIDORES NO STREAM SESSION se streamId estiver presente
            const { streamId } = req.body;
            if (streamId) {
                try {
                    const { incrementFollowers } = await Promise.resolve().then(() => __importStar(require('../models/StreamSession')));
                    const db = (0, db_1.getDb)();
                    await incrementFollowers(db.collection('streamsessions'), streamId);
                }
                catch (sessionErr) {
                    console.warn(`⚠️ [STREAM SESSION] Erro ao incrementar seguidores: ${sessionErr}`);
                }
            }
            // 🔔 Notificar o streamer via WebSocket sobre novo seguidor
            try {
                const io = req.app.get('io');
                if (io) {
                    const follower = await models_1.User.findOne({ id: followerId }).select('id name avatarUrl');
                    io.to(`user_${followingId}`).emit('new_follower', {
                        followerId,
                        followerName: follower?.name || 'Unknown',
                        followerAvatar: follower?.avatarUrl || '',
                        timestamp: new Date().toISOString()
                    });
                }
            }
            catch (wsErr) {
                console.warn(`⚠️ [TOGGLE-FOLLOW] Erro ao notificar WebSocket: ${wsErr}`);
            }
            res.json({
                success: true,
                isFollowing: true,
                isFriendship,
                message: isFriendship ? 'Followed and became friends!' : 'Followed successfully',
                updatedFollowed: {
                    id: followingId,
                    isFollowed: true,
                    isFriend: reciprocalFollow ? true : false
                }
            });
        }
    }
    catch (error) {
        console.error('Error in toggle-follow:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.UserRoutes.post('/:id/block', (0, appOwnerProtection_1.blockProtection)(), async (req, res) => {
    try {
        const blockerId = '10755083'; // ID fixo para demonstração - pegar do token em produção
        const blockedId = req.params.id;
        const { reason } = req.body;
        if (blockerId === blockedId) {
            return res.status(400).json({ error: 'Cannot block yourself' });
        }
        // Verificar se já existe um bloqueio ativo
        const existingBlock = await models_1.Block.findOne({
            blockerId,
            blockedId,
            isActive: true
        });
        if (existingBlock) {
            return res.status(400).json({ error: 'User already blocked' });
        }
        // Verificar se usuários existem com projeção apenas dados básicos
        const blocker = await models_1.User.findOne({ id: blockerId }).select('id name avatarUrl');
        const blocked = await models_1.User.findOne({ id: blockedId }).select('id name avatarUrl');
        if (!blocker || !blocked) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Criar bloqueio
        await models_1.Block.create({
            id: `block_${blockerId}_${blockedId}_${Date.now()}`,
            blockerId,
            blockedId,
            blockedAt: new Date(),
            isActive: true,
            reason: reason || ''
        });
        // Adicionar à lista de bloqueados do usuário
        await models_1.User.findOneAndUpdate({ id: blockerId }, { $push: { blockedUsers: blockedId } });
        // Remover follow se existir
        await models_1.Followers.findOneAndUpdate({ followerId: blockedId, followingId: blockerId, isActive: true }, { $set: { isActive: false, unfollowedAt: new Date() } });
        await models_1.Followers.findOneAndUpdate({ followerId: blockerId, followingId: blockedId, isActive: true }, { $set: { isActive: false, unfollowedAt: new Date() } });
        await models_1.Followers.findOneAndUpdate({ followerId: blockerId, followingId: blockedId, isActive: true }, { isActive: false, unfollowedAt: new Date() });
        // Atualizar contadores usando helper estrito
        await (0, idHelper_1.updateUserByRealId)(models_1.User, blockerId, {
            $inc: { following: -1 },
            $pull: { followingList: blockedId }
        });
        await (0, idHelper_1.updateUserByRealId)(models_1.User, blockedId, {
            $inc: { fans: -1 },
            $pull: { followersList: blockerId }
        });
        res.json({ success: true, message: 'Usuário bloqueado com sucesso' });
    }
    catch (error) {
        console.error('Error blocking user:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.UserRoutes.delete('/:id/unblock', async (req, res) => {
    try {
        const blockerId = '10755083'; // ID fixo para demonstração - pegar do token em produção
        const blockedId = req.params.id;
        // Verificar se existe um bloqueio ativo
        const existingBlock = await models_1.Block.findOne({
            blockerId,
            blockedId,
            isActive: true
        });
        if (!existingBlock) {
            return res.status(400).json({ error: 'User is not blocked' });
        }
        // Desbloquear
        await models_1.Block.findOneAndUpdate({ blockerId, blockedId, isActive: true }, {
            $set: {
                isActive: false,
                unblockedAt: new Date()
            }
        });
        // Remover da lista de bloqueados
        await models_1.User.findOneAndUpdate({ id: blockerId }, { $pull: { blockedUsers: blockedId } });
        res.json({ success: true, message: 'Usuário desbloqueado com sucesso' });
    }
    catch (error) {
        console.error('Error unblocking user:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.UserRoutes.post('/:id/report', async (req, res) => res.json({ success: true }));
exports.UserRoutes.get('/:id/fans', async (req, res) => {
    try {
        // ✅ PERMITIR ACESSO API NORMAL (curl, postman, insomnia, etc)
        // 🔄 CONVERSOR DE ID: MongoDB ID → ID Real da API
        let userId = req.params.id;
        if (req.needsIdConversion && req.originalMongoId) {
            // Se o middleware detectou MongoDB ID, converter para ID real
            const user = await (0, idHelper_1.findUserByAnyId)(models_1.User, req.originalMongoId);
            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }
            userId = user.id;
            console.log(`🔄 [FANS] MongoDB ID ${req.originalMongoId} convertido para ID real: ${userId}`);
        }
        else {
            // Tentar buscar usuário por id exato, depois case-insensitive, depois nome
            let user = await models_1.User.findOne({ id: userId }).select('id name followersList').lean();
            if (!user) {
                user = await models_1.User.findOne({ id: { $regex: new RegExp('^' + userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } }).select('id name followersList').lean();
            }
            if (!user) {
                user = await models_1.User.findOne({ name: { $regex: new RegExp('^' + userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } }).select('id name followersList').lean();
            }
            if (user) {
                userId = user.id;
            }
        }
        // Buscar follows ativos onde este usuário é seguido
        const follows = await models_1.Followers.find({
            followingId: userId,
            isActive: true
        });
        // Extrair IDs dos seguidores
        let followerIds = follows.map((follow) => follow.followerId);
        // FALLBACK: se Followers vazia, buscar do User.followersList
        if (followerIds.length === 0) {
            try {
                const userDoc = await models_1.User.findOne({ id: userId }).select('followersList').lean();
                if (userDoc?.followersList?.length) {
                    followerIds = userDoc.followersList;
                }
            }
            catch (_) { }
        }
        // Buscar dados completos dos seguidores COM PROTEÇÃO - Usar lean() para evitar metadados Mongoose
        let fans = await models_1.User.find({
            id: { $in: followerIds }
        }).select('id name avatarUrl level fans following isLive isOnline lastSeen identification')
            .lean();
        // FALLBACK: se não achou por id, tenta por nome
        if (fans.length === 0 && followerIds.length > 0) {
            fans = await models_1.User.find({
                name: { $in: followerIds }
            }).select('id name avatarUrl level fans following isLive isOnline lastSeen identification')
                .lean();
        }
        // ULTIMO FALLBACK: retorna os IDs como objetos mínimos (nunca vazio se tem dados)
        if (fans.length === 0 && followerIds.length > 0) {
            fans = followerIds.map(id => ({
                id,
                name: id,
                avatarUrl: '',
                level: 1,
                fans: 0,
                following: 0,
                isLive: false,
                isOnline: false,
                lastSeen: null
            }));
        }
        // 🚨 RETORNAR DADOS PROTEGIDOS - Sem informações sensíveis e sem metadados Mongoose
        // Verificar se o usuário logado segue cada fã de volta
        let myFollowIds = [];
        if (followerIds.length > 0) {
            const myFollows = await models_1.Followers.find({
                followerId: userId,
                followingId: { $in: followerIds },
                isActive: true
            }).select('followingId').lean();
            myFollowIds = myFollows.map(f => f.followingId);
        }
        const protectedFans = fans.map(fan => ({
            id: fan.id, // ID real da API
            name: fan.name,
            avatarUrl: fan.avatarUrl,
            level: fan.level,
            fans: fan.fans,
            following: fan.following,
            isLive: fan.isLive,
            isOnline: fan.isOnline,
            lastSeen: fan.lastSeen,
            isFollowed: myFollowIds.includes(fan.id),
            isFriend: myFollowIds.includes(fan.id)
            // 🚨 NÃO RETORNAR: email, phone, location, _id, __v, $__ etc
        }));
        res.json(protectedFans);
    }
    catch (error) {
        console.error('Error getting fans:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.UserRoutes.get('/:id/following', async (req, res) => {
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
            console.log(`🔄 [FOLLOWING] MongoDB ID ${req.originalMongoId} convertido para ID real: ${userId}`);
        }
        else {
            // Tentar buscar usuário por id exato, depois case-insensitive, depois nome
            let user = await models_1.User.findOne({ id: userId }).select('id name followingList').lean();
            if (!user) {
                user = await models_1.User.findOne({ id: { $regex: new RegExp('^' + userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } }).select('id name followingList').lean();
            }
            if (!user) {
                user = await models_1.User.findOne({ name: { $regex: new RegExp('^' + userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } }).select('id name followingList').lean();
            }
            if (user) {
                userId = user.id;
            }
        }
        // Buscar follows ativos do usuário
        const follows = await models_1.Followers.find({
            followerId: userId,
            isActive: true
        });
        // Extrair IDs dos usuários seguidos
        let followingIds = follows.map((follow) => follow.followingId);
        // FALLBACK: se Followers vazia, buscar do User.followingList
        if (followingIds.length === 0) {
            try {
                const userDoc = await models_1.User.findOne({ id: userId }).select('followingList').lean();
                if (userDoc?.followingList?.length) {
                    followingIds = userDoc.followingList;
                }
            }
            catch (_) { }
        }
        // Buscar dados completos dos usuários seguidos - Usar lean() para evitar metadados Mongoose
        let followingUsers = await models_1.User.find({
            id: { $in: followingIds }
        }).select('id name avatarUrl level fans following isLive isOnline lastSeen identification')
            .lean();
        // FALLBACK: se não achou por id, tenta por nome
        if (followingUsers.length === 0 && followingIds.length > 0) {
            followingUsers = await models_1.User.find({
                name: { $in: followingIds }
            }).select('id name avatarUrl level fans following isLive isOnline lastSeen identification')
                .lean();
        }
        // ULTIMO FALLBACK: retorna os IDs como objetos mínimos (nunca vazio se tem dados)
        if (followingUsers.length === 0 && followingIds.length > 0) {
            followingUsers = followingIds.map(id => ({
                id,
                name: id,
                avatarUrl: '',
                level: 1,
                fans: 0,
                following: 0,
                isLive: false,
                isOnline: false,
                lastSeen: null
            }));
        }
        // 🚨 RETORNAR DADOS PROTEGIDOS - Sem informações sensíveis e sem metadados Mongoose
        // Verificar follow mútuo: quem entre os seguidos também segue o usuário de volta
        let mutualIds = [];
        if (followingIds.length > 0) {
            const mutualFollows = await models_1.Followers.find({
                followerId: { $in: followingIds },
                followingId: userId,
                isActive: true
            }).select('followerId').lean();
            mutualIds = mutualFollows.map(f => f.followerId);
        }
        const protectedFollowing = followingUsers.map(user => ({
            id: user.id, // ID real da API
            name: user.name,
            avatarUrl: user.avatarUrl,
            level: user.level,
            fans: user.fans,
            following: user.following,
            isLive: user.isLive,
            isOnline: user.isOnline,
            lastSeen: user.lastSeen,
            isFollowed: true,
            isFriend: mutualIds.includes(user.id)
            // 🚨 NÃO RETORNAR: email, phone, location, _id, __v, $__ etc
        }));
        res.json(protectedFollowing);
    }
    catch (error) {
        console.error('Error getting following users:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.UserRoutes.get('/:id/friends', async (req, res) => {
    try {
        // 🔄 CONVERSOR DE ID: MongoDB ID → ID Real da API
        let userId = req.params.id;
        if (req.needsIdConversion && req.originalMongoId) {
            const user = await (0, idHelper_1.findUserByAnyId)(models_1.User, req.originalMongoId);
            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }
            userId = user.id;
            console.log(`🔄 [FRIENDS] MongoDB ID ${req.originalMongoId} convertido para ID real: ${userId}`);
        }
        else {
            let user = await models_1.User.findOne({ id: userId }).select('id name').lean();
            if (!user) {
                user = await models_1.User.findOne({ id: { $regex: new RegExp('^' + userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } }).select('id name').lean();
            }
            if (!user) {
                user = await models_1.User.findOne({ name: { $regex: new RegExp('^' + userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } }).select('id name').lean();
            }
            if (user) {
                userId = user.id;
            }
        }
        // Amigos = follow mútuo (eu sigo a pessoa E ela me segue)
        const myFollows = await models_1.Followers.find({
            followerId: userId,
            isActive: true
        }).select('followingId').lean();
        const myFollowIds = myFollows.map(f => f.followingId);
        if (myFollowIds.length === 0) {
            return res.json([]);
        }
        const mutualFollows = await models_1.Followers.find({
            followerId: { $in: myFollowIds },
            followingId: userId,
            isActive: true
        }).select('followerId').lean();
        let friendIds = mutualFollows.map(f => f.followerId);
        // FALLBACK: se Followers vazio, busca do User.friendsList
        if (friendIds.length === 0) {
            try {
                const userDoc = await models_1.User.findOne({ id: userId }).select('friendsList').lean();
                if (userDoc?.friendsList?.length) {
                    friendIds = userDoc.friendsList;
                }
            }
            catch (_) { }
        }
        let friends = await models_1.User.find({
            id: { $in: friendIds }
        }).select('id name avatarUrl level fans following isLive isOnline lastSeen identification').lean();
        // FALLBACK: tenta por nome
        if (friends.length === 0 && friendIds.length > 0) {
            friends = await models_1.User.find({
                name: { $in: friendIds }
            }).select('id name avatarUrl level fans following isLive isOnline lastSeen identification').lean();
        }
        // ULTIMO FALLBACK: retorna os IDs como objetos mínimos
        if (friends.length === 0 && friendIds.length > 0) {
            friends = friendIds.map(id => ({
                id,
                name: id,
                avatarUrl: '',
                level: 1,
                fans: 0,
                following: 0,
                isLive: false,
                isOnline: false,
                lastSeen: null
            }));
        }
        const protectedFriends = friends.map((friend) => ({
            id: friend.id,
            name: friend.name,
            avatarUrl: friend.avatarUrl,
            level: friend.level,
            fans: friend.fans,
            following: friend.following,
            isLive: friend.isLive,
            isOnline: friend.isOnline,
            lastSeen: friend.lastSeen,
            isFollowed: true,
            isFriend: true
        }));
        res.json(protectedFriends);
    }
    catch (error) {
        console.error('Error getting friends:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.UserRoutes.get('/:id/messages', async (req, res) => {
    try {
        const userId = req.params.id;
        // Importar ChatMessage dinamicamente para evitar dependência circular
        const { ChatMessage } = await Promise.resolve().then(() => __importStar(require('../models/index')));
        // Buscar todas as mensagens onde o usuário participou
        const messages = await ChatMessage.find({
            $or: [
                { senderId: userId },
                { receiverId: userId }
            ]
        }).sort({ sentAt: -1 });
        // Extrair IDs únicos dos interlocutores (a outra pessoa em cada conversa)
        const partnerIds = new Set();
        const lastMessageByPartner = new Map();
        messages.forEach((msg) => {
            const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
            if (partnerId && partnerId !== userId) {
                partnerIds.add(partnerId);
                // Guardar apenas a mensagem mais recente por parceiro
                if (!lastMessageByPartner.has(partnerId)) {
                    lastMessageByPartner.set(partnerId, msg);
                }
            }
        });
        if (partnerIds.size === 0) {
            return res.json([]);
        }
        // Buscar dados dos parceiros
        const partners = await models_1.User.find({ id: { $in: Array.from(partnerIds) } });
        // Contar mensagens não lidas por parceiro
        const unreadCounts = await Promise.all(Array.from(partnerIds).map(async (partnerId) => {
            const { ChatMessage: CM } = await Promise.resolve().then(() => __importStar(require('../models/index')));
            const count = await CM.countDocuments({
                senderId: partnerId,
                receiverId: userId,
                isRead: false
            });
            return { partnerId, count };
        }));
        const unreadMap = new Map();
        unreadCounts.forEach(({ partnerId, count }) => unreadMap.set(partnerId, count));
        // Montar resposta em formato Conversation
        const conversations = partners.map((partner) => {
            const lastMsg = lastMessageByPartner.get(partner.id);
            const lastMsgText = lastMsg?.content || '';
            const lastMsgTime = lastMsg?.sentAt ? new Date(lastMsg.sentAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
            return {
                id: `conv_${userId}_${partner.id}`,
                friend: partner,
                lastMessage: lastMsgText,
                timestamp: lastMsgTime,
                unreadCount: unreadMap.get(partner.id) || 0
            };
        });
        // Ordenar por mensagem mais recente primeiro
        conversations.sort((a, b) => {
            const aMsg = lastMessageByPartner.get(a.friend.id);
            const bMsg = lastMessageByPartner.get(b.friend.id);
            const aTime = aMsg?.sentAt ? new Date(aMsg.sentAt).getTime() : 0;
            const bTime = bMsg?.sentAt ? new Date(bMsg.sentAt).getTime() : 0;
            return bTime - aTime;
        });
        res.json(conversations);
    }
    catch (error) {
        console.error('Error getting conversations:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.UserRoutes.get('/me/blocklist', async (req, res) => {
    try {
        const blockerId = (0, auth_1.getUserIdFromToken)(req);
        if (!blockerId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Buscar bloqueios ativos
        const blocks = await models_1.Block.find({
            blockerId,
            isActive: true
        });
        // Extrair IDs dos usuários bloqueados
        const blockedIds = blocks.map((block) => block.blockedId);
        // Buscar dados completos dos usuários bloqueados
        const blockedUsers = await models_1.User.find({
            id: { $in: blockedIds }
        }).select('id name avatarUrl level fans following isLive isOnline lastSeen identification');
        res.json(blockedUsers);
    }
    catch (error) {
        console.error('Error getting blocklist:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.UserRoutes.get('/:id/status', async (req, res) => {
    // Buscar usuário com projeção apenas para dados de status
    const user = await models_1.User.findOne({ id: req.params.id }).select('isOnline lastSeen');
    res.json({ isOnline: user?.isOnline ?? false, lastSeen: user?.lastSeen ?? new Date().toISOString() });
});
exports.UserRoutes.get('/:id/photos', async (req, res) => {
    try {
        const userId = req.params.id;
        const photos = await models_1.Photo.find({ userId }).sort({ createdAt: -1 });
        // Buscar usuário com projeção apenas para dados básicos
        const user = await models_1.User.findOne({ id: userId }).select('id name avatarUrl level fans following isLive isOnline lastSeen').lean();
        if (!user)
            return res.status(404).json({ error: 'Usuário não encontrado' });
        const publicUser = (0, userResponse_1.standardizeUserResponse)(user);
        const formattedPhotos = photos.map(photo => {
            const photoJson = photo instanceof models_1.Photo ? photo.toJSON() : photo;
            return {
                ...photoJson,
                photoUrl: photoJson.url || photoJson.photoUrl,
                user: publicUser
            };
        });
        res.json(formattedPhotos);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.UserRoutes.get('/:id/liked-photos', async (req, res) => {
    try {
        const userId = req.params.id;
        // Basic implementation for demonstration, assuming photos liked by the user 
        // In a real application, you'd query a Like collection that maps userIds to photoIds.
        // For now, we'll just return a few recent photos and pretend they are liked.
        const photos = await models_1.Photo.find().sort({ createdAt: -1 }).limit(10);
        const userIds = [...new Set(photos.map(p => p.userId))];
        const users = await models_1.User.find({ id: { $in: userIds } });
        const userMap = users.reduce((acc, user) => {
            acc[user.id] = user;
            return acc;
        }, {});
        const formattedPhotos = photos
            .map(photo => {
            const photoJson = photo.toJSON();
            const user = userMap[photoJson.userId];
            if (!user)
                return null;
            return {
                ...photoJson,
                photoUrl: photoJson.photoUrl,
                isLiked: true,
                user: {
                    id: user.id,
                    name: user.name || user.displayName,
                    displayName: user.displayName || user.name,
                    avatarUrl: user.avatarUrl || ''
                }
            };
        })
            .filter(Boolean);
        res.json(formattedPhotos);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.UserRoutes.get('/:id/level-info', async (req, res) => {
    // Buscar usuário com projeção apenas para dados de nível
    const user = await models_1.User.findOne({ id: req.params.id }).select('level xp rank');
    if (!user)
        return res.status(404).json({ error: 'Usuário não encontrado' });
    const xpForCurrentLevel = (user.level - 1) * 1000;
    const xpForNextLevel = user.level * 1000;
    const progress = Math.min(100, Math.max(0, ((user.xp || 0) - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel) * 100));
    res.json({
        level: user.level,
        xp: user.xp || 0,
        xpForCurrentLevel,
        xpForNextLevel,
        progress,
        privileges: ['Acesso ao chat VIP', 'Emblema exclusivo'],
        nextRewards: ['Moldura Especial']
    });
});
exports.UserRoutes.post('/:id/visit', async (req, res) => {
    try {
        const { userId } = req.body;
        const profileId = req.params.id;
        if (!userId || !profileId) {
            return res.status(400).json({ error: 'userId e profileId são obrigatórios' });
        }
        if (userId === profileId) {
            return res.status(400).json({ error: 'Usuário não pode visitar o próprio perfil' });
        }
        console.log(`👁️ Usuário ${userId} visitou o perfil de ${profileId}`);
        // Verificar se ambos os usuários existem com projeção apenas dados básicos
        const [visitor, profile] = await Promise.all([
            models_1.User.findOne({ id: userId }).select('id name avatarUrl'),
            models_1.User.findOne({ id: profileId }).select('id name avatarUrl')
        ]);
        if (!visitor || !profile) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        // Importar Visitor dinamicamente para evitar dependência circular
        const { Visitor } = await Promise.resolve().then(() => __importStar(require('../models')));
        // Salvar visita no banco com upsert automático completo
        const visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        await Visitor.findOneAndUpdate({ visitorId: userId, visitedId: profileId }, {
            $set: {
                id: visitorId,
                visitorId: userId,
                visitedId: profileId,
                visitedAt: new Date(),
                visitorName: visitor.name,
                visitorAvatar: visitor.avatarUrl
            }
        }, {
            upsert: true, // Criar se não existir
            new: true
        });
        // Incrementar contador de visualizações no perfil visitado
        await models_1.User.findOneAndUpdate({ id: profileId }, { $inc: { profileViews: 1 } }).catch(console.error);
        console.log(`✅ Visita registrada: ${userId} → ${profileId}`);
        res.json({
            success: true,
            message: 'Visita registrada com sucesso'
        });
    }
    catch (error) {
        console.error('❌ Erro ao registrar visita:', error);
        res.status(500).json({ error: 'Erro ao registrar visita' });
    }
});
exports.UserRoutes.post('/:id/buy-diamonds', async (req, res) => {
    try {
        const { amount } = req.body;
        const user = await models_1.User.findOneAndUpdate({ id: req.params.id }, { $inc: { diamonds: amount } }, { new: true });
        res.json({ success: !!user, user: (0, userResponse_1.standardizeUserResponse)(user) });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.UserRoutes.get('/:id/location-permission', async (req, res) => {
    const user = await models_1.User.findOne({ id: req.params.id });
    res.json({ status: user?.locationPermission || 'prompt' });
});
exports.UserRoutes.post('/:id/location-permission', async (req, res) => {
    const user = await models_1.User.findOneAndUpdate({ id: req.params.id }, { $set: { locationPermission: req.body.status } }, { new: true });
    res.json({ success: !!user, user: (0, userResponse_1.standardizeUserResponse)(user) || {} });
});
exports.UserRoutes.post('/:id/privacy/activity', async (req, res) => {
    const user = await models_1.User.findOneAndUpdate({ id: req.params.id }, { $set: { showActivityStatus: req.body.show } }, { new: true });
    res.json({ success: !!user, user: (0, userResponse_1.standardizeUserResponse)(user) || {} });
});
exports.UserRoutes.post('/:id/privacy/location', async (req, res) => {
    const user = await models_1.User.findOneAndUpdate({ id: req.params.id }, { $set: { showLocation: req.body.show } }, { new: true });
    res.json({ success: !!user, user: (0, userResponse_1.standardizeUserResponse)(user) || {} });
});
exports.UserRoutes.get('/:id/received-gifts', async (req, res) => {
    // If Gift records are saved as PurchaseRecord we query that, otherwise just an empty real query
    const records = await models_1.PurchaseRecord.find({ userId: req.params.id, type: 'gift_received' });
    res.json(records);
});
exports.UserRoutes.post('/:id/set-active-frame', async (req, res) => {
    const user = await models_1.User.findOneAndUpdate({ id: req.params.id }, { $set: { activeFrameId: req.body.frameId } }, { new: true });
    res.json({ success: !!user, user: (0, userResponse_1.standardizeUserResponse)(user) });
});
exports.UserRoutes.get('/:id/avatar-protection', async (req, res) => {
    const user = await models_1.User.findOne({ id: req.params.id });
    res.json({ isEnabled: user?.isAvatarProtected ?? false });
});
exports.UserRoutes.post('/:id/avatar-protection', async (req, res) => {
    const user = await models_1.User.findOneAndUpdate({ id: req.params.id }, { $set: { isAvatarProtected: req.body.isEnabled } }, { new: true });
    // Enviar atualização em tempo real via WebSocket
    const io = require('../server').getIO();
    if (io) {
        io.emit('user_avatar_protection_updated', {
            userId: req.params.id,
            isAvatarProtected: req.body.isEnabled,
            timestamp: new Date()
        });
        console.log(`🔄 [WEBSOCKET] Avatar protection atualizado em tempo real para usuário ${req.params.id}: ${req.body.isEnabled}`);
    }
    res.json({ success: !!user, user: (0, userResponse_1.standardizeUserResponse)(user) });
});
// Comprar quadro de avatar
exports.UserRoutes.post('/:userId/frames/buy', async (req, res) => {
    try {
        const { userId } = req.params;
        const { frameId, price, duration } = req.body;
        if (!userId || !frameId || !price || !duration) {
            return res.status(400).json({ error: 'Dados incompletos' });
        }
        // Importar modelos dinamicamente
        const { Frame, UserFrame } = await Promise.resolve().then(() => __importStar(require('../models')));
        // Verificar se o frame existe
        const frame = await Frame.findOne({ id: frameId, isActive: true });
        if (!frame) {
            return res.status(404).json({ error: 'Frame não encontrado' });
        }
        // Verificar se o usuário já possui este frame ativo
        const existingFrame = await UserFrame.findOne({
            userId,
            frameId,
            isActive: true,
            expirationDate: { $gt: new Date() }
        });
        if (existingFrame) {
            return res.status(400).json({ error: 'Você já possui este frame' });
        }
        // Verificar diamonds do usuário com projeção apenas dados financeiros
        const user = await models_1.User.findOne({ id: userId }).select('id diamonds name avatarUrl');
        if (!user || user.diamonds < price) {
            return res.status(400).json({ error: 'Diamonds insuficientes' });
        }
        // Deduzir diamonds
        user.diamonds -= price;
        await user.save();
        // Calcular data de expiração
        const expirationDate = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
        // Criar registro do frame do usuário
        const userFrame = await UserFrame.create({
            id: `userframe_${userId}_${frameId}_${Date.now()}`,
            userId,
            frameId,
            purchaseDate: new Date(),
            expirationDate,
            isActive: true,
            isEquipped: false
        });
        console.log(`✅ Frame ${frameId} criado no UserFrame:`, userFrame);
        // Atualizar ownedFrames no usuário
        await models_1.User.findOneAndUpdate({ id: userId }, {
            $push: {
                ownedFrames: {
                    frameId,
                    expirationDate: expirationDate.toISOString()
                }
            }
        });
        console.log(`✅ Frame ${frameId} comprado pelo usuário ${userId}`);
        // Buscar usuário atualizado com frames
        const updatedUser = await models_1.User.findOne({ id: userId });
        res.json({
            success: true,
            user: (0, userResponse_1.standardizeUserResponse)(updatedUser),
            userFrame
        });
    }
    catch (error) {
        console.error('❌ Erro ao comprar frame:', error);
        res.status(500).json({ error: error.message });
    }
});
// Equipar quadro de avatar
exports.UserRoutes.post('/:userId/frames/equip', async (req, res) => {
    try {
        const { userId } = req.params;
        const { frameId } = req.body;
        if (!userId || !frameId) {
            return res.status(400).json({ error: 'Dados incompletos' });
        }
        // Importar modelos dinamicamente
        const { UserFrame } = await Promise.resolve().then(() => __importStar(require('../models')));
        console.log(`🔍 Procurando frame: userId=${userId}, frameId=${frameId}`);
        // Verificar se o frame pertence ao usuário usando o array ownedFrames (abordagem consistente)
        const user = await models_1.User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        console.log(`📋 Usuário encontrado:`, user.id, `ownedFrames:`, user.ownedFrames);
        // Verificar se o usuário possui este frame
        const ownedFrame = (user.ownedFrames || []).find((f) => f.frameId === frameId);
        if (!ownedFrame) {
            console.log(`❌ Frame não encontrado no ownedFrames`);
            return res.status(404).json({ error: 'Frame não encontrado' });
        }
        // Verificar se o frame não expirou
        const expirationDate = new Date(ownedFrame.expirationDate);
        if (expirationDate <= new Date()) {
            console.log(`❌ Frame expirado: ${expirationDate} vs ${new Date()}`);
            return res.status(404).json({ error: 'Frame expirado' });
        }
        console.log(`✅ Frame válido encontrado:`, ownedFrame);
        // Atualizar activeFrameId do usuário
        const updatedUser = await models_1.User.findOneAndUpdate({ id: userId }, { $set: { activeFrameId: frameId } }, { new: true });
        console.log(`✅ Frame ${frameId} equipado pelo usuário ${userId}`);
        res.json({
            success: true,
            user: (0, userResponse_1.standardizeUserResponse)(updatedUser),
            equippedFrame: ownedFrame
        });
    }
    catch (error) {
        console.error('❌ Erro ao equipar frame:', error);
        res.status(500).json({ error: error.message });
    }
});
// Desequipar quadro de avatar
exports.UserRoutes.post('/:userId/frames/unequip', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({ error: 'UserId é obrigatório' });
        }
        // Remover activeFrameId do usuário
        const updatedUser = await models_1.User.findOneAndUpdate({ id: userId }, { $set: { activeFrameId: null } }, { new: true });
        console.log(`✅ Frame desequipado pelo usuário ${userId}`);
        res.json({
            success: true,
            user: (0, userResponse_1.standardizeUserResponse)(updatedUser)
        });
    }
    catch (error) {
        console.error('❌ Erro ao desequipar frame:', error);
        res.status(500).json({ error: error.message });
    }
});
// Listar frames do usuário
exports.UserRoutes.get('/:userId/frames', async (req, res) => {
    try {
        const { userId } = req.params;
        // Importar modelos dinamicamente
        const { UserFrame, Frame } = await Promise.resolve().then(() => __importStar(require('../models')));
        // Buscar frames do usuário
        const userFrames = await UserFrame.find({
            userId,
            isActive: true,
            expirationDate: { $gt: new Date() }
        }).populate('frameId');
        // Buscar usuário para obter diamonds
        const user = await models_1.User.findOne({ id: userId });
        // Formatar resposta
        const ownedFrames = userFrames.map(uf => ({
            ...uf.toObject(),
            frame: uf.frameId
        }));
        res.json({
            ownedFrames,
            activeFrameId: user?.activeFrameId || null,
            diamonds: user?.diamonds || 0
        });
    }
    catch (error) {
        console.error('❌ Erro ao buscar frames do usuário:', error);
        res.status(500).json({ error: error.message });
    }
});
// GET /api/users/:id/online - Verificar se usuário está online
exports.UserRoutes.get('/:id/online', async (req, res) => {
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
            console.log(`🔄 [ONLINE-GET] MongoDB ID ${req.originalMongoId} convertido para ID real: ${userId}`);
        }
        // Buscar status atual do usuário
        const user = await (0, idHelper_1.findUserByAnyId)(models_1.User, userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        res.json({
            success: true,
            isOnline: user.isOnline || false,
            lastSeen: user.lastSeen || new Date().toISOString()
        });
    }
    catch (error) {
        console.error('❌ Erro ao verificar status online do usuário:', error);
        res.status(500).json({ error: error.message });
    }
});
// GET /api/users/:id/status - Verificar status completo do usuário
exports.UserRoutes.get('/:id/status', async (req, res) => {
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
            console.log(`🔄 [STATUS-GET] MongoDB ID ${req.originalMongoId} convertido para ID real: ${userId}`);
        }
        // Buscar status atual do usuário
        const user = await (0, idHelper_1.findUserByAnyId)(models_1.User, userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        const isOnline = user.isOnline || false;
        const isOffline = !isOnline;
        res.json({
            success: true,
            isOnline: isOnline,
            isOffline: isOffline,
            status: isOnline ? 'online' : 'offline',
            lastSeen: user.lastSeen || new Date().toISOString()
        });
    }
    catch (error) {
        console.error('❌ Erro ao verificar status do usuário:', error);
        res.status(500).json({ error: error.message });
    }
});
// POST /api/users/:id/online - Definir usuário como online
exports.UserRoutes.post('/:id/online', async (req, res) => {
    try {
        let userId = req.params.id;
        // Busca case-insensitive: "Adri" encontra "adri"
        let lookupUser = await models_1.User.findOne({ id: userId });
        if (!lookupUser) {
            lookupUser = await models_1.User.findOne({ id: { $regex: new RegExp('^' + userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } });
            if (lookupUser)
                userId = lookupUser.id;
        }
        if (!lookupUser && req.needsIdConversion && req.originalMongoId) {
            const user = await (0, idHelper_1.findUserByAnyId)(models_1.User, req.originalMongoId);
            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }
            userId = user.id;
            console.log(`🔄 [ONLINE] MongoDB ID ${req.originalMongoId} convertido para ID real: ${userId}`);
        }
        // Atualizar status para online
        const updatedUser = await (0, idHelper_1.updateUserByRealId)(models_1.User, userId, {
            isOnline: true,
            lastSeen: new Date().toISOString()
        });
        if (!updatedUser) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        // Notificar via WebSocket sobre mudança de status
        const io = req.app.get('io');
        if (io) {
            io.emit('user_status_changed', {
                userId,
                isOnline: true,
                lastSeen: new Date().toISOString()
            });
        }
        console.log(`🟢 Usuário ${userId} ficou online`);
        res.json({
            success: true,
            isOnline: true,
            lastSeen: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('❌ Erro ao definir usuário como online:', error);
        res.status(500).json({ error: error.message });
    }
});
// POST /api/users/:id/heartbeat - Manter usuário online (heartbeat)
exports.UserRoutes.post('/:id/heartbeat', async (req, res) => {
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
            console.log(`🔄 [HEARTBEAT] MongoDB ID ${req.originalMongoId} convertido para ID real: ${userId}`);
        }
        // Manter status online e atualizar lastSeen
        const updatedUser = await (0, idHelper_1.updateUserByRealId)(models_1.User, userId, {
            isOnline: true,
            lastSeen: new Date().toISOString()
        });
        if (!updatedUser) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        console.log(`💓 Usuário ${userId} heartbeat - mantido online`);
        res.json({
            success: true,
            isOnline: true,
            lastSeen: new Date().toISOString(),
            message: 'Heartbeat recebido'
        });
    }
    catch (error) {
        console.error('❌ Erro ao processar heartbeat:', error);
        res.status(500).json({ error: error.message });
    }
});
// POST /api/users/:id/offline - Definir usuário como offline
exports.UserRoutes.post('/:id/offline', async (req, res) => {
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
            console.log(`🔄 [OFFLINE] MongoDB ID ${req.originalMongoId} convertido para ID real: ${userId}`);
        }
        // Atualizar status para offline
        const updatedUser = await (0, idHelper_1.updateUserByRealId)(models_1.User, userId, {
            isOnline: false,
            lastSeen: new Date().toISOString()
        });
        if (!updatedUser) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        // Notificar via WebSocket sobre mudança de status
        const io = req.app.get('io');
        if (io) {
            io.emit('user_status_changed', {
                userId,
                isOnline: false,
                lastSeen: new Date().toISOString()
            });
        }
        console.log(`🔴 Usuário ${userId} ficou offline`);
        res.json({
            success: true,
            isOnline: false,
            lastSeen: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('❌ Erro ao definir usuário como offline:', error);
        res.status(500).json({ error: error.message });
    }
});
// Rota para registrar permissões de câmera/microfone
exports.UserRoutes.post('/permissions', auth_1.protect, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'ID de usuário não encontrado no token' });
        }
        const { type, decision, timestamp } = req.body;
        if (!type || !decision) {
            return res.status(400).json({ error: 'Tipo e decisão são obrigatórios' });
        }
        if (!['camera', 'microphone'].includes(type)) {
            return res.status(400).json({ error: 'Tipo de permissão inválido' });
        }
        if (!['always', 'once', 'deny'].includes(decision)) {
            return res.status(400).json({ error: 'Decisão inválida' });
        }
        console.log(`[USER_PERMISSIONS] Usuário ${userId} - Permissão ${type}: ${decision}`);
        // Mapear decision (always/once/deny) para status (granted/prompt/denied)
        const permissionStatus = {
            always: 'granted',
            once: 'granted',
            deny: 'denied'
        };
        const status = permissionStatus[decision] || 'prompt';
        // Salvar permissão no banco de dados
        const updateField = type === 'camera'
            ? { cameraPermissionStatus: status }
            : { microphonePermissionStatus: status };
        await models_1.User.findOneAndUpdate({ id: userId }, { $set: updateField });
        console.log(`[USER_PERMISSIONS] Salvo: ${type} = ${status} para usuário ${userId}`);
        res.json({
            success: true,
            message: 'Permissão registrada com sucesso',
            data: {
                userId,
                type,
                decision,
                status,
                timestamp: timestamp || new Date().toISOString()
            }
        });
    }
    catch (error) {
        console.error('❌ Erro ao registrar permissão:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = exports.UserRoutes;
