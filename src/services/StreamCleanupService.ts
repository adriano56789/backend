import axios from 'axios';
import { Server as SocketIOServer } from 'socket.io';
import { Streamer, User, LiveCard } from '../models/index';
import { stopStreamTranscode } from './FfmpegService';

const SRS_API_URL = process.env.SRS_API_URL || 'http://127.0.0.1:1985';
const CLEANUP_INTERVAL_MS = parseInt(process.env.STREAM_CLEANUP_INTERVAL || '60000', 10);
const MAX_STALE_MINUTES = parseInt(process.env.STREAM_STALE_MINUTES || '2', 10);

interface SrsStream {
  id: string;
  name: string;
  vhost: string;
  app: string;
  tcUrl: string;
  url: string;
  live_ms: number;
  clients: number;
  frames: number;
  send_bytes: number;
  recv_bytes: number;
  kbps: {
    recv_30s: number;
    send_30s: number;
  };
  publish: {
    id: string;
    ip: string;
  };
  video: any;
  audio: any;
}

export class StreamCleanupService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private io: SocketIOServer | null = null;

  start(io?: SocketIOServer): void {
    if (this.intervalId) return;
    if (io) this.io = io;
    console.log(`[STREAM-CLEANUP] Iniciando serviço de limpeza a cada ${CLEANUP_INTERVAL_MS}ms`);
    this.intervalId = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
    this.cleanup();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async cleanup(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const activeStreams = await Streamer.find({
        isLive: true,
        streamStatus: { $in: ['active'] }
      }).lean();

      if (activeStreams.length === 0) return;

      const srsStreams = await this.fetchSrsStreams();
      const srsStreamKeys = new Set(srsStreams.map(s => s.name));

      for (const stream of activeStreams) {
        const streamKey = stream.streamKey as string;
        const isOnSrs = streamKey ? srsStreamKeys.has(streamKey) : false;

        if (!isOnSrs) {
          const streamAge = Date.now() - new Date(stream.startTime || stream.createdAt || Date.now()).getTime();
          const staleMs = MAX_STALE_MINUTES * 60 * 1000;

          if (streamAge > staleMs) {
            console.log(`[STREAM-CLEANUP] Stream órfã detectada: ${streamKey || stream.id} (host: ${stream.hostId}, idade: ${Math.round(streamAge / 1000)}s)`);
            await this.forceEndStream(stream);
          }
        }
      }
    } catch (err: any) {
      console.error('[STREAM-CLEANUP] Erro:', err.message);
    } finally {
      this.isRunning = false;
    }
  }

  private async fetchSrsStreams(): Promise<SrsStream[]> {
    try {
      const res = await axios.get(`${SRS_API_URL}/api/v1/streams`, { timeout: 5000 });
      if (res.data?.streams) {
        return res.data.streams;
      }
      return [];
    } catch {
      return [];
    }
  }

  private async forceEndStream(stream: any): Promise<void> {
    const storedId = stream.id || stream.streamKey;
    const hostId = stream.hostId;

    try {
      await Streamer.findOneAndUpdate(
        { id: storedId },
        { $set: { isLive: false, streamStatus: 'ended', endTime: new Date() } }
      );

      if (hostId) {
        await User.findOneAndUpdate(
          { id: hostId },
          { $set: { isLive: false, currentStreamId: null } }
        );
      }

      try {
        await LiveCard.findOneAndUpdate(
          { hostId },
          { $set: { isLive: false, streamStatus: 'ended', endTime: new Date() } }
        );
      } catch {}

      if (stream.streamKey) {
        await stopStreamTranscode(stream.streamKey).catch(() => {});
      }

      if (this.io) {
        this.io.emit('card_removed', { streamId: storedId, hostId, timestamp: new Date().toISOString() });
        this.io.emit('stream_ended', { streamId: storedId, hostId, timestamp: new Date().toISOString() });
        this.io.emit('stream_stopped', { streamId: storedId, hostId, timestamp: new Date().toISOString() });
      }

      console.log(`[STREAM-CLEANUP] Stream ${storedId} finalizada forçadamente`);
    } catch (err: any) {
      console.error(`[STREAM-CLEANUP] Erro ao finalizar stream ${storedId}:`, err.message);
    }
  }
}

export const streamCleanupService = new StreamCleanupService();
