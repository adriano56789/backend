import { getIO } from '../socket';
import { LiveMessage } from '../models/LiveMessage';
import { User, UserStatus } from '../models';
import { LiveCard } from '../models/LiveCard';

export class PresenceService {

  static async userEnteredApp(userId: string, userName: string) {
    const io = getIO();
    const now = new Date();

    await User.findOneAndUpdate(
      { id: userId },
      { $set: { isOnline: true, lastSeen: now } },
      { upsert: true }
    ).catch(err => console.error('[PRESENCE] Error updating User on enter:', err.message));

    await UserStatus.findOneAndUpdate(
      { userId },
      { $set: { isOnline: true, lastSeen: now } },
      { upsert: true }
    ).catch(err => console.error('[PRESENCE] Error updating UserStatus on enter:', err.message));

    io.emit('user_app_open', {
      userId,
      userName,
      timestamp: now.toISOString()
    });

    io.emit('user_status_changed', {
      userId,
      isOnline: true,
      timestamp: now.toISOString()
    });

    const activeStreams = await LiveCard.find({
      isLive: true,
      streamStatus: { $in: ['active', 'live'] }
    }).lean();

    for (const stream of activeStreams) {
      const systemMessage = {
        streamId: stream.streamKey || stream.hostId,
        userId: 'system',
        userName: 'Sistema',
        avatarUrl: '',
        level: 0,
        text: `${userName} entrou no aplicativo.`,
        type: 'system' as const,
        timestamp: now
      };

      await LiveMessage.create(systemMessage).catch(() => {});

      
    }
  }

  static async userLeftApp(userId: string, userName: string) {
    const io = getIO();
    const now = new Date();

    await User.findOneAndUpdate(
      { id: userId },
      { $set: { isOnline: false, lastSeen: now } }
    ).catch(err => console.error('[PRESENCE] Error updating User on leave:', err.message));

    await UserStatus.findOneAndUpdate(
      { userId },
      { $set: { isOnline: false, lastSeen: now } }
    ).catch(err => console.error('[PRESENCE] Error updating UserStatus on leave:', err.message));

    io.emit('user_left_app', {
      userId,
      timestamp: now.toISOString()
    });

    io.emit('user_status_changed', {
      userId,
      isOnline: false,
      timestamp: now.toISOString()
    });

    const activeStreams = await LiveCard.find({
      isLive: true,
      streamStatus: { $in: ['active', 'live'] }
    }).lean();

    for (const stream of activeStreams) {
      const systemMessage = {
        streamId: stream.streamKey || stream.hostId,
        userId: 'system',
        userName: 'Sistema',
        avatarUrl: '',
        level: 0,
        text: `${userName} saiu do aplicativo.`,
        type: 'system' as const,
        timestamp: now
      };

      await LiveMessage.create(systemMessage).catch(() => {});

      
    }
  }
}