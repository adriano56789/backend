import { Followers } from '../models/Followers';
import { User } from '../models/User';
import { Friendship } from '../models/Friendship';

export class FollowersService {
  /**
   * Seguir um usuário
   */
  static async followUser(data: {
    followerId: string;
    followingId: string;
    streamId?: string;
  }) {
    try {
      const { followerId, followingId, streamId } = data;

      // Verificar se já existe follow
      const existingFollow = await Followers.findOne({
        followerId,
        followingId,
        isActive: true
      });

      if (existingFollow) {
        throw new Error('Already following this user');
      }

      // Verificar se existe follow inativo para reativar
      const inactiveFollow = await Followers.findOne({
        followerId,
        followingId,
        isActive: false
      });

      let follow;
      let isFriendship = false;

      if (inactiveFollow) {
        // Reativar follow existente
        follow = await Followers.findOneAndUpdate(
          { _id: inactiveFollow._id },
          {
            $set: {
              isActive: true,
              followedAt: new Date()
            }
          },
          { new: true }
        );
      } else {
        // Criar novo follow
        follow = await Followers.create({
          id: `follow_${followerId}_${followingId}_${Date.now()}`,
          followerId,
          followingId,
          followedAt: new Date(),
          isActive: true
        });
      }

      // Atualizar contador do usuário seguido
      await User.findOneAndUpdate(
        { id: followingId },
        {
          $set: { isFollowed: true },
          $inc: { fans: 1 },
          $push: { followersList: followerId }
        }
      );

      // Verificar se é follow recíproco (se o outro usuário já segue)
      const reciprocalFollow = await Followers.findOne({
        followerId: followingId,
        followingId: followerId,
        isActive: true
      });

      // Se for follow recíproco, criar amizade
      if (reciprocalFollow) {
        const existingFriendship = await Friendship.findOne({
          $or: [
            { userId1: followerId, userId2: followingId },
            { userId1: followingId, userId2: followerId }
          ],
          isActive: true
        });

        if (!existingFriendship) {
          await Friendship.create({
            _id: `friend_${followerId}_${followingId}_${Date.now()}`,
            userId1: followerId,
            userId2: followingId,
            initiatedBy: followerId,
            friendshipStartedAt: new Date(),
            isActive: true
          });

          // Atualizar listas de amigos
          await User.findOneAndUpdate(
            { id: followerId },
            { $push: { friendsList: followingId } }
          );

          await User.findOneAndUpdate(
            { id: followingId },
            { $push: { friendsList: followerId } }
          );

          isFriendship = true;
        }
      }

      console.log(`👤 [FOLLOWERS] User ${followerId} followed ${followingId}`);
      
      return {
        follow,
        isFriendship,
        streamId
      };
    } catch (error) {
      console.error('❌ [FOLLOWERS] Error following user:', error);
      throw error;
    }
  }

  /**
   * Deixar de seguir um usuário
   */
  static async unfollowUser(data: {
    followerId: string;
    followingId: string;
  }) {
    try {
      const { followerId, followingId } = data;

      // Desativar follow
      const follow = await Followers.findOneAndUpdate(
        { followerId, followingId, isActive: true },
        {
          $set: {
            isActive: false,
            unfollowedAt: new Date()
          }
        },
        { new: true }
      );

      if (!follow) {
        throw new Error('Follow relationship not found');
      }

      // Atualizar contador do usuário seguido
      await User.findOneAndUpdate(
        { id: followingId },
        {
          $inc: { fans: -1 },
          $pull: { followersList: followerId }
        }
      );

      // Verificar se existia amizade e desativar
      const friendship = await Friendship.findOne({
        $or: [
          { userId1: followerId, userId2: followingId },
          { userId1: followingId, userId2: followerId }
        ],
        isActive: true
      });

      if (friendship) {
        await Friendship.findOneAndUpdate({ _id: friendship._id }, {
          $set: {
            isActive: false,
            endedAt: new Date()
          }
        });

        // Remover das listas de amigos
        await User.findOneAndUpdate(
          { id: followerId },
          { $pull: { friendsList: followingId } }
        );

        await User.findOneAndUpdate(
          { id: followingId },
          { $pull: { friendsList: followerId } }
        );
      }

      console.log(`👤 [FOLLOWERS] User ${followerId} unfollowed ${followingId}`);
      
      return follow;
    } catch (error) {
      console.error('❌ [FOLLOWERS] Error unfollowing user:', error);
      throw error;
    }
  }

