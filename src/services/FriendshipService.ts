// @ts-nocheck
import { Friendship } from '../models/Friendship';
import { User } from '../models/User';
import { Followers } from '../models/Followers';

export class FriendshipService {
  /**
   * Criar solicitação de amizade
   */
  static async createFriendshipRequest(data: {
    fromUserId: string;
    toUserId: string;
    message?: string;
  }) {
    try {
      const { fromUserId, toUserId, message } = data;

      // Verificar se já são amigos
      const existingFriendship = await Friendship.findOne({
        $or: [
          { userId1: fromUserId, userId2: toUserId },
          { userId1: toUserId, userId2: fromUserId }
        ],
        isActive: true
      });

      if (existingFriendship) {
        throw new Error('Already friends');
      }

      // Verificar se já existe solicitação pendente
      const existingRequest = await Friendship.findOne({
        $or: [
          { userId1: fromUserId, userId2: toUserId },
          { userId1: toUserId, userId2: fromUserId }
        ],
        isActive: false
      });

      if (existingRequest) {
        throw new Error('Friendship request already pending');
      }

      // Verificar se existe follow mútuo (pré-requisito para amizade)
      const followFromTo = await Followers.findOne({
        followerId: fromUserId,
        followingId: toUserId,
        isActive: true
      });

      const followToFrom = await Followers.findOne({
        followerId: toUserId,
        followingId: fromUserId,
        isActive: true
      });

      if (!followFromTo || !followToFrom) {
        throw new Error('Must follow each other before becoming friends');
      }

      // Criar solicitação de amizade (inativa até ser aceita)
      const friendship = await Friendship.create({
        _id: `friendship_${fromUserId}_${toUserId}_${Date.now()}`,
        userId1: fromUserId,
        userId2: toUserId,
        initiatedBy: fromUserId,
        friendshipStartedAt: new Date(),
        isActive: false,
        message: message || ''
      });

      console.log(`🤝 [FRIENDSHIP] Friendship request created: ${fromUserId} -> ${toUserId}`);
      return friendship;
    } catch (error) {
      console.error('❌ [FRIENDSHIP] Error creating friendship request:', error);
      throw error;
    }
  }

  /**
   * Aceitar solicitação de amizade
   */
  static async acceptFriendshipRequest(friendshipId: string, userId: string) {
    try {
      const friendship = await Friendship.findOne({
        _id: friendshipId as any,
        $or: [{ userId1: userId }, { userId2: userId }],
        isActive: false
      });

      if (!friendship) {
        throw new Error('Friendship request not found or unauthorized');
      }

      // Ativar amizade
      friendship.isActive = true;
      friendship.friendshipStartedAt = new Date();
      await friendship.save();

      // Adicionar às listas de amigos
      await User.findOneAndUpdate(
        { id: friendship.userId1 },
        { $push: { friendsList: friendship.userId2 } }
      );

      await User.findOneAndUpdate(
        { id: friendship.userId2 },
        { $push: { friendsList: friendship.userId1 } }
      );

      console.log(`🤝 [FRIENDSHIP] Friendship accepted: ${friendship.userId1} <-> ${friendship.userId2}`);
      return friendship;
    } catch (error) {
      console.error('❌ [FRIENDSHIP] Error accepting friendship request:', error);
      throw error;
    }
  }

  /**
   * Rejeitar solicitação de amizade
   */
  static async rejectFriendshipRequest(friendshipId: string, userId: string) {
    try {
      const friendship = await Friendship.findOneAndDelete({
        _id: friendshipId as any,
        $or: [{ userId1: userId }, { userId2: userId }],
        isActive: false
      });

      if (!friendship) {
        throw new Error('Friendship request not found or unauthorized');
      }

      console.log(`🤝 [FRIENDSHIP] Friendship request rejected: ${friendshipId}`);
      return true;
    } catch (error) {
      console.error('❌ [FRIENDSHIP] Error rejecting friendship request:', error);
      throw error;
    }
  }

  /**
   * Remover amizade
   */
  static async removeFriendship(data: {
    userId1: string;
    userId2: string;
  }) {
    try {
      const { userId1, userId2 } = data;

      const friendship = await Friendship.findOneAndUpdate(
        {
          $or: [
            { userId1, userId2 },
            { userId1: userId2, userId2: userId1 }
          ],
          isActive: true
        },
        {
          $set: {
            isActive: false,
            endedAt: new Date()
          }
        },
        { new: true }
      );

      if (!friendship) {
        throw new Error('Friendship not found');
      }

      // Remover das listas de amigos
      await User.findOneAndUpdate(
        { id: userId1 },
        { $pull: { friendsList: userId2 } }
      );

      await User.findOneAndUpdate(
        { id: userId2 },
        { $pull: { friendsList: userId1 } }
      );

      console.log(`🤝 [FRIENDSHIP] Friendship removed: ${userId1} <-> ${userId2}`);
      return friendship;
    } catch (error) {
      console.error('❌ [FRIENDSHIP] Error removing friendship:', error);
      throw error;
    }
  }

