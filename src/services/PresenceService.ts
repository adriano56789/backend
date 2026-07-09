import { getIO } from '../socket';
import { LiveMessage } from '../models/LiveMessage';
import { User } from '../models/User';
import { LiveCard } from '../models/LiveCard';

export class PresenceService {

  static async userEnteredApp(userId: string, userName: string) {
    const io = getIO();

    await User.findOneAndUpdate(
      { id: userId },
      { $set: { isOnline: true, lastSeen: new Date() } }
    );

    io.emit('user_app_open', {
      userId,
      userName,
      timestamp: new Date().toISOString()
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
        timestamp: new Date()
      };

      await LiveMessage.create(systemMessage).catch(() => {});

      io.to(stream.streamKey || stream.hostId).emit('live_message', {
        ...systemMessage,
        timestamp: systemMessage.timestamp.toISOString()
      });
    }
  }

  static async userLeftApp(userId: string, userName: string) {
    const io = getIO();

    await User.findOneAndUpdate(
      { id: userId },
      { $set: { isOnline: false, lastSeen: new Date() } }
    );

    io.emit('user_left_app', {
      userId,
      timestamp: new Date().toISOString()
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
        timestamp: new Date()
      };

      await LiveMessage.create(systemMessage).catch(() => {});

      io.to(stream.streamKey || stream.hostId).emit('live_message', {
        ...systemMessage,
        timestamp: systemMessage.timestamp.toISOString()
      });
    }
  }
}