import axios from 'axios';
import { Server as SocketIOServer } from 'socket.io';
import { Streamer, User, LiveCard, LiveMessage } from '../models/index';
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
    // 🛑 DESATIVADO (decisão do dono): nenhuma lógica pode encerrar uma
    // transmissão ao vivo automaticamente. A live SÓ é encerrada pelo host.
    // StreamCleanupService NÃO roda mais — nada de timeout/fechamento automático.
    if (io) this.io = io;
    console.warn('[STREAM-CLEANUP] 🛑 Serviço de limpeza DESATIVADO — lives só encerram pelo próprio host. Nada será fechado automaticamente.');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // Contagem de ciclos consecutivos em que a stream NÃO foi vista no SRS.
  // Evita matar a live por um blip transitório (reconexão, oscilação de rede).
  private absenceCount = new Map<string, number>();
  private readonly REQUIRED_ABSENCES = 2;

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

      // Se a API do SRS falhou, NÃO matar nada neste ciclo. Um erro de rede
      // não pode derrubar cards de lives que estão realmente transmitindo.
      if (srsStreams === null) {
        console.warn('[STREAM-CLEANUP] ⚠️ API do SRS indisponível — nenhuma stream será encerrada neste ciclo');
        return;
      }

      const srsStreamKeys = new Set(srsStreams.map(s => s.name));

      for (const stream of activeStreams) {
        const streamKey = stream.streamKey as string;

        // Sem streamKey não há como validar presença no SRS — não matar.
        if (!streamKey) continue;

        const isOnSrs = srsStreamKeys.has(streamKey);

        if (isOnSrs) {
          this.absenceCount.delete(streamKey);
          continue;
        }

        const misses = (this.absenceCount.get(streamKey) || 0) + 1;
        this.absenceCount.set(streamKey, misses);

        const streamAge = Date.now() - new Date(stream.startTime || stream.createdAt || Date.now()).getTime();
        const staleMs = MAX_STALE_MINUTES * 60 * 1000;

        if (misses >= this.REQUIRED_ABSENCES && streamAge > staleMs) {
          console.log(`[STREAM-CLEANUP] Stream órfã detectada: ${streamKey || stream.id} (host: ${stream.hostId}, idade: ${Math.round(streamAge / 1000)}s, ausente ${misses} ciclos)`);
          await this.forceEndStream(stream);
          this.absenceCount.delete(streamKey);
        }
      }
    } catch (err: any) {
      console.error('[STREAM-CLEANUP] Erro:', err.message);
    } finally {
      this.isRunning = false;
    }
  }

  private async fetchSrsStreams(): Promise<SrsStream[] | null> {
    try {
      const res = await axios.get(`${SRS_API_URL}/api/v1/streams/`, { timeout: 5000 });
      if (res.data?.streams) {
        return res.data.streams;
      }
      return [];
    } catch {
      return null;
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

      // 🧹 Chat morre com a transmissão
      try {
        const result = await LiveMessage.deleteMany({ streamId: String(storedId) });
        console.log(`[STREAM-CLEANUP] 🧹 Chat apagado da stream ${storedId}: ${result?.deletedCount ?? 0} mensagens`);
      } catch (chatErr: any) {
        console.warn('[STREAM-CLEANUP] ⚠️ Erro ao apagar chat:', chatErr?.message || chatErr);
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
