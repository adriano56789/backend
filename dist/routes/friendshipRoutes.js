"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const models_1 = require("../models");
const router = express_1.default.Router();
// POST /api/friends - Adicionar amigo
router.post('/', async (req, res) => {
    try {
        const { userId1, userId2 } = req.body;
        if (!userId1 || !userId2) {
            return res.status(400).json({ error: 'userId1 e userId2 são obrigatórios' });
        }
        if (userId1 === userId2) {
            return res.status(400).json({ error: 'Você não pode adicionar a si mesmo como amigo' });
        }
        // Verificar se já são amigos
        const existingFriendship = await models_1.Friendship.findOne({
            $or: [
                { userId1, userId2 },
                { userId1: userId2, userId2: userId1 }
            ],
            isActive: true
        });
        if (existingFriendship) {
            return res.status(400).json({ error: 'Vocês já são amigos' });
        }
        // Verificar se usuários existem
        const [user1, user2] = await Promise.all([
            models_1.User.findOne({ id: userId1 }),
            models_1.User.findOne({ id: userId2 })
        ]);
        if (!user1 || !user2) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        // Criar amizade + persistir atividade
        const friendship = await models_1.Friendship.create({
            _id: `friendship_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId1,
            userId2,
            initiatedBy: userId1,
            friendshipStartedAt: new Date(),
            isActive: true
        });
        // Persistir atividade de amizade para ambos usuários
        await Promise.all([
            models_1.User.findOneAndUpdate({ id: userId1 }, {
                $push: {
                    recentActivities: {
                        action: 'friend_added',
                        resource: 'social_interaction',
                        timestamp: new Date(),
                        endpoint: '/api/friends'
                    }
                }
            }),
            models_1.User.findOneAndUpdate({ id: userId2 }, {
                $push: {
                    recentActivities: {
                        action: 'friend_added',
                        resource: 'social_interaction',
                        timestamp: new Date(),
                        endpoint: '/api/friends'
                    }
                }
            })
        ]).catch(console.error);
        // Notificar ambos os usuários via WebSocket
        const friendshipData = {
            friendshipId: friendship.id,
            friend: {
                id: user2.id,
                name: user2.name,
                avatarUrl: user2.avatarUrl,
                level: user2.level,
                isOnline: user2.isOnline
            },
            timestamp: new Date()
        };
        // Notificar ambos os usuários via WebSocket
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${userId1}`).emit('friend_added', friendshipData);
            io.to(`user_${userId2}`).emit('friend_added', {
                ...friendshipData,
                friend: {
                    id: user1.id,
                    name: user1.name,
                    avatarUrl: user1.avatarUrl,
                    level: user1.level,
                    isOnline: user1.isOnline
                }
            });
        }
        console.log(`✅ Amizade criada: ${userId1} ↔ ${userId2}`);
        res.json({
            success: true,
            friendship,
            user1: {
                id: user1.id,
                name: user1.name,
                avatarUrl: user1.avatarUrl
            },
            user2: {
                id: user2.id,
                name: user2.name,
                avatarUrl: user2.avatarUrl
            }
        });
    }
    catch (error) {
        console.error('❌ Erro ao criar amizade:', error);
        res.status(500).json({ error: 'Erro interno ao criar amizade' });
    }
});
// GET /api/friends/:userId - Listar amigos de um usuário
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        console.log(`🔍 Buscando amigos do usuário: ${userId}`);
        // Persistir atividade de consulta de lista de amigos
        await models_1.User.findOneAndUpdate({ id: userId }, {
            $push: {
                recentActivities: {
                    action: 'friends_listed',
                    resource: 'social_interaction',
                    timestamp: new Date(),
                    endpoint: '/api/friends/:userId'
                }
            }
        }).catch(console.error);
        // Buscar relações de amizade ativas
        const friendships = await models_1.Friendship.find({
            $or: [
                { userId1: userId, isActive: true },
                { userId2: userId, isActive: true }
            ]
        })
            .sort({ friendshipStartedAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(offset));
        // Extrair IDs dos amigos
        const friendIds = friendships.map(f => f.userId1 === userId ? f.userId2 : f.userId1);
        // Buscar detalhes dos amigos
        const friends = await models_1.User.find({
            id: { $in: friendIds }
        }).select('id name avatarUrl level fans isOnline lastSeen identification');
        // Combinar dados
        const friendsWithDetails = friendships.map(friendship => {
            const friendId = friendship.userId1 === userId ? friendship.userId2 : friendship.userId1;
            const friendDetails = friends.find(f => f.id === friendId);
            return {
                friendshipId: friendship.id,
                friendsSince: friendship.friendshipStartedAt,
                friend: friendDetails
            };
        });
        console.log(`📊 Encontrados ${friendsWithDetails.length} amigos para ${userId}`);
        res.json({
            success: true,
            friends: friendsWithDetails,
            total: friendsWithDetails.length
        });
    }
    catch (error) {
        console.error('❌ Erro ao buscar amigos:', error);
        res.status(500).json({ error: 'Erro interno ao buscar amigos' });
    }
});
// DELETE /api/friends/:id - Remover amigo
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body; // Para validação
        // Buscar amizade
        const friendship = await models_1.Friendship.findOne({ id });
        if (!friendship) {
            return res.status(404).json({ error: 'Amizade não encontrada' });
        }
        if (userId && friendship.userId1 !== userId && friendship.userId2 !== userId) {
            return res.status(403).json({ error: 'Não autorizado' });
        }
        // Desativar amizade (soft delete) + persistir atividade
        await models_1.Friendship.updateOne({ id }, {
            $set: {
                isActive: false
            }
        });
        // Persistir atividade de remoção de amizade para ambos usuários
        await Promise.all([
            models_1.User.findOneAndUpdate({ id: friendship.userId1 }, {
                $push: {
                    recentActivities: {
                        action: 'friend_removed',
                        resource: 'social_interaction',
                        timestamp: new Date(),
                        endpoint: '/api/friends/:id'
                    }
                }
            }),
            models_1.User.findOneAndUpdate({ id: friendship.userId2 }, {
                $push: {
                    recentActivities: {
                        action: 'friend_removed',
                        resource: 'social_interaction',
                        timestamp: new Date(),
                        endpoint: '/api/friends/:id'
                    }
                }
            })
        ]).catch(console.error);
        // Notificar ambos os usuários via WebSocket
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${friendship.userId1}`).emit('friend_removed', {
                friendshipId: id,
                friendId: friendship.userId2,
                timestamp: new Date()
            });
            io.to(`user_${friendship.userId2}`).emit('friend_removed', {
                friendshipId: id,
                friendId: friendship.userId1,
                timestamp: new Date()
            });
        }
        console.log(`✅ Amizade removida: ${friendship.userId1} ↔ ${friendship.userId2}`);
        res.json({
            success: true,
            message: 'Amizade removida com sucesso'
        });
    }
    catch (error) {
        console.error('❌ Erro ao remover amizade:', error);
        res.status(500).json({ error: 'Erro interno ao remover amizade' });
    }
});
// GET /api/friends/check/:userId1/:userId2 - Verificar se são amigos
router.get('/check/:userId1/:userId2', async (req, res) => {
    try {
        const { userId1, userId2 } = req.params;
        // Persistir atividade de verificação de amizade
        await models_1.User.findOneAndUpdate({ id: userId1 }, {
            $push: {
                recentActivities: {
                    action: 'friendship_checked',
                    resource: 'social_interaction',
                    timestamp: new Date(),
                    endpoint: '/api/friends/check/:userId1/:userId2'
                }
            }
        }).catch(console.error);
        const friendship = await models_1.Friendship.findOne({
            $or: [
                { userId1, userId2 },
                { userId1: userId2, userId2: userId1 }
            ],
            isActive: true
        });
        res.json({
            success: true,
            areFriends: !!friendship,
            friendshipId: friendship?.id || null,
            friendsSince: friendship?.friendshipStartedAt || null
        });
    }
    catch (error) {
        console.error('❌ Erro ao verificar amizade:', error);
        res.status(500).json({ error: 'Erro interno ao verificar amizade' });
    }
});
// GET /api/friends/mutual/:userId1/:userId2 - Listar amigos em comum
router.get('/mutual/:userId1/:userId2', async (req, res) => {
    try {
        const { userId1, userId2 } = req.params;
        const { limit = 20 } = req.query;
        console.log(`🔍 Buscando amigos em comum: ${userId1} ↔ ${userId2}`);
        // Buscar amigos de ambos os usuários
        const [friends1, friends2] = await Promise.all([
            models_1.Friendship.find({
                $or: [
                    { userId1: userId1, isActive: true },
                    { userId2: userId1, isActive: true }
                ]
            }),
            models_1.Friendship.find({
                $or: [
                    { userId1: userId2, isActive: true },
                    { userId2: userId2, isActive: true }
                ]
            })
        ]);
        // Extrair IDs dos amigos
        const friendIds1 = friends1.map(f => f.userId1 === userId1 ? f.userId2 : f.userId1);
        const friendIds2 = friends2.map(f => f.userId1 === userId2 ? f.userId2 : f.userId1);
        // Encontrar amigos em comum
        const mutualIds = friendIds1.filter(id => friendIds2.includes(id));
        // Buscar detalhes dos amigos em comum
        const mutualFriends = await models_1.User.find({
            id: { $in: mutualIds }
        })
            .select('id name avatarUrl level fans isOnline')
            .limit(parseInt(limit));
        console.log(`📊 Encontrados ${mutualFriends.length} amigos em comum`);
        res.json({
            success: true,
            mutualFriends,
            total: mutualFriends.length
        });
    }
    catch (error) {
        console.error('❌ Erro ao buscar amigos em comum:', error);
        res.status(500).json({ error: 'Erro interno ao buscar amigos em comum' });
    }
});
exports.default = router;
