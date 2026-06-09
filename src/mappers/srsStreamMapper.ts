/**
 * Mapper Centralizado para Transformação de Dados SRS
 * 
 * Este arquivo centraliza todas as transformações de dados do SRS para o frontend,
 * evitando duplicação e garantindo consistência em toda a aplicação.
 * 
 * Se precisar alterar um campo, altere apenas aqui e refletirá em todas as rotas.
 */

export interface SrsStreamData {
    stream?: string;
    name?: string;
    client_id?: string;
    clients?: number;
    publish?: boolean;
    kbps?: {
        recv_30s?: number;
        send_30s?: number;
    };
    create?: string;
}

export interface StreamerDocument {
    id: string;
    hostId: string;
    name: string;
    avatar: string;
    country?: string;
    location?: string;
    message?: string;
    tags?: string[];
    isLive: boolean | undefined;
    streamStatus: string;
    viewers: number;
    diamonds?: number;
    isPrivate?: boolean;
    quality?: string;
    playbackUrl?: string;
    rtmpIngestUrl?: string;
    startTime?: Date;
    latitude?: number;
    longitude?: number;
    city?: string;
    state?: string;
}

export interface FrontendStreamFormat {
    id: string;
    hostId?: string;
    name: string;
    avatar: string;
    location: string;
    message: string;
    tags: string[];
    isHot: boolean;
    icon: string;
    country: string;
    viewers: number;
    isPrivate: boolean;
    quality: string;
    demoVideoUrl: string;
    rtmpIngestUrl: string;
    srtIngestUrl: string;
    streamKey: string;
    playbackUrl: string;
    streamServerUrl: string;
    roomId: string;
    isLive: boolean;
    startTime: string;
    streamStatus: string;
    category: string;
    language: string;
    maxViewers: number;
    recordingEnabled: boolean;
    chatEnabled: boolean;
    giftsEnabled: boolean;
    privateGiftId: string;
    isAutoPrivateInviteEnabled: boolean;
    diamonds: number;
    likes: number;
    publishUrl: string;
    playUrl: string;
    streamUrl: string;
    _id: string;
    createdAt: string;
    updatedAt: string;
    __v: number;
}

export interface ProtectedStreamFormat {
    id: string;
    name: string;
    avatar: string;
    viewers: number;
    diamonds: number;
    isLive: boolean;
    country: string;
    location: string;
    message: string;
    tags: string[];
    isPrivate: boolean;
    quality: string;
    playbackUrl?: string;
    latitude?: number;
    longitude?: number;
    city?: string;
    state?: string;
}

/**
 * Configurações padrão para URLs SRS
 */
const SRS_CONFIG = {
    host: process.env.SRS_HOST || 'srs',
    apiPort: process.env.SRS_API_PORT || '1990',
    rtmpPort: process.env.SRS_RTMP_PORT || '1935',
    httpPort: process.env.SRS_HTTP_PORT || '8088',
    app: process.env.SRS_APP || 'live',
    vhost: process.env.SRS_VHOST || '__defaultVhost__'
};

/**
 * Gera URLs SRS padrão para um stream
 */
function generateSrsUrls(streamId: string): {
    rtmpIngestUrl: string;
    playbackUrl: string;
    publishUrl: string;
    playUrl: string;
    streamUrl: string;
} {
    const { host, apiPort, rtmpPort, httpPort, app } = SRS_CONFIG;
    const apiProtocol = apiPort === '1985' ? 'http' : 'https';
    
    return {
        rtmpIngestUrl: `rtmp://${host}:${rtmpPort}/${app}/${streamId}`,
        playbackUrl: `https://${host}:${httpPort}/${app}/${streamId}.m3u8`,
        publishUrl: `${apiProtocol}://${host}:${apiPort}/rtc/v1/whip/?app=${app}&stream=${streamId}`,
        playUrl: `${apiProtocol}://${host}:${apiPort}/rtc/v1/whep/?app=${app}&stream=${streamId}`,
        streamUrl: `webrtc://${host}/${app}/${streamId}`
    };
}

/**
 * Gera ID falso para proteção de dados sensíveis
 * Usa o nome do host (username real) em vez de caracteres aleatórios
 */
function generateProtectedId(hostName?: string): string {
    const name = hostName || Math.random().toString(36).substr(2, 6);
    return `protected_${Date.now()}_${name}`;
}

