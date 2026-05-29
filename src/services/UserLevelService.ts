import { UserLevel } from '../models/UserLevel';
import { User } from '../models/User';

export class UserLevelService {
  /**
   * Obter informações de nível de um usuário
   */
  static async getUserLevel(userId: string) {
    try {
      let userLevel = await UserLevel.findOne({ userId });
      
      // Se não existir, criar com valores iniciais
      if (!userLevel) {
        userLevel = await UserLevel.create({
          userId,
          currentLevel: 1,
          currentExp: 0,
          totalExp: 0,
          levelHistory: [{
            level: 1,
            reachedAt: new Date(),
            expRequired: 100
          }]
        });
      }
      
      const levelInfo = (userLevel as any).getLevelInfo();
      
      console.log(`⭐ [LEVEL] User level retrieved for ${userId}: Level ${levelInfo.currentLevel}`);
      return {
        userId,
        ...levelInfo
      };
    } catch (error) {
      console.error('❌ [LEVEL] Error getting user level:', error);
      throw error;
    }
  }

  /**
   * Adicionar EXP a um usuário
   */
  static async addExp(data: {
    userId: string;
    amount: number;
    reason?: string;
    streamId?: string;
  }) {
    try {
      const { userId, amount, reason, streamId } = data;
      
      if (amount <= 0) {
        throw new Error('EXP amount must be positive');
      }

      let userLevel = await UserLevel.findOne({ userId });
      
      if (!userLevel) {
        userLevel = await UserLevel.create({
          userId,
          currentLevel: 1,
          currentExp: 0,
          totalExp: 0,
          levelHistory: [{
            level: 1,
            reachedAt: new Date(),
            expRequired: 100
          }]
        });
      }
      
      const result = await (userLevel as any).addExp(amount, reason || 'EXP gained');
      
      // Atualizar nível no usuário principal também
      await User.findOneAndUpdate(
        { id: userId },
        { 
          level: result.newLevel,
          totalExp: result.totalExp
        }
      );

      // Se houver streamId, registrar atividade na stream
      if (streamId) {
        await this.recordStreamActivity(userId, streamId, 'exp_gained', {
          amount,
          reason,
          newLevel: result.newLevel,
          leveledUp: result.leveledUp
        });
      }
      
      console.log(`⭐ [LEVEL] EXP added for ${userId}: +${amount} (Level ${result.newLevel})`);
      
      return {
        userId,
        amount,
        reason,
        newLevel: result.newLevel,
        currentExp: result.currentExp,
        expRequired: result.expRequired,
        leveledUp: result.leveledUp,
        totalExp: result.totalExp
      };
    } catch (error) {
      console.error('❌ [LEVEL] Error adding EXP:', error);
      throw error;
    }
  }

  /**
   * Adicionar múltiplos ganhos de EXP
   */
  static async addMultipleExp(data: {
    userId: string;
    expGains: Array<{
      amount: number;
      reason?: string;
    }>;
  }) {
    try {
      const { userId, expGains } = data;
      
      let userLevel = await UserLevel.findOne({ userId });
      
      if (!userLevel) {
        userLevel = await UserLevel.create({
          userId,
          currentLevel: 1,
          currentExp: 0,
          totalExp: 0,
          levelHistory: [{
            level: 1,
            reachedAt: new Date(),
            expRequired: 100
          }]
        });
      }
      
      let totalGained = 0;
      let leveledUp = false;
      let finalLevel = userLevel.currentLevel;
      
      // Processar cada ganho de EXP
      for (const gain of expGains) {
        if (gain.amount > 0) {
          const result = await (userLevel as any).addExp(gain.amount, gain.reason || 'EXP gained');
          totalGained += gain.amount;
          
          if (result.leveledUp) {
            leveledUp = true;
            finalLevel = result.newLevel;
          }
        }
      }
      
      // Atualizar nível no usuário principal
      await User.findOneAndUpdate(
        { id: userId },
        { 
          level: finalLevel,
          totalExp: userLevel.totalExp
        }
      );
      
      console.log(`⭐ [LEVEL] Multiple EXP added for ${userId}: +${totalGained} (Level ${finalLevel})`);
      
      return {
        userId,
        totalGained,
        expGains,
        newLevel: finalLevel,
        currentExp: userLevel.currentExp,
        expRequired: userLevel.expRequired,
        leveledUp,
        totalExp: userLevel.totalExp
      };
    } catch (error) {
      console.error('❌ [LEVEL] Error adding multiple EXP:', error);
      throw error;
    }
  }

