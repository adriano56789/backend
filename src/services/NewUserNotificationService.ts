import { getIO } from '../socket';
import { LiveMessage } from '../models/LiveMessage';
import { LiveCard } from '../models/LiveCard';
import { User } from '../models/User';

const WELCOME_MESSAGES = [
  (name: string) => `🎉 ${name} acabou de entrar no LiveGo. Dê as boas-vindas!`,
  (name: string) => `✨ ${name} é uma nova usuária da plataforma.`,
  (name: string) => `👋 ${name} acabou de criar sua conta! Seja bem-vindo(a)!`,
  (name: string) => `🌟 ${name} chegou agora no LiveGo!`,
];

const GLOBAL_STREAM_ID = '__global__';

export class NewUserNotificationService {

  static async notifyNewUser(userId: string): Promise<void> {
    try {
      const user = await User.findOne({ id: userId }).lean();
      if (!user) return;

      if (!(user as any).isNewUser || (user as any).newUserNotified) return;

      const userName = (user as any).name || userId;
      const msgIndex = Math.floor(Math.random() * WELCOME_MESSAGES.length);
      const welcomeText = WELCOME_MESSAGES[msgIndex](userName);

      const io = getIO();

      // Marcar como notificado
      await User.findOneAndUpdate(
        { id: userId },
        { $set: { isNewUser: false, newUserNotified: true } }
      );

      const now = new Date();

      // 1. SEMPRE salvar mensagem global (mesmo sem streams ativas)
      await LiveMessage.create({
        streamId: GLOBAL_STREAM_ID,
        userId: 'system',
        userName: 'Sistema',
        avatarUrl: '',
        level: 0,
        text: welcomeText,
        type: 'system',
        timestamp: now
      }).catch(err => console.warn('[NEW-USER] Erro ao salvar mensagem global:', err.message));

      // 2. Broadcast global
      io.emit('new_user_arrived', {
        userId,
        userName,
        message: welcomeText,
        timestamp: now.toISOString()
      });

      // 3. Inserir em TODAS as streams ativas
      const activeStreams = await LiveCard.find({
        isLive: true,
        streamStatus: { $in: ['active', 'live'] }
      }).lean();

      for (const stream of activeStreams) {
        const streamId = stream.streamKey || stream.hostId;
        const msg = {
          streamId,
          userId: 'system',
          userName: 'Sistema',
          avatarUrl: '',
          level: 0,
          text: welcomeText,
          type: 'system' as const,
          timestamp: now
        };

        await LiveMessage.create(msg).catch(() => {});

        io.to(streamId).emit('live_message', {
          ...msg,
          timestamp: now.toISOString()
        });
      }

      console.log(`[NEW-USER] Notificação enviada: ${userName} (${userId})`);
    } catch (error) {
      console.error('[NEW-USER] Erro ao notificar novo usuário:', error);
    }
  }

  static async getRecentNewUsers(limit = 20) {
    const messages = await LiveMessage.find({
      streamId: GLOBAL_STREAM_ID,
      type: 'system'
    })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return messages;
  }
}