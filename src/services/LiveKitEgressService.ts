import { EgressClient } from 'livekit-server-sdk';
import { StreamOutput, StreamProtocol, EncodingOptionsPreset } from '@livekit/protocol';
import { ENV } from '../config/env';

class LiveKitEgressService {
  private egressClient: EgressClient;

  constructor() {
    this.egressClient = new EgressClient(
      ENV.LIVEKIT_SERVER_URL,
      ENV.LIVEKIT_API_KEY,
      ENV.LIVEKIT_API_SECRET
    );
  }

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

      const streamOutput = new StreamOutput({
        protocol: StreamProtocol.RTMP,
        urls: [rtmpUrl],
      });

      const egressInfo = await this.egressClient.startRoomCompositeEgress(
        roomId,
        streamOutput,
        {
          layout: 'speaker',
          encodingOptions: EncodingOptionsPreset.H264_720P_30,
        }
      );

      console.log(`[EGRESS] RTMP Egress iniciado:`, {
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
   * Obtém o status atual de um Egress específico
   *
   * @param egressId - ID do Egress a consultar
   * @returns Status detalhado do Egress
   */
  async getEgressStatus(egressId: string): Promise<{
    success: boolean;
    egressId?: string;
    roomId?: string;
    status?: string;
    error?: string;
    startedAt?: number;
    endedAt?: number;
    details?: any;
  }> {
    try {
      console.log(`[EGRESS] Consultando status do Egress: ${egressId}`);
      const allEgresses = await this.egressClient.listEgress();
      const egressInfo: any = allEgresses.find((e: any) => e.egressId === egressId);

      if (!egressInfo) {
        return {
          success: false,
          error: `Egress ${egressId} não encontrado`,
          egressId,
        };
      }

      const statusStr = String(egressInfo.status || 'unknown');

      console.log(`[EGRESS] Status do Egress ${egressId}:`, {
        status: statusStr,
        roomName: egressInfo.roomName,
        startedAt: egressInfo.startedAt,
        endedAt: egressInfo.endedAt,
        error: egressInfo.error,
      });

      return {
        success: true,
        egressId: egressInfo.egressId,
        roomId: egressInfo.roomName,
        status: statusStr,
        startedAt: egressInfo.startedAt ? Number(egressInfo.startedAt) : undefined,
        endedAt: egressInfo.endedAt ? Number(egressInfo.endedAt) : undefined,
        details: {
          error: egressInfo.error,
        },
      };
    } catch (error: any) {
      console.error('[EGRESS] Erro ao consultar status do Egress:', error.message);
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