  /**
   * Obter leaderboard de níveis
   */
  static async getLeaderboard(options: {
    limit?: number;
    offset?: number;
    timeRange?: 'all' | 'week' | 'month';
  } = {}) {
    try {
      const { limit = 50, offset = 0, timeRange = 'all' } = options;
      
      let query: any = {};
      
      // Filtrar por período se especificado
      if (timeRange === 'week') {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        query = { 'levelHistory.reachedAt': { $gte: weekAgo } };
      } else if (timeRange === 'month') {
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        query = { 'levelHistory.reachedAt': { $gte: monthAgo } };
      }
      
      const leaderboard = await UserLevel.find(query)
        .sort({ totalExp: -1, currentLevel: -1 })
        .limit(parseInt(limit.toString()))
        .skip(parseInt(offset.toString()))
        .populate('userId', 'id name avatarUrl')
        .lean();
      
      // Adicionar rank e informações de nível
      const rankedLeaderboard = leaderboard.map((user: any, index: number) => ({
        rank: offset + index + 1,
        userId: user.userId.id,
        userName: user.userId.name,
        userAvatar: user.userId.avatarUrl,
        currentLevel: user.currentLevel,
        currentExp: user.currentExp,
        totalExp: user.totalExp,
        levelInfo: (user as any).getLevelInfo()
      }));
      
      console.log(`⭐ [LEVEL] Leaderboard retrieved: ${rankedLeaderboard.length} users`);
      return rankedLeaderboard;
    } catch (error) {
      console.error('❌ [LEVEL] Error getting leaderboard:', error);
      throw error;
    }
  }

  /**
   * Calcular EXP necessária para um nível
   */
  static async calculateExpForLevel(targetLevel: number) {
    try {
      const expRequired = (UserLevel as any).calculateExpForLevel(targetLevel);
      
      // Calcular EXP total necessária para chegar até este nível
      let totalExpNeeded = 0;
      for (let i = 1; i < targetLevel; i++) {
        totalExpNeeded += (UserLevel as any).calculateExpForLevel(i);
      }
      
      console.log(`⭐ [LEVEL] EXP calculated for level ${targetLevel}: ${expRequired} (total: ${totalExpNeeded})`);
      
      return {
        targetLevel,
        expRequired,
        totalExpNeeded
      };
    } catch (error) {
      console.error('❌ [LEVEL] Error calculating EXP for level:', error);
      throw error;
    }
  }

  /**
   * Obter distribuição de níveis
   */
  static async getLevelDistribution() {
    try {
      const distribution = await (UserLevel as any).getLevelDistribution();
      
      console.log(`⭐ [LEVEL] Level distribution retrieved: ${distribution.length} levels`);
      return distribution;
    } catch (error) {
      console.error('❌ [LEVEL] Error getting level distribution:', error);
      throw error;
    }
  }

  /**
   * Registrar atividade em stream
   */
  private static async recordStreamActivity(
    userId: string, 
    streamId: string, 
    activityType: string, 
    data: any
  ) {
    try {
      // Aqui você pode integrar com um modelo de StreamActivity se existir
      // Por enquanto, apenas logar a atividade
      console.log(`📊 [LEVEL] Stream activity recorded: ${userId} in ${streamId} - ${activityType}`, data);
    } catch (error) {
      console.error('❌ [LEVEL] Error recording stream activity:', error);
    }
  }

  /**
   * Obter progresso de nível
   */
  static async getLevelProgress(userId: string) {
    try {
      const userLevel = await UserLevel.findOne({ userId });
      
      if (!userLevel) {
        throw new Error('User level not found');
      }
      
      const levelInfo = (userLevel as any).getLevelInfo();
      
      console.log(`⭐ [LEVEL] Level progress retrieved for ${userId}: ${levelInfo.progress}%`);
      
      return {
        userId,
        currentLevel: levelInfo.currentLevel,
        currentExp: levelInfo.currentExp,
        expRequired: levelInfo.expRequired,
        expNeeded: levelInfo.expNeeded,
        progress: levelInfo.progress,
        totalExp: userLevel.totalExp
      };
    } catch (error) {
      console.error('❌ [LEVEL] Error getting level progress:', error);
      throw error;
    }
  }

  /**
   * Verificar se usuário pode subir de nível
   */
  static async canLevelUp(userId: string) {
    try {
      const userLevel = await UserLevel.findOne({ userId });
      
      if (!userLevel) {
        return false;
      }
      
      const canLevelUp = userLevel.currentExp >= userLevel.expRequired;
      
      console.log(`⭐ [LEVEL] Level up check for ${userId}: ${canLevelUp}`);
      return canLevelUp;
    } catch (error) {
      console.error('❌ [LEVEL] Error checking level up:', error);
      throw error;
    }
  }

  /**
   * Obter estatísticas de níveis do sistema
   */
  static async getSystemStats() {
    try {
      const totalUsers = await UserLevel.countDocuments();
      const averageLevelResult = await UserLevel.aggregate([
        { $group: { _id: null, avgLevel: { $avg: '$currentLevel' } } }
      ]).toArray();
      const averageLevel = averageLevelResult;
      
      const topLevel = await UserLevel.findOne({}).sort({ currentLevel: -1 });
      const totalExpDistributedResult = await UserLevel.aggregate([
        { $group: { _id: null, totalExp: { $sum: '$totalExp' } } }
      ]).toArray();
      const totalExpDistributed = totalExpDistributedResult;
      
      console.log(`⭐ [LEVEL] System stats retrieved`);
      
      return {
        totalUsers,
        averageLevel: averageLevel[0]?.avgLevel || 0,
        topLevel: topLevel?.currentLevel || 0,
        totalExpDistributed: totalExpDistributed[0]?.totalExp || 0
      };
    } catch (error) {
      console.error('❌ [LEVEL] Error getting system stats:', error);
      throw error;
    }
  }
}