  /**
   * Buscar seguidores de um usuário
   */
  static async getFollowers(userId: string, limit: number = 50, offset: number = 0) {
    try {
      const followers = await Followers.find({
        followingId: userId,
        isActive: true
      })
        .populate('followerId', 'id name avatarUrl')
        .sort({ followedAt: -1 })
        .limit(limit)
        .skip(offset)
        .lean();

      console.log(`👤 [FOLLOWERS] Retrieved ${followers.length} followers for user ${userId}`);
      return followers;
    } catch (error) {
      console.error('❌ [FOLLOWERS] Error getting followers:', error);
      throw error;
    }
  }

  /**
   * Buscar usuários que um usuário segue
   */
  static async getFollowing(userId: string, limit: number = 50, offset: number = 0) {
    try {
      const following = await Followers.find({
        followerId: userId,
        isActive: true
      })
        .populate('followingId', 'id name avatarUrl')
        .sort({ followedAt: -1 })
        .limit(limit)
        .skip(offset)
        .lean();

      console.log(`👤 [FOLLOWERS] Retrieved ${following.length} following for user ${userId}`);
      return following;
    } catch (error) {
      console.error('❌ [FOLLOWERS] Error getting following:', error);
      throw error;
    }
  }

  /**
   * Verificar se um usuário segue outro
   */
  static async isFollowing(followerId: string, followingId: string) {
    try {
      const follow = await Followers.findOne({
        followerId,
        followingId,
        isActive: true
      });

      console.log(`👤 [FOLLOWERS] Follow check ${followerId} -> ${followingId}: ${!!follow}`);
      return !!follow;
    } catch (error) {
      console.error('❌ [FOLLOWERS] Error checking follow status:', error);
      throw error;
    }
  }

  /**
   * Contar seguidores
   */
  static async getFollowersCount(userId: string) {
    try {
      const count = await Followers.countDocuments({
        followingId: userId,
        isActive: true
      });

      console.log(`👤 [FOLLOWERS] Followers count for ${userId}: ${count}`);
      return count;
    } catch (error) {
      console.error('❌ [FOLLOWERS] Error getting followers count:', error);
      throw error;
    }
  }

  /**
   * Contar usuários seguidos
   */
  static async getFollowingCount(userId: string) {
    try {
      const count = await Followers.countDocuments({
        followerId: userId,
        isActive: true
      });

      console.log(`👤 [FOLLOWERS] Following count for ${userId}: ${count}`);
      return count;
    } catch (error) {
      console.error('❌ [FOLLOWERS] Error getting following count:', error);
      throw error;
    }
  }

  /**
   * Remover follows ao bloquear usuário
   */
  static async removeFollowsOnBlock(blockerId: string, blockedId: string) {
    try {
      // Remover follow do blocker -> blocked
      await Followers.findOneAndUpdate(
        { followerId: blockerId, followingId: blockedId, isActive: true },
        { $set: { isActive: false, unfollowedAt: new Date() } }
      );

      // Remover follow do blocked -> blocker
      await Followers.findOneAndUpdate(
        { followerId: blockedId, followingId: blockerId, isActive: true },
        { $set: { isActive: false, unfollowedAt: new Date() } }
      );

      // Atualizar contadores
      await User.findOneAndUpdate(
        { id: blockedId },
        { $inc: { fans: -1 }, $pull: { followersList: blockerId } }
      );

      console.log(`👤 [FOLLOWERS] Follows removed on block: ${blockerId} <-> ${blockedId}`);
    } catch (error) {
      console.error('❌ [FOLLOWERS] Error removing follows on block:', error);
      throw error;
    }
  }
}
