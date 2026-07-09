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

export class NewUserNotificationService {

  static async notifyNewUser(userId: string): Promise<void> {
    try {
      const user = await User.findOne({ id: userId }).lean();
      if (!user) return;

      // Só notifica na primeira vez
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

      // Buscar streams ativas
      const activeStreams = await LiveCard.find({
        isLive: true,
        streamStatus: { $in: ['active', 'live'] }
      }).lean();

      const systemMessage = {
        userId: 'system',
        userName: 'Sistema',
        avatarUrl: '',
        level: 0,
        type: 'system' as const,
        timestamp: new Date()
      };

      // Inserir no histórico e broadcast em tempo real para cada stream ativa
      for (const stream of activeStreams) {
        const streamId = stream.streamKey || stream.hostId;
        const msg = {
          ...systemMessage,
          streamId,
          text: welcomeText
        };

        await LiveMessage.create(msg).catch(() => {});

        io.to(streamId).emit('live_message', {
          ...msg,
          timestamp: msg.timestamp.toISOString()
        });
      }

      // Também emitir evento global para que o frontend possa exibir onde não há stream ativa
      io.emit('new_user_arrived', {
        userId,
        userName,
        message: welcomeText,
        timestamp: new Date().toISOString()
      });

      console.log(`[NEW-USER] Notificação de novo usuário enviada: ${userName} (${userId})`);
    } catch (error) {
      console.error('[NEW-USER] Erro ao notificar novo usuário:', error);
    }
  }
}