/**
 * Mapper principal: Transforma dados SRS para formato completo do frontend
 * 
 * @param srsStream Dados brutos do SRS
 * @param overrideData Dados opcionais para sobrescrever valores padrão
 * @returns Objeto no formato completo do frontend
 */
export function mapSrsStreamToFrontend(
    srsStream: SrsStreamData,
    overrideData: Partial<FrontendStreamFormat> = {}
): FrontendStreamFormat {
    const streamId = srsStream.stream || srsStream.name || 'unknown';
    const srsUrls = generateSrsUrls(streamId);
    const now = new Date().toISOString();
    
    return {
        // Identificação
        id: streamId,
        hostId: srsStream.client_id || 'unknown',
        name: srsStream.stream || 'Unknown Stream',
        
        // Avatar e aparência
        avatar: overrideData.avatar || '',
        location: overrideData.location || 'Ao Vivo',
        message: overrideData.message || 'Transmissão ao vivo',
        tags: overrideData.tags || ['live', 'streaming'],
        
        // Status e popularidade
        isHot: overrideData.isHot || false,
        icon: overrideData.icon || '',
        country: overrideData.country || 'br',
        viewers: srsStream.clients || 0,
        isPrivate: overrideData.isPrivate || false,
        quality: overrideData.quality || 'HD',
        
        // URLs de ingestão e reprodução
        demoVideoUrl: overrideData.demoVideoUrl || '',
        rtmpIngestUrl: srsUrls.rtmpIngestUrl,
        srtIngestUrl: overrideData.srtIngestUrl || `srt://${SRS_CONFIG.host}:10080/live`,
        streamKey: streamId,
        playbackUrl: srsUrls.playbackUrl,
        streamServerUrl: overrideData.streamServerUrl || `https://${SRS_CONFIG.host}`,
        roomId: `room_${streamId}`,
        
        // Status da transmissão
        isLive: srsStream.publish || false,
        startTime: overrideData.startTime || now,
        streamStatus: srsStream.publish ? 'active' : 'inactive',
        
        // Configurações
        category: overrideData.category || 'live',
        language: overrideData.language || 'pt',
        maxViewers: overrideData.maxViewers || 1000,
        recordingEnabled: overrideData.recordingEnabled || false,
        chatEnabled: overrideData.chatEnabled !== false,
        giftsEnabled: overrideData.giftsEnabled !== false,
        
        // Configurações de privacidade
        privateGiftId: overrideData.privateGiftId || '',
        isAutoPrivateInviteEnabled: overrideData.isAutoPrivateInviteEnabled || false,
        
        // Interações
        diamonds: overrideData.diamonds || 0,
        likes: overrideData.likes || 0,
        
        // URLs WebRTC
        publishUrl: srsUrls.publishUrl,
        playUrl: srsUrls.playUrl,
        streamUrl: srsUrls.streamUrl,
        
        // Metadados do MongoDB
        _id: streamId,
        createdAt: overrideData.createdAt || now,
        updatedAt: overrideData.updatedAt || now,
        __v: overrideData.__v || 0,
        
        // Aplicar overrides (permite sobrescrever qualquer campo)
        ...overrideData
    };
}

/**
 * Mapper para streams protegidos (sem dados sensíveis)
 * 
 * @param stream Documento do streamer do MongoDB
 * @returns Objeto protegido para resposta da API
 */
export function mapStreamToProtected(stream: StreamerDocument): ProtectedStreamFormat {
    return {
        id: generateProtectedId(stream.name || stream.hostId),
        name: stream.name,
        avatar: stream.avatar,
        viewers: stream.viewers,
        diamonds: stream.diamonds || 0,
        isLive: stream.isLive || false,
        country: stream.country || 'XX',
        location: stream.location || 'Hidden',
        message: stream.message || '',
        tags: stream.tags || [],
        isPrivate: stream.isPrivate || false,
        quality: stream.quality || 'HD',
        playbackUrl: stream.playbackUrl || '',
        latitude: stream.latitude,
        longitude: stream.longitude,
        city: stream.city,
        state: stream.state
    };
}

/**
 * Mapper para array de streams SRS
 * 
 * @param srsStreams Array de dados SRS
 * @param overrideData Dados opcionais para aplicar a todos os streams
 * @returns Array de streams no formato do frontend
 */
export function mapSrsStreamsArray(
    srsStreams: SrsStreamData[],
    overrideData: Partial<FrontendStreamFormat> = {}
): FrontendStreamFormat[] {
    return (srsStreams || []).map(srsStream => 
        mapSrsStreamToFrontend(srsStream, overrideData)
    );
}

