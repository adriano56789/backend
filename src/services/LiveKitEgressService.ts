import { EgressClient } from 'livekit-server-sdk';
import { ENV } from '../config/env';

/**
 * LiveKit Egress Service
 * 
 * Responsável por iniciar e parar Egress RTMP para enviar streams do LiveKit para o SRS.
 * 
 * Arquitetura:
 * - LiveKit captura câmera/microfone do host
 * - Egress pega as tracks do LiveKit e envia via RTMP para o SRS
 * - SRS distribui via HLS para espectadores
 */

class LiveKitEgressService {
  private egressClient: EgressClient;

  constructor() {
    // EgressClient singleton
    this.egressClient = new EgressClient(
      ENV.LIVEKIT_SERVER_URL,
      ENV.LIVEKIT_API_KEY,
      ENV.LIVEKIT_API_SECRET
    );
  }

  /**
   * Inicia um Egress RTMP para enviar o stream de uma sala LiveKit para o SRS
   * 
   * @param roomId - Nome da sala LiveKit (ex: live_streamId)
   * @param streamId - ID do stream no SRS (ex: streamId)
   * @param rtmpUrl - URL RTMP do SRS (ex: rtmp://localhost:1935/live/streamId)
   * @returns Egress ID e informações
   */
  async startRTMPEgress(
    roomId: string,
    streamId: string,
    rtmpUrl: string
  ): Promise<{
    success: boolean;
    egressId?: string;
    roomId?: string;
    streamId?: string;
    rtmpUrl?: string;
    status?: string;
    error?: string;
  }> {
    try {
      console.log(`[EGRESS] Iniciando RTMP Egress para sala ${roomId} -> SRS ${streamId}`);

      // Usar roomCompositeEgress para capturar todas as tracks da sala
      // Isso inclui câmera e microfone do host
      const output: any = {
        rtmp: true,
        url: rtmpUrl,
      };

      const egressInfo = await this.egressClient.startRoomCompositeEgress(
        roomId,
        output
      );

      console.log(`[EGRESS] RTMP Egress iniciado com sucesso:`, {
        egressId: egressInfo.egressId,
        roomId,
        streamId,
        rtmpUrl,
      });

      return {
        success: true,
        egressId: egressInfo.egressId,
        roomId,
        streamId,
        rtmpUrl,
        status: 'starting',
      };
    } catch (error: any) {
      console.error('[EGRESS] Erro ao iniciar RTMP Egress:', error.message);
      return {
        success: false,
        error: error.message,
        roomId,
        streamId,
      };
    }
  }

  /**
   * Para um Egress em andamento
   * 
   * @param egressId - ID do Egress a parar
   * @returns Status da operação
   */
  async stopEgress(egressId: string): Promise<{
    success: boolean;
    egressId?: string;
    status?: string;
    error?: string;
  }> {
    try {
      console.log(`[EGRESS] Parando Egress: ${egressId}`);
      await this.egressClient.stopEgress(egressId);
      console.log(`[EGRESS] Egress parado com sucesso: ${egressId}`);
      return {
        success: true,
        egressId,
        status: 'stopped',
      };
    } catch (error: any) {
      console.error('[EGRESS] Erro ao parar Egress:', error.message);
      return {
        success: false,
        error: error.message,
        egressId,
      };
    }
  }

  /**
   * Lista todos os Egress ativos
   * 
   * @returns Lista de Egress
   */
  async listEgress(): Promise<{
    success: boolean;
    egressList: Array<{
      egressId: string;
      roomId?: string;
      status?: string;
      startedAt?: number;
      endedAt?: number;
    }>;
    error?: string;
  }> {
    try {
      const egressList = await this.egressClient.listEgress();
      return {
        success: true,
        egressList: egressList.map((e: any) => ({
          egressId: e.egressId,
          roomId: e.roomName,
          status: e.status,
          startedAt: e.startedAt ? Number(e.startedAt) : undefined,
          endedAt: e.endedAt ? Number(e.endedAt) : undefined,
        })),
      };
    } catch (error: any) {
      console.error('[EGRESS] Erro ao listar Egress:', error.message);
      return {
        success: false,
        error: error.message,
        egressList: [],
      };
    }
  }
}

export const egressService = new LiveKitEgressService();
