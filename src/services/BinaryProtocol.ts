// Protocolo binário inspirado no BuzzCast para eventos em tempo real
// Comprime eventos de live (chat, presentes, status) em pacotes binários otimizados

export enum EventType {
  CHAT_MESSAGE = 1,
  GIFT_SENT = 2,
  USER_JOINED = 3,
  USER_LEFT = 4,
  STREAM_STATUS = 5,
  VIEWERS_UPDATE = 6,
  HEARTBEAT = 7,
  PRESENCE_UPDATE = 8,
  LIKE_UPDATE = 9,
  LEVEL_UP = 10
}

export interface BinaryEvent {
  type: EventType;
  timestamp: number;
  streamId?: string;
  data: any;
}

export class BinaryProtocol {
  private static readonly MAGIC_NUMBER = 0x4C4756; // "LGV" - LiveGo
  private static readonly VERSION = 1;
  
  /**
   * Codifica um evento para formato binário compactado
   */
  static encode(event: BinaryEvent): ArrayBuffer {
    // Serializar dados como JSON
    const jsonData = JSON.stringify({
      type: event.type,
      timestamp: event.timestamp,
      streamId: event.streamId || '',
      data: event.data
    });
    
    // Comprimir com gzip (simulado - na prática usaría compression API)
    const compressed = this.gzipCompress(jsonData);
    
    // Criar header binário
    const buffer = new ArrayBuffer(12 + compressed.length);
    const view = new DataView(buffer);
    
    // Magic number (3 bytes)
    view.setUint8(0, (this.MAGIC_NUMBER >> 16) & 0xFF);
    view.setUint8(1, (this.MAGIC_NUMBER >> 8) & 0xFF);
    view.setUint8(2, this.MAGIC_NUMBER & 0xFF);
    
    // Version (1 byte)
    view.setUint8(3, this.VERSION);
    
    // Event type (1 byte)
    view.setUint8(4, event.type);
    
    // Timestamp (8 bytes - Unix timestamp)
    view.setBigUint64(5, BigInt(event.timestamp), false);
    
    // Data length (4 bytes)
    view.setUint32(13, compressed.length, false);
    
    // Compressed data
    const dataView = new Uint8Array(buffer, 17);
    dataView.set(compressed);
    
    return buffer;
  }
  
  /**
   * Decodifica um pacote binário para evento
   */
  static decode(buffer: ArrayBuffer): BinaryEvent | null {
    try {
      const view = new DataView(buffer);
      
      // Validar magic number
      const magic = (view.getUint8(0) << 16) | (view.getUint8(1) << 8) | view.getUint8(2);
      if (magic !== this.MAGIC_NUMBER) {
        console.error('❌ [BINARY] Invalid magic number');
        return null;
      }
      
      // Validar versão
      const version = view.getUint8(3);
      if (version !== this.VERSION) {
        console.error(`❌ [BINARY] Unsupported version: ${version}`);
        return null;
      }
      
      // Ler tipo de evento
      const type = view.getUint8(4) as EventType;
      
      // Ler timestamp
      const timestamp = Number(view.getBigUint64(5, false));
      
      // Ler tamanho dos dados
      const dataLength = view.getUint32(13, false);
      
      // Extrair dados comprimidos
      const compressedData = new Uint8Array(buffer, 17, dataLength);
      
      // Descomprimir
      const jsonData = this.gzipDecompress(compressedData);
      const parsedData = JSON.parse(jsonData);
      
      return {
        type,
        timestamp,
        streamId: parsedData.streamId || undefined,
        data: parsedData.data
      };
    } catch (error) {
      console.error('❌ [BINARY] Decode error:', error);
      return null;
    }
  }
  
  /**
   * Simulação de compressão gzip (na prática usaría Compression API)
   */
  private static gzipCompress(data: string): Uint8Array {
    // Simulação simples - na implementação real usaría CompressionStream
    const encoder = new TextEncoder();
    return encoder.encode(data);
  }
  
  /**
   * Simulação de descompressão gzip
   */
  private static gzipDecompress(data: Uint8Array): string {
    // Simulação simples - na implementação real usaría DecompressionStream
    const decoder = new TextDecoder();
    return decoder.decode(data);
  }
  
  /**
   * Cria evento de chat message binário
   */
  static createChatEvent(streamId: string, userId: string, userName: string, userAvatar: string, message: string): ArrayBuffer {
    return this.encode({
      type: EventType.CHAT_MESSAGE,
      timestamp: Date.now(),
      streamId,
      data: {
        userId,
        userName,
        userAvatar,
        message,
        id: `chat_${streamId}_${userId}_${Date.now()}`
      }
    });
  }
  
  /**
   * Cria evento de gift binário
   */
  static createGiftEvent(streamId: string, fromUserId: string, fromUserName: string, fromUserAvatar: string, giftId: string, giftName: string, giftIcon: string, giftPrice: number, quantity: number): ArrayBuffer {
    return this.encode({
      type: EventType.GIFT_SENT,
      timestamp: Date.now(),
      streamId,
      data: {
        fromUserId,
        fromUserName,
        fromUserAvatar,
        giftId,
        giftName,
        giftIcon,
        giftPrice,
        quantity,
        totalValue: giftPrice * quantity,
        id: `gift_${streamId}_${fromUserId}_${Date.now()}`
      }
    });
  }
  
  /**
   * Cria evento de entrada de usuário binário
   */
  static createUserJoinedEvent(streamId: string, userId: string, userName: string, userAvatar: string, userLevel: number): ArrayBuffer {
    return this.encode({
      type: EventType.USER_JOINED,
      timestamp: Date.now(),
      streamId,
      data: {
        userId,
        userName,
        userAvatar,
        userLevel,
        id: `join_${streamId}_${userId}_${Date.now()}`
      }
    });
  }
  
  /**
   * Cria evento de saída de usuário binário
   */
  static createUserLeftEvent(streamId: string, userId: string, userName: string): ArrayBuffer {
    return this.encode({
      type: EventType.USER_LEFT,
      timestamp: Date.now(),
      streamId,
      data: {
        userId,
        userName,
        id: `leave_${streamId}_${userId}_${Date.now()}`
      }
    });
  }
  
  /**
   * Cria evento de status da stream binário
   */
  static createStreamStatusEvent(streamId: string, status: 'starting' | 'live' | 'paused' | 'ended', viewers: number): ArrayBuffer {
    return this.encode({
      type: EventType.STREAM_STATUS,
      timestamp: Date.now(),
      streamId,
      data: {
        status,
        viewers,
        id: `status_${streamId}_${Date.now()}`
      }
    });
  }
  
  /**
   * Cria evento de atualização de viewers binário
   */
  static createViewersUpdateEvent(streamId: string, viewers: number): ArrayBuffer {
    return this.encode({
      type: EventType.VIEWERS_UPDATE,
      timestamp: Date.now(),
      streamId,
      data: {
        viewers,
        id: `viewers_${streamId}_${Date.now()}`
      }
    });
  }
  
  /**
   * Cria evento de heartbeat binário
   */
  static createHeartbeatEvent(streamId?: string): ArrayBuffer {
    return this.encode({
      type: EventType.HEARTBEAT,
      timestamp: Date.now(),
      streamId,
      data: {
        id: `heartbeat_${Date.now()}`
      }
    });
  }
}

export default BinaryProtocol;
