import { Streamer, User, LiveCard } from '../models';
import { normalizeStreamId } from '../utils/streamKeyUtils';

export async function autoEndStreamOnDisconnect(streamKey: string, io?: any): Promise<void> {
  try {
    const normalizedId = normalizeStreamId(streamKey);

    const stream: any = await Streamer.findOne({
      $or: [
        { id: normalizedId },
        { streamKey }
      ]
    }).lean();

    if (!stream) {
      console.log(`[AUTO-END] Stream ${streamKey} não encontrada — nada a encerrar`);
      return;
    }
    if (!stream.isLive) {
      console.log(`[AUTO-END] Stream ${streamKey} já está encerrada — ignorando`);
      return;
    }

    const streamId = stream.id || normalizedId;
    const hostId = stream.hostId;

    await Streamer.updateOne(
      { id: streamId },
      { $set: {
          isLive: false,
          streamStatus: 'ended',
          endTime: new Date(),
          endedBy: 'disconnect'
      } }
    );

    if (hostId) {
      await LiveCard.updateOne(
        { hostId },
        { $set: {
            isLive: false,
            streamStatus: 'ended',
            endTime: new Date(),
            updatedAt: new Date()
        } }
      );
      await User.updateOne(
        { id: hostId },
        { $set: { isLive: false, currentStreamId: null } }
      );
    }

    if (io) {
      const payload = {
        streamId: streamId,
        hostId: hostId || '',
        timestamp: new Date().toISOString()
      };
      io.emit('card_removed', payload);
      io.emit('stream_ended', payload);
      io.emit('stream_stopped', payload);
    }

    console.log(`[AUTO-END] Live ${streamKey} encerrada automaticamente (host desconectou)`);
  } catch (err: any) {
    console.error('[AUTO-END] Erro ao encerrar stream automaticamente:', err.message);
  }
}