  /**
   * Buscar amigos de um usuário
   */
  static async getFriends(userId: string, limit: number = 50, offset: number = 0) {
    try {
      const friendships = await Friendship.find({
        $or: [
          { userId1: userId, isActive: true },
          { userId2: userId, isActive: true }
        ]
      })
        .populate('userId1', 'id name avatarUrl')
        .populate('userId2', 'id name avatarUrl')
        .sort({ friendshipStartedAt: -1 })
        .limit(limit)
        .skip(offset)
        .lean();

      // Extrair apenas os amigos (não incluir o próprio usuário)
      const friends = friendships.map((friendship: any) => {
        if (friendship.userId1.id === userId) {
          return friendship.userId2;
        } else {
          return friendship.userId1;
        }
      });

      console.log(`🤝 [FRIENDSHIP] Retrieved ${friends.length} friends for user ${userId}`);
      return friends;
    } catch (error) {
      console.error('❌ [FRIENDSHIP] Error getting friends:', error);
      throw error;
    }
  }

  /**
   * Verificar se dois usuários são amigos
   */
  static async areFriends(userId1: string, userId2: string) {
    try {
      const friendship = await Friendship.findOne({
        $or: [
          { userId1, userId2 },
          { userId1: userId2, userId2: userId1 }
        ],
        isActive: true
      });

      console.log(`🤝 [FRIENDSHIP] Friendship check ${userId1} <-> ${userId2}: ${!!friendship}`);
      return !!friendship;
    } catch (error) {
      console.error('❌ [FRIENDSHIP] Error checking friendship:', error);
      throw error;
    }
  }

  /**
   * Buscar solicitações de amizade pendentes
   */
  static async getPendingFriendshipRequests(userId: string) {
    try {
      const requests = await Friendship.find({
        $or: [
          { userId1: userId, isActive: false },
          { userId2: userId, isActive: false }
        ]
      })
        .populate('userId1', 'id name avatarUrl')
        .populate('userId2', 'id name avatarUrl')
        .sort({ friendshipStartedAt: -1 })
        .lean();

      // Filtrar apenas solicitações onde o usuário não é o iniciador
      const pendingRequests = requests.filter((request: any) => {
        return request.userId2.id === userId && request.initiatedBy !== userId;
      });

      console.log(`🤝 [FRIENDSHIP] Retrieved ${pendingRequests.length} pending requests for user ${userId}`);
      return pendingRequests;
    } catch (error) {
      console.error('❌ [FRIENDSHIP] Error getting pending requests:', error);
      throw error;
    }
  }

  /**
   * Contar amigos
   */
  static async getFriendsCount(userId: string) {
    try {
      const count = await Friendship.countDocuments({
        $or: [
          { userId1: userId, isActive: true },
          { userId2: userId, isActive: true }
        ]
      });

      console.log(`🤝 [FRIENDSHIP] Friends count for ${userId}: ${count}`);
      return count;
    } catch (error) {
      console.error('❌ [FRIENDSHIP] Error getting friends count:', error);
      throw error;
    }
  }

  /**
   * Criar amizade automaticamente (follow recíproco)
   */
  static async createAutomaticFriendship(data: {
    userId1: string;
    userId2: string;
    initiatedBy: string;
  }) {
    try {
      const { userId1, userId2, initiatedBy } = data;

      // Verificar se amizade já existe
      const existingFriendship = await Friendship.findOne({
        $or: [
          { userId1, userId2 },
          { userId1: userId2, userId2: userId1 }
        ],
        isActive: true
      });

      if (!existingFriendship) {
        const friendship = await Friendship.create({
          _id: `friend_${userId1}_${userId2}_${Date.now()}`,
          userId1,
          userId2,
          initiatedBy,
          friendshipStartedAt: new Date(),
          isActive: true
        });

        // Adicionar às listas de amigos
        await User.findOneAndUpdate(
          { id: userId1 },
          { $push: { friendsList: userId2 } }
        );

        await User.findOneAndUpdate(
          { id: userId2 },
          { $push: { friendsList: userId1 } }
        );

        console.log(`🤝 [FRIENDSHIP] Automatic friendship created: ${userId1} <-> ${userId2}`);
        return friendship;
      }

      return existingFriendship;
    } catch (error) {
      console.error('❌ [FRIENDSHIP] Error creating automatic friendship:', error);
      throw error;
    }
  }
}