/**
 * Mapper para array de streams protegidos
 * 
 * @param streams Array de documentos do MongoDB
 * @returns Array de streams protegidos
 */
export function mapStreamsToProtectedArray(streams: StreamerDocument[]): ProtectedStreamFormat[] {
    return streams.map(stream => mapStreamToProtected(stream));
}

/**
 * Mapper para enriquecer streams com dados do host (protegido)
 * 
 * @param streams Array de streams
 * @param hostData Dados do host para enriquecer
 * @returns Array enriquecido e protegido
 */
export function enrichStreamsWithHostData(
    streams: StreamerDocument[],
    hostData: {
        name: string;
        avatar: string;
        level?: number;
        country?: string;
        isOnline?: boolean;
    }
): ProtectedStreamFormat[] {
    return streams.map(stream => ({
        ...mapStreamToProtected(stream),
        name: hostData.name || stream.name,
        avatar: hostData.avatar || stream.avatar,
        // Outros dados do host podem ser adicionados aqui se necessário
    }));
}

/**
 * Validação de dados SRS
 */
export function validateSrsStreamData(data: any): data is SrsStreamData {
    return data && typeof data === 'object';
}

/**
 * Validação de documento Streamer
 */
export function validateStreamerDocument(data: any): data is StreamerDocument {
    return data && 
           typeof data === 'object' &&
           typeof data.id === 'string' &&
           typeof data.hostId === 'string' &&
           typeof data.name === 'string' &&
           (typeof data.avatar === 'string' || data.avatar === undefined || data.avatar === null || data.avatar === '');
}

/**
 * Interface mais flexível para aceitar qualquer documento do MongoDB
 */
export interface MongoStreamerDocument {
    id: string;
    hostId: string;
    name: string;
    avatar: string;
    location?: string | undefined;
    message?: string | undefined;
    tags?: string[] | undefined;
    isHot?: boolean | undefined;
    icon?: string | undefined;
    country?: string | undefined;
    viewers?: number | undefined;
    isPrivate?: boolean | undefined;
    quality?: string | undefined;
    demoVideoUrl?: string | undefined;
    rtmpIngestUrl?: string | undefined;
    srtIngestUrl?: string | undefined;
    streamKey?: string | undefined;
    playbackUrl?: string | undefined;
    streamServerUrl?: string | undefined;
    roomId?: string | undefined;
    isLive?: boolean | undefined;
    startTime?: Date | undefined;
    endTime?: Date | undefined;
    streamStatus?: 'active' | 'ended' | 'paused' | undefined;
    category?: string | undefined;
    language?: string | undefined;
    maxViewers?: number | undefined;
    recordingEnabled?: boolean | undefined;
    chatEnabled?: boolean | undefined;
    giftsEnabled?: boolean | undefined;
    privateGiftId?: string | undefined;
    isAutoPrivateInviteEnabled?: boolean | undefined;
    diamonds?: number | undefined;
    likes?: number | undefined;
    createdAt?: Date | undefined;
    updatedAt?: Date | undefined;
    [key: string]: any; // Permite propriedades adicionais do MongoDB
}

/**
 * Mapper para streams protegidos (sem dados sensíveis) - versão flexível
 * 
 * @param stream Documento do streamer do MongoDB (tipo flexível)
 * @returns Objeto protegido para resposta da API
 */
export function mapStreamToProtectedFlexible(stream: MongoStreamerDocument): ProtectedStreamFormat {
    return {
        id: generateProtectedId(stream.name || stream.hostId),
        name: stream.name,
        avatar: stream.avatar,
        viewers: stream.viewers || 0,
        diamonds: stream.diamonds || 0,
        isLive: stream.isLive || false,
        country: stream.country || 'XX',
        location: stream.location || 'Hidden',
        message: stream.message || '',
        tags: stream.tags || [],
        isPrivate: stream.isPrivate || false,
        quality: stream.quality || 'HD',
        playbackUrl: stream.playbackUrl || '',
        latitude: stream.latitude,
        longitude: stream.longitude,
        city: stream.city,
        state: stream.state
    };
}

/**
 * Mapper para array de streams protegidos - versão flexível
 * 
 * @param streams Array de documentos do MongoDB (tipo flexível)
 * @returns Array de streams protegidos
 */
export function mapStreamsToProtectedArrayFlexible(streams: MongoStreamerDocument[]): ProtectedStreamFormat[] {
    return streams.map(stream => mapStreamToProtectedFlexible(stream));
}
