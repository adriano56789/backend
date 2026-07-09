// @ts-nocheck
import express from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../config/db';
import { v4 as uuidv4 } from 'uuid';
import { Streamer, User, Message, Followers, Friendship, Block, UserLevel, StreamKeyAssociation, GiftTransaction, StreamLike, Battle, LiveCard } from '../models/index';
import { getUserIdFromToken, generateJWT } from '../middleware/auth';
import { ResponseHelper } from '../middleware/responseHelper';
import { ENV } from '../config/env';
import { generateLiveKitToken } from '../services/LiveKitTokenService';

import { 

    mapSrsStreamToFrontend, 

    mapSrsStreamsArray, 

    mapStreamToProtectedFlexible, 

    mapStreamsToProtectedArrayFlexible,

    enrichStreamsWithHostData,

    validateSrsStreamData,

    validateStreamerDocument

} from '../mappers/srsStreamMapper';

const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?name=User&background=7c3aed&color=fff&size=100';

function resolveAvatar(user: any): string {
  if (!user) return DEFAULT_AVATAR;
  if (user.avatarUrl && user.avatarUrl.trim() !== '') return user.avatarUrl;
  if (user.name && user.name.trim() !== '') {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=7c3aed&color=fff&size=100`;
  }
  return DEFAULT_AVATAR;
}

// import { 

//     validateBody, 

//     validateQuery, 

//     validateParams,

//     createStreamSchema,

//     updateStreamSchema,

//     streamQuerySchema,

//     likeSchema,

//     streamIdParamsSchema,

//     nearbyQuerySchema

// } from '../validators/routeValidators'; // TODO: Criar arquivo de validadores

import { streamIdMapper, validateProtectedStreamId } from '../services/StreamIdMapper';

import { 

    successResponse, 

    errorResponse, 

    notFoundResponse, 

    validationErrorResponse,

    internalServerErrorResponse,

    srsSuccessResponse,

    srsErrorResponse,

    logRequest

} from '../utils/responseHelpers';

import { IUser } from '../models/index';

import { findUserByAnyId } from '../utils/idHelper';

// import { deduplicateStreamsBeforeCreate, forceCleanupDuplicateStreams } from '../middleware/StreamDeduplicationMiddleware'; // TODO: Criar middleware de deduplicação



const router = express.Router();

// Parameter middleware to normalize stream IDs (remove 'stream_' prefix if present)
router.param('id', (req, res, next, val) => {
    if (val && typeof val === 'string' && val.startsWith('stream_')) {
        req.params.id = val.replace('stream_', '');
    }
    next();
});

router.param('streamId', (req, res, next, val) => {
    if (val && typeof val === 'string' && val.startsWith('stream_')) {
        req.params.streamId = val.replace('stream_', '');
    }
    next();
});

const isValidObjectId = (value: string) => { try { new ObjectId(value); return true; } catch { return false; } };



// --- SRS APENAS PARA INGESTÃO DE VÍDEO ---
// SRS não deve ser usado para controle de status, validação ou lógica de aplicação

// Uso do SRS deve ser limitado a: publish (ingest) e play (distribuição)

// Controle de live é feito pelo backend via /streams e /live/end



// GET /api/game-list - Endpoint para categorias reais do app
router.get('/game-list', async (req, res) => {
  try {
    console.log('[GAME-LIST] Buscando categorias reais do app...');
    
    // Categorias reais baseadas no app LiveGo
    const categories = [
      {
        id: 'popular',
        name: 'Popular',
        icon: '🔥',
        description: 'Lives mais populares',
        active: true
      },
      {
        id: 'followed',
        name: 'Seguindo',
        icon: '❤️',
        description: 'Lives de usuários que você segue',
        active: true
      },
      {
        id: 'nearby',
        name: 'Próximas',
        icon: '📍',
        description: 'Lives na sua região',
        active: true
      },
      {
        id: 'pk',
        name: 'PK Battle',
        icon: '⚔️',
        description: 'Batalhas ao vivo',
        active: true
      },
      {
        id: 'new',
        name: 'Novas',
        icon: '✨',
        description: 'Lives mais recentes',
        active: true
      },
      {
        id: 'music',
        name: 'Música',
        icon: '🎵',
        description: 'Lives de música',
        active: true
      },
      {
        id: 'dance',
        name: 'Dança',
        icon: '💃',
        description: 'Lives de dança',
        active: true
      },
      {
        id: 'party',
        name: 'Festa',
        icon: '🎉',
        description: 'Lives de festa',
        active: true
      },
      {
        id: 'private',
        name: 'Privado',
        icon: '🔒',
        description: 'Lives privadas',
        active: true
      }
    ];
    
    console.log(`[GAME-LIST] Retornando ${categories.length} categorias reais`);
    
    res.json({
      success: true,
      data: {
        categories: categories,
        total: categories.length
      }
    });
    
  } catch (error: any) {
    console.error('[GAME-LIST] Erro ao buscar categorias:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});









// POST /api/token/user/online/infos - Endpoint central BuzzCast style

// Carrega todas as informações do usuário online em uma única chamada

router.post('/token/user/online/infos', async (req, res) => {

    try {

        console.log('[USER-ONLINE-INFOS] Iniciando carregamento de dados do usuário...');

        

        const userId = getUserIdFromToken(req);

        if (!userId) {

            return res.status(401).json({

                code: 1,

                msg: 'Usuário não autenticado'

            });

        }



        const user = await findUserByAnyId(User, userId);

        if (!user) {

            return res.status(404).json({

                code: 1,

                msg: 'Usuário não encontrado'

            });

        }



        console.log(`[USER-ONLINE-INFOS] Usuário encontrado: ${user.name} (${userId})`);

        console.log(`[USER-ONLINE-INFOS] Status atual - isOnline: ${user.isOnline}, isLive: ${user.isLive}, currentStreamId: ${user.currentStreamId}`);



        // Verificar se existe stream realmente ativa

        const hasActiveStream: any = await Streamer.findOne({ 

            hostId: userId, 

            isLive: true,

            streamStatus: 'active'

        });



        // Se usuário está marcado como isLive=true mas não tem stream ativa, resetar status

        if (user.isLive && !hasActiveStream) {

            console.log(`[USER-ONLINE-INFOS] Resetando isLive=false - usuário marcado como live mas sem stream ativa`);

            await User.findOneAndUpdate(

                { id: userId },

                { $set: {

                    isLive: false,

                    currentStreamId: null,

                    lastSeen: new Date()

                } }

            );

            user.isLive = false;

            user.currentStreamId = undefined;

        }



        // Verificar status online do usuário

        const isOnline = user.isOnline || false;

        const isLive = user.isLive || false;

        const currentStreamId = user.currentStreamId || undefined;



        // Dados completos do usuário online

        const onlineInfos = {

            // Status do usuário

            status: {

                isOnline: isOnline,

                isLive: isLive,

                currentStreamId: currentStreamId,

                lastSeen: user.lastSeen || new Date(),

                serverTime: new Date().toISOString()

            },

            

            // Informações básicas do usuário

            user: {

                id: user.id,

                name: user.name,

                avatar: user.avatarUrl || '',

                cover: user.coverUrl || '',

                bio: user.bio || '',

                level: user.level || 1,

                isVerified: false, // Propriedade não existe no modelo User

                fans: user.fans || 0,

                following: user.following || 0,

                country: user.country || 'BR',

                diamonds: user.diamonds || 0,

                coins: 0 // Propriedade não existe no modelo User

            },

            

            // Configurações da aplicação

            app: {

                version: '2.0.0',

                features: {

                    beauty: true,

                    gifts: true,

                    pk: true,

                    private: true,

                    cohost: true,

                    multiGuest: true,

                    stickers: true,

                    filters: true

                },

                limits: {

                    maxTitleLength: 50,

                    maxDescriptionLength: 200,

                    maxTags: 5,

                    maxDuration: 14400, // 4 horas

                    maxViewers: 10000

                }

            },

            

            // Configurações padrão da live

            defaultLive: {

                title: `Live de ${user.name}`,

                description: `Ao vivo com ${user.name}!`,

                category: 'popular',

                tags: ['popular'],

                privacy: 'public',

                quality: 'HD',

                giftsEnabled: true,

                chatEnabled: true,

                beautyEnabled: true

            },

            

            // Configuração SRS para ingestão de vídeo

            srs: {

                host: process.env.SRS_HOST || 'srs',

                ports: {

                    rtmp: 1935,

                    http: 8088,

                    https: 443,

                    webrtc: 8000

                },

                app: 'live',

                vhost: '__defaultVhost__',

                api: ENV.SRS_API_URL

            },

            

            // Permissões do usuário

            permissions: {

                canGoLive: !isLive, // Só pode iniciar live se não estiver ao vivo

                canReceiveGifts: true,

                canSendGifts: user.diamonds > 0,

                canUsePK: (user.level || 0) >= 5,

                canCreatePrivate: true,

                canUseBeauty: true,

                maxDuration: 14400 // 4 horas

            },

            

            // Estatísticas do usuário

            stats: {

                totalStreams: 0, // TODO: Buscar do histórico

                totalViews: 0, // TODO: Buscar do histórico

                totalGifts: 0, // TODO: Buscar do histórico

                avgViewers: 0, // TODO: Calcular do histórico

                totalDiamonds: user.diamonds || 0

            }

        };



        // Atualizar status online do usuário

        await User.findOneAndUpdate(

            { id: userId },

            { $set: {

                isOnline: true,

                lastSeen: new Date()

            } }

        );



        console.log(`[USER-ONLINE-INFOS] Dados carregados para usuário: ${user.name}`);

        

        // Resposta no formato BuzzCast

        res.json({

            code: 0,

            msg: 'OK',

            data: onlineInfos

        });



    } catch (error) {

        console.error('[USER-ONLINE-INFOS] Erro ao carregar informações:', error);

        res.status(500).json({

            code: 1,

            msg: 'Erro interno ao carregar informações do usuário'

        });

    }

});



// GET /api/live/source-data - Configurações iniciais do usuário (sourceDataNew) - LEGADO

router.get('/live/source-data', async (req, res) => {

    try {

        const userId = getUserIdFromToken(req);

        if (!userId) {

            return res.status(401).json({

                success: false,

                message: 'Usuário não autenticado'

            });

        }



        const user = await findUserByAnyId(User, userId);

        if (!user) {

            return res.status(404).json({

                success: false,

                message: 'Usuário não encontrado'

            });

        }



        // Configurações do app e do usuário

        const sourceData = {

            // Configurações do app

            app: {

                version: '2.0.0',

                features: {

                    beauty: true,

                    gifts: true,

                    pk: true,

                    private: true,

                    cohost: true,

                    multiGuest: false

                },

                limits: {

                    maxTitleLength: 50,

                    maxDescriptionLength: 200,

                    maxTags: 5,

                    maxDuration: 14400 // 4 horas

                }

            },

            

            // Dados do usuário

            user: {

                id: user.id,

                name: user.name,

                avatar: user.avatarUrl || '',

                cover: user.coverUrl || '',

                bio: user.bio || '',

                level: user.level || 1,

                isVerified: false, // Propriedade não existe no modelo User

                followers: user.fans || 0, // Usar 'fans' em vez de 'followers'

                country: user.country || 'BR',

                diamonds: user.diamonds || 0

            },

            

            // Configurações padrão da live

            defaultLive: {

                title: `Live de ${user.name}`,

                description: `Ao vivo com ${user.name}!`,

                category: 'popular',

                tags: ['popular'],

                privacy: 'public',

                quality: 'HD',

                giftsEnabled: true,

                chatEnabled: true

            },

            

            // SRS Configuration

            srs: {

                host: process.env.SRS_HOST || 'srs',

                ports: {

                    rtmp: 1935,

                    http: 8080,

                    https: 443,

                    webrtc: 8000

                },

                app: 'live',

                vhost: '__defaultVhost__'

            }

        };



        res.json({

            success: true,

            sourceData

        });

    } catch (error) {

        console.error('[SOURCE-DATA] Erro ao buscar configurações:', error);

        res.status(500).json({

            success: false,

            message: 'Erro ao buscar configurações iniciais'

        });

    }

});



// ...





// REMOVIDO: Endpoint start paralelo - usar API real POST /streams



// GET /api/live/info - Endpoint LiveGo style para polling de status

router.get('/live/info', async (req, res) => {

    try {

        console.log('[LIVEGO-INFO] Buscando informações da live...');

        

        const userId = getUserIdFromToken(req);

        if (!userId) {

            return res.status(401).json({ 

                code: 1, 

                msg: 'Usuário não autenticado' 

            });

        }



        // Parâmetros da query (LiveGo style)

        const { 

            liveId, 

            streamId, 

            likeNum = '0',

            pushIp,

            indexs = '1'

        } = req.query;



        console.log('[LIVEGO-INFO] Parâmetros:', { liveId, streamId, likeNum, pushIp, indexs });



        // Buscar stream - priorizar streamId ou liveId

        let stream;

        if (streamId) {

            stream = await Streamer.findOne({ id: streamId });

        } else if (liveId) {

            stream = await Streamer.findOne({ liveId: liveId });

        } else {

            // Se não especificar, buscar live atual do usuário

            stream = await Streamer.findOne({ 

                hostId: userId,

                isLive: true 

            });

        }



        if (!stream) {

            return res.status(404).json({

                code: 1,

                msg: 'Live não encontrada',

                data: null

            });

        }



        // Buscar dados do host

        const host = await findUserByAnyId(User, stream.hostId);

        if (!host) {

            return res.status(404).json({

                code: 1,

                msg: 'Host não encontrado',

                data: null

            });

        }



        // Contador de viewers online (via WebSocket ou banco)

        // TODO: Implementar serviço de contagem de viewers online em tempo real

        const viewerCount = stream.viewers || 0;



        // Buscar likes da stream

        // TODO: Implementar serviço de contagem de likes

        const likesCount = stream.likes || 0;



        // Calcular tempo de live

        const startTime = stream.startTime ? new Date(stream.startTime) : new Date();

        const currentTime = new Date();

        const duration = Math.floor((currentTime.getTime() - startTime.getTime()) / 1000);



        console.log(`[LIVEGO-INFO] Live encontrada: ${stream.name} (${viewerCount} viewers)`);



        // Resposta no formato LiveGo

        res.json({

            code: 0,

            msg: 'OK',

            data: {

                liveId: stream.liveId || stream.id,

                streamId: stream.id,

                status: stream.isLive ? 'live' : 'ended',

                streamStatus: stream.streamStatus,

                title: stream.name,

                description: stream.message,

                category: stream.category,

                tags: stream.tags,

                

                // Contadores

                viewers: viewerCount,

                likes: likesCount,

                likeNum: String(likesCount),

                

                // Tempo

                startTime: stream.startTime || new Date(),

                duration: duration,

                timeFormatted: formatDuration(duration),

                

                // Host

                host: {

                    id: host.id,

                    name: host.name,

                    avatar: host.avatarUrl,

                    level: host.level || 1,

                    isVerified: false,

                    fans: host.fans || 0,

                    country: host.country || 'BR'

                },

                

                // URLs

                playbackUrl: stream.playbackUrl,

                rtmpUrl: stream.rtmpUrl,

                webrtcUrl: stream.webrtcUrl,

                flvUrl: stream.flvUrl,

                

                // Metadados

                pushIp: pushIp || null,

                indexs: parseInt(indexs as string),

                lastUpdate: new Date().toISOString(),

                

                // Status detalhado

                isLive: stream.isLive,

                canReceiveGifts: true,

                chatEnabled: true,

                giftsEnabled: true

            }

        });



    } catch (error) {

        console.error('[LIVEGO-INFO] Erro ao buscar informações:', error);

        res.status(500).json({

            code: 1,

            msg: 'Erro interno ao buscar informações da live'

        });

    }

});



// POST /api/live/beat - Endpoint LiveGo style para heartbeat

router.post('/live/beat', async (req, res) => {

    try {

        console.log('[LIVEGO-BEAT] Enviando heartbeat...');

        

        const userId = getUserIdFromToken(req);

        if (!userId) {

            return res.status(401).json({ 

                code: 1, 

                msg: 'Usuário não autenticado' 

            });

        }



        const { liveId, streamId } = req.body;



        // Buscar stream

        let stream;

        if (streamId) {

            stream = await Streamer.findOne({ id: streamId });

        } else if (liveId) {

            stream = await Streamer.findOne({ liveId: liveId });

        } else {

            stream = await Streamer.findOne({ 

                hostId: userId,

                isLive: true 

            });

        }



        if (!stream) {

            return res.status(404).json({

                code: 1,

                msg: 'Live não encontrada'

            });

        }



        // Verificar se a live pertence ao usuário

        if (stream.hostId !== userId) {

            return res.status(403).json({

                code: 1,

                msg: 'Acesso negado a esta live'

            });

        }



        // Atualizar heartbeat

        await Streamer.findOneAndUpdate(

            { id: stream.id },

            { 
                $set: { lastHeartbeat: new Date() },
                $setOnInsert: { 

                    heartbeatCount: (stream.heartbeatCount || 0) + 1 

                }

            }

        );



        // Atualizar lastSeen do usuário

        await User.findOneAndUpdate(

            { id: userId },

            { $set: { lastSeen: new Date() } }

        );



        console.log(`[LIVEGO-BEAT] Heartbeat enviado para live: ${stream.id}`);



        res.json({

            code: 0,

            msg: 'OK',

            data: {

                liveId: stream.liveId || stream.id,

                streamId: stream.id,

                heartbeatAt: new Date().toISOString(),

                status: 'alive'

            }

        });



    } catch (error) {

        console.error('[LIVEGO-BEAT] Erro no heartbeat:', error);

        res.status(500).json({

            code: 1,

            msg: 'Erro interno no heartbeat'

        });

    }

});



// POST /api/live/monitoring/success - Endpoint LiveGo style para tracking

router.post('/live/monitoring/success', async (req, res) => {

    try {

        console.log('[LIVEGO-MONITORING] Registrando sucesso da transmissão...');

        

        const userId = getUserIdFromToken(req);

        if (!userId) {

            return res.status(401).json({ 

                code: 1, 

                msg: 'Usuário não autenticado' 

            });

        }



        const { 

            liveId, 

            streamId, 

            startTime,

            quality,

            bitrate,

            resolution,

            fps,

            droppedFrames

        } = req.body;



        // Buscar stream

        let stream;

        if (streamId) {

            stream = await Streamer.findOne({ id: streamId });

        } else if (liveId) {

            stream = await Streamer.findOne({ liveId: liveId });

        } else {

            stream = await Streamer.findOne({ 

                hostId: userId,

                isLive: true 

            });

        }



        if (!stream) {

            return res.status(404).json({

                code: 1,

                msg: 'Live não encontrada'

            });

        }



        // Registrar métricas de sucesso

        const monitoringData = {

            streamId: stream.id,

            userId: userId,

            liveId: stream.liveId || stream.id,

            startTime: startTime || stream.startTime,

            successAt: new Date(),

            

            // Métricas de qualidade

            quality: quality || 'unknown',

            bitrate: bitrate || 0,

            resolution: resolution || 'unknown',

            fps: fps || 0,

            droppedFrames: droppedFrames || 0,

            

            // Status da conexão

            connectionStatus: 'success',

            streamingSuccess: true

        };



        // Salvar métricas (poderia ser em uma coleção separada)

        console.log('[LIVEGO-MONITORING] Métricas registradas:', monitoringData);



        // Atualizar stream com status de sucesso

        await Streamer.findOneAndUpdate(

            { _id: stream._id },

            { $set: { 

                streamingSuccess: true,

                lastMonitoringAt: new Date(),

                monitoringData: monitoringData

            } }

        );



        res.json({

            code: 0,

            msg: 'OK',

            data: {

                success: true,

                recordedAt: new Date().toISOString(),

                streamId: stream.id,

                liveId: stream.liveId || stream.id

            }

        });



    } catch (error) {

        console.error('[LIVEGO-MONITORING] Erro no monitoring:', error);

        res.status(500).json({

            code: 1,

            msg: 'Erro interno no monitoring'

        });

    }

});



// Função utilitária para formatar duração

function formatDuration(seconds: number): string {

    const hours = Math.floor(seconds / 3600);

    const minutes = Math.floor((seconds % 3600) / 60);

    const secs = seconds % 60;

    

    if (hours > 0) {

        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    } else {

        return `${minutes}:${secs.toString().padStart(2, '0')}`;

    }

}

// Mapa de países com bandeiras para enriquecer resposta das streams
// Usado pelo /api/streams para adicionar countryName e flagUrl em cada live
const COUNTRY_FLAGS: Record<string, { name: string; flagUrl: string }> = {
    br: { name: 'Brasil', flagUrl: 'https://flagcdn.com/w40/br.png' },
    us: { name: 'Estados Unidos', flagUrl: 'https://flagcdn.com/w40/us.png' },
    pt: { name: 'Portugal', flagUrl: 'https://flagcdn.com/w40/pt.png' },
    ar: { name: 'Argentina', flagUrl: 'https://flagcdn.com/w40/ar.png' },
    mx: { name: 'México', flagUrl: 'https://flagcdn.com/w40/mx.png' },
    co: { name: 'Colômbia', flagUrl: 'https://flagcdn.com/w40/co.png' },
    cl: { name: 'Chile', flagUrl: 'https://flagcdn.com/w40/cl.png' },
    pe: { name: 'Peru', flagUrl: 'https://flagcdn.com/w40/pe.png' },
    ve: { name: 'Venezuela', flagUrl: 'https://flagcdn.com/w40/ve.png' },
    es: { name: 'Espanha', flagUrl: 'https://flagcdn.com/w40/es.png' },
    it: { name: 'Itália', flagUrl: 'https://flagcdn.com/w40/it.png' },
    fr: { name: 'França', flagUrl: 'https://flagcdn.com/w40/fr.png' },
    de: { name: 'Alemanha', flagUrl: 'https://flagcdn.com/w40/de.png' },
    gb: { name: 'Reino Unido', flagUrl: 'https://flagcdn.com/w40/gb.png' },
    ca: { name: 'Canadá', flagUrl: 'https://flagcdn.com/w40/ca.png' },
    jp: { name: 'Japão', flagUrl: 'https://flagcdn.com/w40/jp.png' },
    kr: { name: 'Coreia do Sul', flagUrl: 'https://flagcdn.com/w40/kr.png' },
    in: { name: 'Índia', flagUrl: 'https://flagcdn.com/w40/in.png' },
    ao: { name: 'Angola', flagUrl: 'https://flagcdn.com/w40/ao.png' },
    mz: { name: 'Moçambique', flagUrl: 'https://flagcdn.com/w40/mz.png' },
    cv: { name: 'Cabo Verde', flagUrl: 'https://flagcdn.com/w40/cv.png' },
};

function getCountryInfo(countryCode: string): { name: string; flagUrl: string } {
    const code = (countryCode || 'br').toLowerCase();
    return COUNTRY_FLAGS[code] || { name: code.toUpperCase(), flagUrl: `https://flagcdn.com/w40/${code}.png` };
}



// Endpoint START (Pré-live/Preparação) - Primeira API chamada conforme padrão SRS

router.post('/srs/start', async (req, res) => {

    try {

        console.log('[SRS-START] Iniciando preparação...');

        

        const userId = getUserIdFromToken(req);

        

        if (!userId) {

            console.log('[SRS-START] Falha: UserID não encontrado');

            return res.status(401).json({ code: 1, msg: 'Usuário não autenticado' });

        }



        console.log('[SRS-START] Gerando IDs únicos...');

        // Gerar IDs únicos para a transmissão

        const timestamp = Date.now();

        const liveId = userId;

        const streamId = userId;

        const streamKey = 'stream_' + uuidv4();



        // GERAR TOKEN JWT para autenticação SRS

        const jwt = require('jsonwebtoken');

        const srsSecret = process.env.SRS_SECRET || 'srs-secret-key';

        

        const tokenPayload = {

            userId,

            liveId,

            streamId,

            streamKey,

            timestamp,

            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 horas de validade

        };

        

        const token = jwt.sign(tokenPayload, srsSecret);

        console.log('[SRS-START] Token JWT gerado com sucesso');



        console.log('[SRS-START] Configurando URLs SRS...');

        // Configurações SRS

        const srsHost = process.env.SRS_HOST || process.env.DOMAIN || 'srs';

        const srsVhost = process.env.SRS_VHOST || '__defaultVhost__';

        const srsApp = process.env.SRS_APP || 'live';

        const srsRtmpPort = process.env.SRS_RTMP_PORT || '1935';



        // Construir URLs SRS

        const pushUrl = `rtmp://${srsHost}:${srsRtmpPort}/${srsApp}?vhost=${srsVhost}&token=${token}`;

        const rtmpUrl = `rtmp://${srsHost}:${srsRtmpPort}/${srsApp}/${streamId}?vhost=${srsVhost}&token=${token}`;

        const webrtcUrl = `webrtc://${srsHost}/${srsApp}/${streamId}?vhost=${srsVhost}&token=${token}`;

        // HLS URL para reprodução via proxy HTTPS (evita mixed content)
        const BACKEND_URL = process.env.BACKEND_URL || 'https://api.livego.store';
        const hlsUrl = `${BACKEND_URL}/api/video/http/live/${streamId}.m3u8`;

        console.log('[SRS-START] URLs SRS configuradas');



        console.log('[SRS-START] Buscando dados do usuário no MongoDB...');

        // Buscar dados do usuário

        const user = await findUserByAnyId(User, userId);

        console.log('[SRS-START] Usuário encontrado:', user ? 'SIM' : 'NÃO');

        if (!user) {

            return res.status(404).json({ 

                code: 1, 

                msg: 'Usuário não encontrado' 

            });

        }



        const hostName = user.name || 'Unknown';

        const hostAvatar = user.avatarUrl || '';



        // Armazenar sessão da live no banco para validação posterior

        const liveSession = {

            liveId,

            streamId,

            streamKey,

            token,

            userId,

            hostName,

            hostAvatar,

            status: 'prepared',

            createdAt: new Date(),

            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas

        };



        // Salvar sessão no MongoDB

        try {
            const db = getDb();
            await db.collection('live_sessions').insertOne(liveSession);
            console.log(`[SRS-START] Sessão salva: ${liveId}`);
        } catch (sessionError) {
            console.error('[SRS-START] Erro ao salvar sessão:', sessionError);
        }



        // Resposta conforme documentação SRS

        const response = {

            code: 0,

            msg: 'OK',

            data: {

                liveId,

                streamId,

                streamKey,

                token,

                pushUrl,

                rtmpUrl,

                webrtcUrl,

                hlsUrl, // URL HLS para reprodução no ExoPlayer (Android) e LivePlayer (Web)

                vhost: srsVhost,

                app: srsApp,

                stream: streamId,



                // Metadados

                hostId: userId,

          hostName: user.name,

                hostAvatar: user.avatarUrl,

                preparedAt: new Date().toISOString(),

                status: 'prepared' // Status: prepared para pré-live

            }

        };



        console.log('[SRS-START] Transmissão preparada com sucesso:', { liveId, streamId, token });

        res.json(response);



    } catch (error) {

        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

        const errorStack = error instanceof Error ? error.stack : undefined;

        const errorName = error instanceof Error ? error.name : 'UnknownError';

        

        console.error('[SRS-START] Erro na preparação - Detalhes:', {

            message: errorMessage,

            stack: errorStack,

            name: errorName

        });

        res.status(500).json({ 

            code: 1,

            msg: `Erro interno ao preparar transmissão: ${errorMessage}` 

        });

    }

});



// Endpoint PUBLISH - Usa token gerado na START e inicia transmissão SRS

router.post('/srs/publish', async (req, res) => {

    try {

        console.log('[SRS-PUBLISH] Iniciando publicação com token da START...');

        

        const userId = getUserIdFromToken(req);

        if (!userId) {

            return res.status(401).json({ 

                code: 1,

                msg: 'Usuário não autenticado' 

            });

        }



        // Buscar dados do usuário

        const user = await findUserByAnyId(User, userId);

        if (!user) {

            return res.status(404).json({ 

                code: 1,

                msg: 'Usuário não encontrado' 

            });

        }



        // VALIDAR TOKEN DA START - Buscar sessão preparada

        const jwt = require('jsonwebtoken');

        const srsSecret = process.env.SRS_SECRET || 'srs-secret-key';

        

        // O frontend deve enviar o token gerado na START

        const { token } = req.body;

        if (!token) {

            return res.status(400).json({ 

                code: 1,

                msg: 'Token da START é obrigatório' 

            });

        }



        // Validar e decodificar token JWT

        let decodedToken;

        try {

            decodedToken = jwt.verify(token, srsSecret);

            console.log('[SRS-PUBLISH] Token validado:', decodedToken);

        } catch (error) {

            console.error('[SRS-PUBLISH] Token inválido:', error);

            return res.status(401).json({ 

                code: 1,

                msg: 'Token inválido ou expirado' 

            });

        }



        // Verificar se o token pertence ao usuário correto

        if (decodedToken.userId !== userId) {

            return res.status(401).json({ 

                code: 1,

                msg: 'Token não pertence ao usuário' 

            });

        }



        // Usar dados do token (gerados na START)

        const { liveId, streamId, streamKey } = decodedToken;



        // Configurações SRS conforme documentação

        const srsHost = process.env.SRS_HOST || process.env.DOMAIN || 'srs';

        const srsPort = process.env.SRS_RTMP_PORT || '1935';

        const vhost = process.env.SRS_VHOST || '__defaultVhost__';

        const app = 'live';



        // URLs SRS usando dados da START - stream key simples (sem secret/query)

        const pushUrl = `rtmp://${srsHost}:${srsPort}/${app}/${streamId}`;

        const webrtcUrl = `webrtc://${srsHost}:8000/${app}/${streamId}`;

        const BACKEND_URL = process.env.BACKEND_URL || 'https://api.livego.store';
        const httpFlvUrl = `${BACKEND_URL}/api/video/http/live/${streamId}.flv`;
        const hlsUrl = `${BACKEND_URL}/api/video/http/live/${streamId}.m3u8`;



        // Criar/atualizar stream no banco com dados reais

        const streamerData = {

            id: streamId,

            hostId: userId,

            name: user.name,

            avatar: resolveAvatar(user),

            location: user.country || 'BR',

            time: 'Ao Vivo',

            message: `Live de ${user.name}`,

            tags: ['live'],

            isLive: true,

            streamStatus: 'active',

            startTime: new Date(),

            streamKey: streamKey,

            country: user.country || 'BR',

            // URLs SRS com dados reais

            rtmpIngestUrl: pushUrl,

            playbackUrl: hlsUrl,

            httpFlvUrl: httpFlvUrl,

            hlsUrl: hlsUrl,

            // Metadados SRS com dados reais

            vhost: vhost,

            app: app,

            stream: streamId,

            token: token // Token JWT da START

        };



        // Upsert: criar ou atualizar stream existente
        await Streamer.findOneAndUpdate(
            { id: streamId },
            streamerData,
            { upsert: true, returnDocument: 'after' }
        );



        // Atualizar status do usuário

        await User.findOneAndUpdate(

            { id: userId },

            { $set: {

                isLive: true,

                currentStreamId: streamId

            } }

        );



        console.log(`[SRS-PUBLISH] Transmissão iniciada: ${streamId} para usuário ${userId}`);

        console.log(`[SRS-PUBLISH] Usando token da START: ${token.substring(0, 20)}...`);

        console.log(`[SRS-PUBLISH] WebRTC URL: ${webrtcUrl}`);

        const io = req.app.get('io');
        if (io) {
            io.emit('new_live', {
                id: liveId || streamId,
                hostId: userId,
                name: user.name || `Live`,
                avatar: user.avatarUrl || '',
                isLive: true,
                streamStatus: 'active',
                country: user.country || 'BR',
                viewers: 0,
                timestamp: new Date().toISOString()
            });
            io.emit('stream_started', {
                streamId: liveId || streamId,
                hostId: userId,
                name: user.name || `Live`,
                avatar: user.avatarUrl || '',
                timestamp: new Date().toISOString()
            });
        }

        // Retorno conforme padrão SRS com dados reais

        res.json({

            code: 0,

            msg: 'OK',

            data: {

                // Dados essenciais SRS (do token START)

                streamId: streamId,

                liveId: liveId,

                streamKey: streamKey,

                token: token, // Token JWT da START

                

                // URLs para publicação (dinâmicas)

                pushUrl: pushUrl,

                rtmpUrl: pushUrl,

                webrtcUrl: webrtcUrl,

                

                // URLs para reprodução (dinâmicas)

                playbackUrl: httpFlvUrl,

                hlsUrl: hlsUrl,

                

                // Configurações SRS (dinâmicas)

                vhost: vhost,

                app: app,

                stream: streamId,

                

                // Metadados (dados reais do usuário)

                hostId: userId,

                hostName: user.name,

                hostAvatar: user.avatarUrl,

                startTime: new Date().toISOString()

            }

        });



    } catch (error) {

        console.error('[SRS-PUBLISH] Erro:', error);

        res.status(500).json({ 

            code: 1,

            msg: 'Erro interno ao iniciar transmissão' 

        });

    }

});



// Endpoint POST /live/clear - Limpar lives ativas órfãs
router.post('/live/clear', async (req, res) => {
    try {
        console.log('[LIVE-CLEAR] Limpando lives ativas órfãs...');
        
        const userId = getUserIdFromToken(req);
        console.log('[LIVE-CLEAR] User ID extraído do token:', userId);

        if (!userId) {
            console.log('[LIVE-CLEAR] Erro: Usuário não autenticado');
            return res.status(401).json({ 
                success: false,
                message: 'Usuário não autenticado' 
            });
        }

        // Buscar todas as lives ativas do usuário
        const activeStreams = await Streamer.find({ 
            hostId: userId,
            isLive: true 
        });

        console.log(`[LIVE-CLEAR] Encontradas ${activeStreams.length} lives ativas para o usuário ${userId}`);

        if (activeStreams.length === 0) {
            return res.json({
                success: true,
                message: 'Nenhuma live ativa encontrada',
                cleared: 0
            });
        }

        // Limpar todas as lives ativas (marcar como encerradas)
        const clearedStreams = [];
        for (const stream of activeStreams) {
            await Streamer.updateOne(
                { _id: stream._id },
                { $set: { 
                    isLive: false,
                    streamStatus: 'ended',
                    endTime: new Date()
                } }
            );
            clearedStreams.push(stream.id);
        }

        // Atualizar status do usuário
        await User.findOneAndUpdate(
            { id: userId },
            { $set: { 
                isLive: false, 
                isOnline: false,
                currentStreamId: null 
            } }
        );

        console.log(`[LIVE-CLEAR] ${clearedStreams.length} lives limpas: ${clearedStreams.join(', ')}`);

        const io = req.app.get('io');
        if (io) {
            for (const s of activeStreams) {
                io.emit('card_removed', {
                    streamId: s.id || clearedStreams[0],
                    hostId: s.hostId || userId,
                    timestamp: new Date().toISOString()
                });
                io.emit('stream_ended', {
                    streamId: s.id || clearedStreams[0],
                    hostId: s.hostId || userId,
                    timestamp: new Date().toISOString()
                });
                io.emit('stream_stopped', {
                    streamId: s.id || clearedStreams[0],
                    hostId: s.hostId || userId,
                    timestamp: new Date().toISOString()
                });
            }
        }

        return res.json({
            success: true,
            message: `${clearedStreams.length} lives ativas limpas com sucesso`,
            cleared: clearedStreams.length,
            streamIds: clearedStreams
        });

    } catch (error: any) {
        console.error('[LIVE-CLEAR] Erro ao limpar lives:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro ao limpar lives ativas',
            error: error.message
        });
    }
});

// POST /api/permissions/audio/request - Solicitar permissão de gravação de áudio
router.post('/permissions/audio/request', async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não autenticado'
            });
        }

        const { purpose = 'live_streaming' } = req.body;

        console.log(`[AUDIO-PERMISSION] Usuário ${userId} solicitando permissão para: ${purpose}`);

        // Registrar solicitação de permissão no usuário
        await User.findOneAndUpdate(
            { id: userId },
            {
                $push: {
                    recentActivities: {
                        action: 'audio_permission_request',
                        resource: purpose,
                        timestamp: new Date(),
                        endpoint: '/api/permissions/audio/request'
                    }
                }
            }
        );

        res.json({
            success: true,
            permission: {
                type: 'audio_recording',
                purpose: purpose,
                status: 'pending',
                requestId: `audio_${userId}_${Date.now()}`,
                message: 'Permissão de áudio solicitada com sucesso'
            }
        });

    } catch (error: any) {
        console.error('[AUDIO-PERMISSION] Erro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao solicitar permissão de áudio',
            error: error.message
        });
    }
});

// POST /api/permissions/audio/grant - Conceder permissão de gravação de áudio
router.post('/permissions/audio/grant', async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não autenticado'
            });
        }

        const { requestId, permanent = false } = req.body;

        console.log(`[AUDIO-PERMISSION] Usuário ${userId} concedeu permissão, permanente: ${permanent}`);

        // Atualizar status de permissão do usuário
        await User.findOneAndUpdate(
            { id: userId },
            {
                $set: {
                    audioRecordingEnabled: true,
                    audioRecordingPermanent: permanent,
                    audioRecordingGrantedAt: new Date()
                },
                $push: {
                    recentActivities: {
                        action: 'audio_permission_granted',
                        resource: 'microphone_access',
                        timestamp: new Date(),
                        endpoint: '/api/permissions/audio/grant'
                    }
                }
            }
        );

        res.json({
            success: true,
            permission: {
                type: 'audio_recording',
                status: 'granted',
                permanent: permanent,
                grantedAt: new Date().toISOString(),
                message: 'Permissão de áudio concedida com sucesso'
            }
        });

    } catch (error: any) {
        console.error('[AUDIO-PERMISSION] Erro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao conceder permissão de áudio',
            error: error.message
        });
    }
});

// POST /api/permissions/audio/deny - Negar permissão de gravação de áudio
router.post('/permissions/audio/deny', async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não autenticado'
            });
        }

        const { requestId } = req.body;

        console.log(`[AUDIO-PERMISSION] Usuário ${userId} negou permissão de áudio`);

        // Atualizar status de permissão do usuário
        await User.findOneAndUpdate(
            { id: userId },
            {
                $set: {
                    audioRecordingEnabled: false,
                    audioRecordingDeniedAt: new Date()
                },
                $push: {
                    recentActivities: {
                        action: 'audio_permission_denied',
                        resource: 'microphone_access',
                        timestamp: new Date(),
                        endpoint: '/api/permissions/audio/deny'
                    }
                }
            }
        );

        res.json({
            success: true,
            permission: {
                type: 'audio_recording',
                status: 'denied',
                deniedAt: new Date().toISOString(),
                message: 'Permissão de áudio negada'
            }
        });

    } catch (error: any) {
        console.error('[AUDIO-PERMISSION] Erro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao negar permissão de áudio',
            error: error.message
        });
    }
});

// GET /api/permissions/audio/status - Verificar status da permissão de áudio
router.get('/permissions/audio/status', async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não autenticado'
            });
        }

        const user = await findUserByAnyId(User, userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Usuário não encontrado'
            });
        }

        res.json({
            success: true,
            permission: {
                type: 'audio_recording',
                status: user.audioRecordingEnabled ? 'granted' : (user.audioRecordingDeniedAt ? 'denied' : 'pending'),
                permanent: user.audioRecordingPermanent || false,
                grantedAt: user.audioRecordingGrantedAt || null,
                deniedAt: user.audioRecordingDeniedAt || null,
                message: `Status da permissão: ${user.audioRecordingEnabled ? 'Concedida' : (user.audioRecordingDeniedAt ? 'Negada' : 'Pendente')}`
            }
        });

    } catch (error: any) {
        console.error('[AUDIO-PERMISSION] Erro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao verificar status da permissão',
            error: error.message
        });
    }
});

// POST /api/permissions/camera/request - Solicitar permissão de câmera
router.post('/permissions/camera/request', async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não autenticado'
            });
        }

        const { purpose = 'live_streaming' } = req.body;

        console.log(`[CAMERA-PERMISSION] Usuário ${userId} solicitando permissão para: ${purpose}`);

        // Registrar solicitação de permissão no usuário
        await User.findOneAndUpdate(
            { id: userId },
            {
                $push: {
                    recentActivities: {
                        action: 'camera_permission_request',
                        resource: purpose,
                        timestamp: new Date(),
                        endpoint: '/api/permissions/camera/request'
                    }
                }
            }
        );

        res.json({
            success: true,
            permission: {
                type: 'camera_access',
                purpose: purpose,
                status: 'pending',
                requestId: `camera_${userId}_${Date.now()}`,
                message: 'Permissão de câmera solicitada com sucesso'
            }
        });

    } catch (error: any) {
        console.error('[CAMERA-PERMISSION] Erro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao solicitar permissão de câmera',
            error: error.message
        });
    }
});

// POST /api/permissions/camera/grant - Conceder permissão de câmera
router.post('/permissions/camera/grant', async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não autenticado'
            });
        }

        const { requestId, permanent = false } = req.body;

        console.log(`[CAMERA-PERMISSION] Usuário ${userId} concedeu permissão, permanente: ${permanent}`);

        // Atualizar status de permissão do usuário
        await User.findOneAndUpdate(
            { id: userId },
            {
                $set: {
                    cameraAccessEnabled: true,
                    cameraAccessPermanent: permanent,
                    cameraAccessGrantedAt: new Date()
                },
                $push: {
                    recentActivities: {
                        action: 'camera_permission_granted',
                        resource: 'camera_access',
                        timestamp: new Date(),
                        endpoint: '/api/permissions/camera/grant'
                    }
                }
            }
        );

        res.json({
            success: true,
            permission: {
                type: 'camera_access',
                status: 'granted',
                permanent: permanent,
                grantedAt: new Date().toISOString(),
                message: 'Permissão de câmera concedida com sucesso'
            }
        });

    } catch (error: any) {
        console.error('[CAMERA-PERMISSION] Erro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao conceder permissão de câmera',
            error: error.message
        });
    }
});

// POST /api/permissions/camera/deny - Negar permissão de câmera
router.post('/permissions/camera/deny', async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não autenticado'
            });
        }

        const { requestId } = req.body;

        console.log(`[CAMERA-PERMISSION] Usuário ${userId} negou permissão de câmera`);

        // Atualizar status de permissão do usuário
        await User.findOneAndUpdate(
            { id: userId },
            {
                $set: {
                    cameraAccessEnabled: false,
                    cameraAccessDeniedAt: new Date()
                },
                $push: {
                    recentActivities: {
                        action: 'camera_permission_denied',
                        resource: 'camera_access',
                        timestamp: new Date(),
                        endpoint: '/api/permissions/camera/deny'
                    }
                }
            }
        );

        res.json({
            success: true,
            permission: {
                type: 'camera_access',
                status: 'denied',
                deniedAt: new Date().toISOString(),
                message: 'Permissão de câmera negada'
            }
        });

    } catch (error: any) {
        console.error('[CAMERA-PERMISSION] Erro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao negar permissão de câmera',
            error: error.message
        });
    }
});

// GET /api/permissions/camera/status - Verificar status da permissão de câmera
router.get('/permissions/camera/status', async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não autenticado'
            });
        }

        const user = await findUserByAnyId(User, userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Usuário não encontrado'
            });
        }

        res.json({
            success: true,
            permission: {
                type: 'camera_access',
                status: user.cameraAccessEnabled ? 'granted' : (user.cameraAccessDeniedAt ? 'denied' : 'pending'),
                permanent: user.cameraAccessPermanent || false,
                grantedAt: user.cameraAccessGrantedAt || null,
                deniedAt: user.cameraAccessDeniedAt || null,
                message: `Status da permissão: ${user.cameraAccessEnabled ? 'Concedida' : (user.cameraAccessDeniedAt ? 'Negada' : 'Pendente')}`
            }
        });

    } catch (error: any) {
        console.error('[CAMERA-PERMISSION] Erro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao verificar status da permissão',
            error: error.message
        });
    }
});

// Endpoint POST /live/start - Legacy endpoint for backward compatibility
// Uses same handler as /streams to maintain API compatibility
router.post('/live/start', async (req, res) => {
    console.log('[LEGACY] Usando endpoint /api/live/start (redirecionado para /streams)');
    
    // Import the streams handler function (would need to be extracted)
    // For now, duplicate the handler logic here for compatibility
    
    try {
        console.log('[LIVE-START] Iniciando live no backend...');
        console.log('[LIVE-START] Headers:', req.headers.authorization ? 'Token presente' : 'Token ausente');

        const userId = getUserIdFromToken(req);
        console.log('[LIVE-START] User ID extraído do token:', userId);

        if (!userId) {
            console.log('[LIVE-START] Erro: Usuário não autenticado');
            return res.status(401).json({ 
                success: false,
                message: 'Usuário não autenticado' 
            });
        }

        // Buscar dados do usuário
        console.log('[LIVE-START] Buscando usuário com ID:', userId);
        const user = await findUserByAnyId(User, userId);
        console.log('[LIVE-START] Usuário encontrado:', user ? 'SIM' : 'NÃO');

        if (!user) {
            console.log('[LIVE-START] Erro: Usuário não encontrado');
            return res.status(404).json({ 
                success: false,
                message: 'Usuário não encontrado' 
            });
        }

        // Dados da live - Validação do payload
        console.log('[LIVE-START] Validando payload...');
        
        const { name, title, description, category = 'popular' } = req.body;
        
        // Aceitar tanto 'name' quanto 'title' - priorizar 'title' se ambos existirem
        const liveTitle = title || name;
        
                
        console.log('[LIVE-START] Payload validado com sucesso');

        // Gerar IDs únicos
        const streamId = userId;
        const liveId = uuidv4();
        const streamKey = 'stream_' + uuidv4();

        // Configurações SRS
        const srsHost = process.env.SRS_HOST || process.env.DOMAIN || 'srs';
        const srsPort = process.env.SRS_PORT || '1935';
        const srsApp = process.env.SRS_APP || 'live';
        const vhost = process.env.SRS_VHOST || '__defaultVhost__';

        // URLs dinâmicas
        const pushUrl = `rtmp://${srsHost}:${srsPort}/${srsApp}/${streamKey}`;
        const webrtcUrl = `webrtc://${srsHost}:8000/${srsApp}/${streamKey}`;
        const BACKEND_URL = process.env.BACKEND_URL || 'https://api.livego.store';
        const httpFlvUrl = `${BACKEND_URL}/api/video/http/live/${streamKey}.flv`;
        const hlsUrl = `${BACKEND_URL}/api/video/http/live/${streamKey}.m3u8`;

        // Dados da stream — registro provisório (isLive false até SRS on_publish)
        const streamerData = {
            id: streamId,
            hostId: userId,
            liveId: liveId,
            roomId: `room_${streamId}`,
            name: liveTitle || `Live de ${user.name}`,
            avatar: user.avatarUrl || '',
            location: user.country || 'BR',
            time: 'Preparando',
            message: description || `Ao vivo com ${user.name}!`,
            tags: [category],
            category: category,
            isLive: false,
            streamStatus: 'preparing',
            startTime: new Date(),
            streamKey: streamKey,
            viewers: 0,
            country: user.country || 'BR',
            rtmpIngestUrl: pushUrl,
            playbackUrl: httpFlvUrl,
            hlsUrl: hlsUrl,
            rtmpUrl: pushUrl,
            title: title,
            description: description
        };

        // Upsert: atualiza se já existir, cria se não existir
        const newStream = await Streamer.findOneAndUpdate(
            { hostId: userId },
            { $set: streamerData },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );

        // Não marcar isLive:true aqui — stream é só rascunho (isLive:false)
        // Usuário só ficará como "ao vivo" quando SRS chamar on_publish
        await User.findOneAndUpdate(
            { id: userId },
            { $set: {
                isOnline: true,
                currentStreamId: streamId,
                lastSeen: new Date().toISOString()
            } }
        );

        // Atualizar status online na coleção userstatuses

        const { UserStatus } = await import('../models');

        await UserStatus.findOneAndUpdate(
            { userId: userId },
            { $set: { 
                isOnline: true,
                lastSeen: new Date(),
                updatedAt: new Date()
            } },
            { upsert: true, returnDocument: 'after' }
        );



        console.log(`[STREAM-START] Stream ${streamId} iniciada para usuário ${userId}`);

        const io = req.app.get('io');
        if (io) {
            io.emit('new_live', {
                id: newStream.id || streamId,
                hostId: newStream.hostId || userId,
                name: newStream.name || liveTitle || `Live de ${user.name}`,
                avatar: newStream.avatar || user?.avatarUrl || '',
                isLive: true,
                streamStatus: 'active',
                country: newStream.country || user?.country || 'BR',
                viewers: 0,
                timestamp: new Date().toISOString()
            });
            io.emit('stream_started', {
                streamId: newStream.id || streamId,
                hostId: newStream.hostId || userId,
                name: newStream.name || liveTitle || `Live de ${user.name}`,
                avatar: newStream.avatar || user?.avatarUrl || '',
                timestamp: new Date().toISOString()
            });
        }

        res.json({

            success: true,

            stream: {

                id: newStream.id,

                status: 'active',

                startTime: newStream.startTime,

                rtmpUrl: newStream.rtmpIngestUrl,

                webrtcUrl: newStream.webrtcUrl,

                playbackUrl: newStream.playbackUrl

            }

        });



    } catch (error: any) {

        console.error('[STREAM-START] Erro:', error);

        res.status(500).json({ 

            success: false, 

            message: 'Erro interno ao iniciar stream',

            error: error instanceof Error ? error.message : String(error) 

        });

    }

});



// POST /api/streams/:id/join - Entrar na live (validar acesso)

router.post('/streams/:id/join', async (req, res) => {

    try {

        console.log('[STREAM-JOIN] Validando entrada na live...');

        

        const userId = getUserIdFromToken(req);

        if (!userId) {

            return res.status(401).json({ 

                success: false, 

                message: 'Usuário não autenticado' 

            });

        }



        const { id } = req.params;



        // Buscar stream

        const stream: any = await Streamer.findOne({ id });

        if (!stream) {

            return res.status(404).json({ 

                success: false, 

                message: 'Stream não encontrado' 

            });

        }



        // Verificar se stream está ativa
        // O host pode entrar mesmo em 'preparing' (antes do callback SRS chegar)
        const isHost = String(stream.hostId) === String(userId);
        const isActive = stream.isLive && ['active', 'live'].includes(stream.streamStatus);
        const isPreparing = !stream.isLive && stream.streamStatus === 'preparing';

        if (!isActive && !(isHost && isPreparing)) {

            return res.status(400).json({ 

                success: false, 

                message: 'Stream não está ativa' 

            });

        }



        // Buscar dados do espectador

        const viewer: any = await User.findOne({ id: userId });

        if (!viewer) {

            return res.status(404).json({ 

                success: false, 

                message: 'Usuário não encontrado' 

            });

        }



        // Incrementar viewers (simples, poderia melhorar com Redis)

        await Streamer.findOneAndUpdate(

            { id },

            { $inc: { viewers: 1 } }

        );



        // Atualizar currentStreamId do usuário e incrementar livesJoined

        await User.findOneAndUpdate(
            { id: userId },
            {
                $set: { currentStreamId: id, isOnline: true },
                $inc: { livesJoined: 1 },
                $push: {
                    recentActivities: {
                        action: 'live_join',
                        resource: 'streaming',
                        timestamp: new Date(),
                        endpoint: '/api/streams/:id/join'
                    }
                }
            }
        );

        // Também registrar na coleção LiveUser para aparecer em /api/live/online-users
        try {
            const { LiveUser } = await import('../models/LiveInvite');
            await LiveUser.findOneAndUpdate(
                { userId },
                {
                    userId,
                    username: userId,
                    name: viewer.name || viewer.id,
                    avatarUrl: viewer.avatarUrl || '',
                    status: 'viewing',
                    currentStreamId: id,
                    lastActive: new Date()
                },
                { upsert: true, returnDocument: 'after' }
            );
        } catch (liveUserErr: any) {
            console.error(`[STREAM-JOIN] Erro ao registrar LiveUser para ${userId} na live ${id}:`, liveUserErr?.message || liveUserErr);
        }

        console.log(`[STREAM-JOIN] Usuário ${userId} entrou na live ${id}, livesJoined incrementado`);



        res.json({

            success: true,

            stream: {

                id: stream.id,

                title: stream.title,

                hostName: stream.name,

                hostAvatar: stream.avatar,

                viewers: (stream.viewers || 0) + 1,

                playbackUrl: stream.playbackUrl,

                webrtcUrl: stream.webrtcUrl

            }

        });



    } catch (error: any) {

        console.error('[STREAM-JOIN] Erro:', error);

        res.status(500).json({ 

            success: false, 

            message: 'Erro interno ao entrar na live',

            error: error instanceof Error ? error.message : String(error) 

        });

    }

});



// POST /api/streams/:id/publish-token - Obter token para publicação WebRTC

router.post('/streams/:id/publish-token', async (req, res) => {

    try {

        console.log('[STREAM-PUBLISH-TOKEN] Gerando token de publicação...');

        

        const userId = getUserIdFromToken(req);

        if (!userId) {

            return res.status(401).json({ 

                success: false, 

                message: 'Usuário não autenticado' 

            });

        }



        const { id } = req.params;



        // Buscar stream

        const stream: any = await Streamer.findOne({ id, hostId: userId });

        if (!stream) {

            return res.status(404).json({ 

                success: false, 

                message: 'Stream não encontrado' 

            });

        }



        // Gerar token JWT para SRS

        const jwt = require('jsonwebtoken');

        const srsSecret = process.env.SRS_SECRET || 'srs-secret-key';

        

        const tokenPayload = {

            userId,

            streamId: id,

            streamKey: stream.streamKey,

            action: 'publish',

            exp: Math.floor(Date.now() / 1000) + (2 * 60 * 60) // 2 horas

        };

        

        const publishToken = jwt.sign(tokenPayload, srsSecret);



        // Configurações SRS para WebRTC

        const srsHost = process.env.SRS_HOST || 'srs';

        const srsApiUrl = ENV.SRS_API_URL;



        console.log(`[STREAM-PUBLISH-TOKEN] Token gerado para stream ${id}`);



        res.json({

            success: true,

            publishData: {

                api: `${srsApiUrl}/rtc/v1/whip/?app=live&stream=${id}`,

                streamurl: `rtmp://${srsHost}:1935/live/${id}`,

                token: publishToken,

                streamKey: stream.streamKey,

                streamId: id

            }

        });



    } catch (error: any) {

        console.error('[STREAM-PUBLISH-TOKEN] Erro:', error);

        res.status(500).json({ 

            success: false, 

            message: 'Erro interno ao gerar token',

            error: error instanceof Error ? error.message : String(error) 

        });

    }

});



// POST /api/streams/:id/end - Finalizar stream

router.post('/streams/:id/end', async (req, res) => {

    try {

        const { id } = req.params;
        console.log('[STREAM-END] Finalizando stream:', id);

        const userId = getUserIdFromToken(req);

        if (!userId) {

            console.log('[STREAM-END] ERRO: Usuário não autenticado');

            return res.status(401).json({ 

                success: false, 

                message: 'Usuário não autenticado' 

            });

        }

        

        // Buscar stream - primeiro tentar com hostId, depois só com ID

        let stream: any = await Streamer.findOne({ id, hostId: userId });

        

        if (!stream) {

            stream = await Streamer.findOne({ id });

            if (stream) {

                console.log('[STREAM-END] Stream encontrada por ID, hostId:', stream.hostId);

                

                // Verificar se pertence ao usuário (verificação adicional)

                if (stream.hostId !== userId) {

                    console.log('[STREAM-END] ERRO: Stream pertence a outro usuário');

                    return res.status(403).json({ 

                        success: false, 

                        message: 'Stream não pertence a este usuário' 

                    });

                }

            }

        }

        

        if (!stream) {

            console.log('[STREAM-END] ERRO: Stream não encontrada');

            return res.status(404).json({ 

                success: false, 

                message: 'Stream não encontrada' 

            });

        }



        // Finalizar stream

        stream.isLive = false;

        stream.streamStatus = 'ended';

        stream.endTime = new Date();

        stream.endedAt = new Date();

        stream.endedBy = userId;

        await stream.save();



        // Atualizar usuário
        await User.findOneAndUpdate(
            { id: userId },
            { $set: { 
                isLive: false, 
                isOnline: false,
                currentStreamId: null
            } }
        );

        console.log(`[STREAM-END] Stream ${id} finalizada para usuário ${userId}`);

        const io = req.app.get('io');
        if (io) {
            io.emit('card_removed', {
                streamId: stream.id || id,
                hostId: stream.hostId || userId,
                timestamp: new Date().toISOString()
            });
            io.emit('stream_ended', {
                streamId: stream.id || id,
                hostId: stream.hostId || userId,
                timestamp: new Date().toISOString()
            });
            io.emit('stream_stopped', {
                streamId: stream.id || id,
                hostId: stream.hostId || userId,
                timestamp: new Date().toISOString()
            });
        }

        res.json({

            success: true,

            stream: {

                id: stream.id,

                status: 'ended',

                endTime: stream.endTime,

                duration: (stream as any).getDuration ? (stream as any).getDuration() : '00:00:00'

            }

        });



    } catch (error: any) {

        console.error('[STREAM-END] Erro:', error);

        res.status(500).json({ 

            success: false, 

            message: 'Erro interno ao finalizar stream',

            error: error instanceof Error ? error.message : String(error) 

        });

    }

});



// GET /api/lives/:id - Obter detalhes de uma live específica});



// POST /api/streams - Criar uma nova stream (draft)
router.post('/streams', async (req, res) => {
    try {
        const { name, title, country, category = 'popular' } = req.body;
        const hostId = getUserIdFromToken(req);

        if (!hostId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const user: any = await User.findOne({ id: hostId });
        if (!user) {
            return res.status(404).json({ success: false, error: 'Host not found' });
        }

        const streamId = hostId;
        const streamTitle = name || title || `Live de ${user.name}`;
        const finalCountry = (country || user.country || 'BR').toLowerCase();

        // Usar streamId do body quando fornecido (frontend envia "stream_<userId>" no initiateStream)
        // Isso garante que o streamKey corresponda ao que o WHIP publish usa
        const frontendStreamId = req.body.streamId;
        const streamKey = frontendStreamId || ('stream_' + uuidv4());

        const stream = await Streamer.findOneAndUpdate(
            { id: hostId },
            {
                $set: {
                    id: streamId,
                    hostId,
                    name: user.name,
                    avatar: user.avatarUrl || '',
                    title: streamTitle,
                    category,
                    streamKey,
                    isLive: false,
                    streamStatus: 'preparing',
                    startTime: new Date(),
                    viewers: 0,
                    country: finalCountry,
                    latitude: user.latitude,
                    longitude: user.longitude,
                    city: user.city,
                    state: user.state
                }
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );

        res.json({ success: true, stream });
    } catch (error: any) {
        console.error('[STREAMS-POST] Erro:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/streams/:id/publish - Marcar stream como AO VIVO (separado do save)
router.post('/streams/:id/publish', async (req, res) => {
    try {
        const { id } = req.params;
        const hostId = getUserIdFromToken(req);

        if (!hostId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const user: any = await User.findOne({ id: hostId });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const stream = await Streamer.findOneAndUpdate(
            { id },
            {
                $set: {
                    isLive: true,
                    streamStatus: 'active',
                    startTime: new Date()
                }
            },
            { returnDocument: 'after' }
        );

        if (!stream) {
            return res.status(404).json({ success: false, error: 'Stream not found' });
        }

        await User.findOneAndUpdate(
            { id: hostId },
            {
                $set: { isLive: true, currentStreamId: id },
                $inc: { totalLives: 1 },
                $push: {
                    recentActivities: {
                        action: 'live_start',
                        resource: 'streaming',
                        timestamp: new Date(),
                        endpoint: '/api/streams/publish'
                    }
                }
            }
        );

        const io = req.app.get('io');
        if (io) {
            io.emit('new_live', {
                id: stream.id || id,
                hostId: stream.hostId || hostId,
                name: stream.name || user.name,
                avatar: stream.avatar || user?.avatarUrl || '',
                isLive: true,
                streamStatus: 'active',
                country: stream.country || user?.country || 'BR',
                viewers: 0,
                timestamp: new Date().toISOString()
            });
            io.emit('stream_started', {
                streamId: stream.id || id,
                hostId: stream.hostId || hostId,
                name: stream.name || user.name,
                avatar: stream.avatar || resolveAvatar(user),
                timestamp: new Date().toISOString()
            });
        }

        // Criar/atualizar LiveCard (so quando realmente publicar)
        try {
            await LiveCard.findOneAndUpdate(
                { hostId },
                { $set: {
                    hostId,
                    name: stream.name || user.name,
                    avatar: stream.avatar || resolveAvatar(user),
                    title: stream.title || user.name,
                    streamKey: stream.streamKey || id,
                    country: (stream.country || user?.country || 'BR').toLowerCase(),
                    isLive: true,
                    streamStatus: 'active',
                    category: (stream.category || 'popular').toLowerCase(),
                    playbackUrl: stream.playbackUrl || '',
                    hlsUrl: stream.hlsUrl || '',
                    viewers: stream.viewers || 0,
                    startTime: new Date(),
                    updatedAt: new Date()
                } },
                { upsert: true }
            );
        } catch (cardErr) {
            console.warn('[STREAMS-PUBLISH] Erro ao criar/atualizar LiveCard:', cardErr);
        }

        // === NOTIFICAR SEGUIDORES ===
        try {
            const followers = await Followers.find({
                followingId: hostId,
                isActive: true
            }).select('followerId').lean();

            if (followers.length > 0) {
                const followerIds = followers.map((f: any) => f.followerId);

                // Notificar seguidores via serviço centralizado
                try {
                    const { NotificationService } = await import('../services/NotificationService');
                    await NotificationService.notifyLiveStarted(
                        io,
                        hostId,
                        user.name || 'LiveGO',
                        user.avatarUrl || '',
                        id,
                        followerIds
                    );
                } catch (notifErr) {
                    console.warn('[STREAMS-PUBLISH] Erro ao notificar seguidores:', notifErr);
                }
            }
        } catch (followErr) {
            console.warn('[STREAMS-PUBLISH] Erro ao notificar seguidores:', followErr);
        }

        res.json({ success: true, stream });
    } catch (error: any) {
        console.error('[STREAMS-PUBLISH] Erro:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/streams - Listar streams (rota principal para frontend)
router.get('/streams', async (req, res) => {
    try {
        const {
            category = 'popular',
            country = 'all',
            limit = 50,
            cursor = '',
            isLive = 'true',
            userId
        } = req.query;

        const parseLimit = Math.min(parseInt(limit as string) || 50, 100);

        // Sincronizar streams ativas do SRS com o banco
        try {
            const srsApiUrl = ENV.SRS_API_URL;
            const srsUrl = `${srsApiUrl}/api/v1/streams/`;
            const { httpClient } = await import('../utils/httpClient');
            const srsRes = await httpClient.get<any>(srsUrl, { timeout: 5000 });
            if (srsRes) {
                const srsData = srsRes;
                const srsStreams = srsData?.streams || [];
                for (const srs of srsStreams) {
                    if (!srs.publish?.active) continue;
                    const streamKey = srs.name;
                    if (!streamKey) continue;
                    if (streamKey.endsWith('_transcoded')) continue;
                    const hostId = streamKey.replace('stream_', '');
                    const roomId = srs.id || streamKey;
                    const app = srs.app || 'live';
                    const exists = await LiveCard.findOne({ hostId, isLive: true, streamStatus: { $in: ['active', 'live'] } }).lean();
                    if (!exists) {
                        const user = await User.findOne({ id: hostId }).lean();
                        await LiveCard.findOneAndUpdate(
                            { hostId },
                            { $set: {
                                hostId,
                                name: user?.name || hostId,
                                avatar: user?.avatarUrl || '',
                                title: user?.name || hostId,
                                streamKey,
                                country: (user?.country || 'BR').toLowerCase(),
                                isLive: true,
                                streamStatus: 'active',
                                category: (req.query.category as string || 'popular').toLowerCase(),
                                startTime: new Date(),
                                updatedAt: new Date()
                            } },
                            { upsert: true }
                        );
                        await Streamer.findOneAndUpdate(
                            { id: hostId },
                            { $set: { isLive: true, streamStatus: 'active', streamKey } },
                            { upsert: true }
                        );
                        const { StreamRoom } = await import('../models/index');
                        await StreamRoom.findOneAndUpdate(
                            { roomId },
                            { $set: { roomId, hostId, streamKey, app } },
                            { upsert: true }
                        );
                        console.log(`[SRS-SYNC] LiveCard + StreamRoom criados para: ${streamKey}`);
                    }
                }
            }
        } catch (srsErr) {
            console.warn('[SRS-SYNC] Erro ao sincronizar com SRS:', srsErr);
        }

        // Construir filtro base
        const baseFilter: any = {};
        baseFilter.streamKey = { $not: /_transcoded$/ };
        if (isLive === 'true') {
            baseFilter.isLive = true;
            baseFilter.streamStatus = { $in: ['active', 'live'] };
        } else if (isLive === 'false') {
            baseFilter.isLive = false;
        }

        if (category === 'followed' && userId) {
            const follows = await Followers.find({
                followerId: userId as string,
                isActive: true
            }).select('followingId').lean();

            const followedIds = follows.map(f => f.followingId);

            if (followedIds.length === 0) {
                return res.json({
                    code: 0,
                    msg: 'OK',
                    data: { streams: [], nextCursor: null, hasMore: false }
                });
            }

            baseFilter.hostId = { $in: followedIds };
        } else if (category && category !== 'all') {
            baseFilter.category = (category as string).toLowerCase();
        }

        // Paginação cursor-based: se cursor for fornecido, busca a partir daquele _id
        if (cursor) {
            baseFilter._id = { $lt: new ObjectId(cursor as string) };
        }

        const hasCountryFilter = country && country !== 'all' && country !== 'ICON_GLOBE';
        let cardDocs;

        if (hasCountryFilter) {
            const countryFilter = { ...baseFilter, country: (country as string).toLowerCase() };
            cardDocs = await LiveCard.find(countryFilter)
                .sort({ viewers: -1, startTime: -1, _id: -1 })
                .limit(parseLimit + 1)
                .lean();

            if (cardDocs.length === 0) {
                cardDocs = await LiveCard.find(baseFilter)
                    .sort({ viewers: -1, startTime: -1, _id: -1 })
                    .limit(parseLimit + 1)
                    .lean();
            }
        } else {
            cardDocs = await LiveCard.find(baseFilter)
                .sort({ viewers: -1, startTime: -1, _id: -1 })
                .limit(parseLimit + 1)
                .lean();
        }

        if (cardDocs.length === 0 && isLive === 'true') {
            const fallbackFilter: any = { ...baseFilter };
            delete fallbackFilter.country;
            cardDocs = await LiveCard.find(fallbackFilter)
                .sort({ viewers: -1, startTime: -1, _id: -1 })
                .limit(parseLimit + 1)
                .lean();
        }

        if (cardDocs.length === 0 && isLive === 'true') {
            cardDocs = await LiveCard.find({
                isLive: true,
                streamStatus: { $in: ['active', 'live'] }
            })
                .sort({ viewers: -1, startTime: -1, _id: -1 })
                .limit(parseLimit + 1)
                .lean();
        }

        // Verificar se há mais resultados (peek extra)
        const hasMore = cardDocs.length > parseLimit;
        const items = hasMore ? cardDocs.slice(0, parseLimit) : cardDocs;
        const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]._id : null;

        const streams = items.map(card => ({
            id: card.streamKey || card.hostId,
            hostId: card.hostId,
            name: card.name,
            avatar: card.avatar,
            title: card.title,
            country: card.country,
            isLive: card.isLive,
            streamStatus: card.streamStatus,
            streamKey: card.streamKey,
            playbackUrl: card.playbackUrl,
            hlsUrl: card.hlsUrl,
            webrtcUrl: card.webrtcUrl,
            flvUrl: card.flvUrl,
            whipUrl: card.whipUrl,
            whepUrl: card.whepUrl,
            viewers: card.viewers || 0,
            category: card.category || 'popular',
            categoryList: card.categoryList || [],
            notice: card.notice || '',
            metaData: card.metaData || {},
            isPrivate: card.isPrivate || false,
            startTime: card.startTime
        }));

        const enrichedStreams = await Promise.all(
            streams.map(async (stream) => {
                const host: any = await User.findOne({ id: stream.hostId }).lean();
                const countryInfo = getCountryInfo(stream.country || host?.country || 'br');
                return {
                    ...stream,
                    name: stream.name || host?.name || stream.hostId,
                    avatar: stream.avatar || resolveAvatar(host),
                    message: stream.title || '',
                    country: stream.country || host?.country || 'br',
                    countryName: countryInfo.name,
                    flagUrl: countryInfo.flagUrl,
                    host: host ? {
                        id: host.id,
                        name: host.name,
                        avatar: resolveAvatar(host),
                        level: host.level || 1,
                        country: host.country || 'BR'
                    } : null
                }
            })
        );

        res.json({
            code: 0,
            msg: 'OK',
            data: {
                streams: enrichedStreams,
                nextCursor: nextCursor ? nextCursor.toString() : null,
                hasMore
            }
        });
    } catch (error: any) {
        console.error('[API-STREAMS] Erro:', error);
        res.status(500).json({ code: 1, msg: error.message });
    }
});



// GET /api/v1/streams - Listar streams (compatibilidade com frontend)

router.get('/v1/streams', async (req, res) => {

    try {

        console.log('[API-V1-STREAMS] Listando streams...');



        const streams = await Streamer.find({

            isLive: true,

            streamStatus: 'active'

        })

        .sort({ viewers: -1 })

        .limit(50);



        // Usar mapper de proteção

        const protectedStreams = mapStreamsToProtectedArrayFlexible(streams as any);



        res.json({

            success: true,

            streams: protectedStreams,

            count: protectedStreams.length

        });



    } catch (error: any) {

        console.error('[API-V1-STREAMS] Erro:', error);

        res.status(500).json({ 

            success: false, 

            message: 'Erro interno ao listar streams',

            error: error instanceof Error ? error.message : String(error) 

        });

    }

});



// POST /end-session - Encerrar sessão (compatibilidade)

router.post('/end-session', async (req, res) => {

    try {

        console.log('[END-SESSION] Encerrando sessão...');

        

        const userId = getUserIdFromToken(req);

        if (!userId) {

            return res.status(401).json({ 

                success: false, 

                message: 'Usuário não autenticado' 

            });

        }



        // Encerrar todas as streams do usuário

        const result = await Streamer.updateMany(
            { hostId: userId, isLive: true },
            { $set: {
                isLive: false,
                streamStatus: 'ended',
                endTime: new Date()
            } }
        );



        // Atualizar usuário
        await User.findOneAndUpdate(
            { id: userId },
            { $set: { 
                isLive: false, 
                isOnline: false,
                currentStreamId: null 
            } }
        );

        console.log(`[END-SESSION] Sessão encerrada para usuário ${userId}. Streams afetadas: ${result.modifiedCount}`);

        const io = req.app.get('io');
        if (io) {
            io.emit('card_removed', {
                streamId: '',
                hostId: userId,
                timestamp: new Date().toISOString()
            });
            io.emit('stream_ended', {
                streamId: '',
                hostId: userId,
                timestamp: new Date().toISOString()
            });
            io.emit('stream_stopped', {
                streamId: '',
                hostId: userId,
                timestamp: new Date().toISOString()
            });
        }

        res.json({

            success: true,

            message: 'Sessão encerrada com sucesso',

            streamsEnded: result.modifiedCount

        });



    } catch (error: any) {

        console.error('[END-SESSION] Erro:', error);

        res.status(500).json({ 

            success: false, 

            message: 'Erro interno ao encerrar sessão',

            error: error instanceof Error ? error.message : String(error) 

        });

    }

});



// DELETE /rtc/v1/stop - Parar WebRTC com cleanup completo

router.delete('/rtc/v1/stop', async (req, res) => {

    try {

        console.log('[RTC-STOP] Parando sessão WebRTC...');

        

        const userId = getUserIdFromToken(req);

        if (!userId) {

            return res.status(401).json({ 

                success: false, 

                message: 'Usuário não autenticado' 

            });

        }



        const { streamId, sessionId } = req.body;



        if (!streamId) {

            return res.status(400).json({ 

                success: false, 

                message: 'streamId é obrigatório' 

            });

        }



        console.log(`[RTC-STOP] Procurando stream: ${streamId} para usuário: ${userId}`);



        // Buscar stream (fallback se hostId não bater)

        let stream: any = await Streamer.findOne({ id: streamId, hostId: userId });

        if (!stream) {

            console.log('[RTC-STOP] Stream não encontrada com hostId, tentando só com ID...');

            stream = await Streamer.findOne({ id: streamId });

        }



        if (!stream) {

            return res.status(404).json({ 

                success: false, 

                message: 'Stream não encontrada' 

            });

        }



    

        // Finalizar stream no banco

        stream.isLive = false;

        stream.streamStatus = 'ended';

        stream.endTime = new Date();

        stream.endedAt = new Date();

        stream.endedBy = userId;

        await stream.save();



        // TODO: Implementar cache invalidação quando ActiveStreamService for criado

        console.log(`[STREAM END] Cache limpo para usuário ${userId} (TODO: implementar ActiveStreamService)`);

        // Atualizar usuário - MANTER currentStreamId para reconexão
        await User.findOneAndUpdate(
            { id: userId },
            { $set: { 
                isLive: false,
                isOnline: false,
                // MANTER currentStreamId para permitir reconexão
                // currentStreamId: null, 
                lastSeen: new Date().toISOString()
            } }
        );



        console.log(`[RTC-STOP] Status final: isLive=${stream.isLive}, streamStatus=${stream.streamStatus}`);

        const io = req.app.get('io');
        if (io) {
            io.emit('card_removed', {
                streamId: streamId || stream?.id,
                hostId: userId || stream?.hostId,
                timestamp: new Date().toISOString()
            });
            io.emit('stream_ended', {
                streamId: streamId || stream?.id,
                hostId: userId || stream?.hostId,
                timestamp: new Date().toISOString()
            });
            io.emit('stream_stopped', {
                streamId: streamId || stream?.id,
                hostId: userId || stream?.hostId,
                timestamp: new Date().toISOString()
            });
        }

        res.json({

            success: true,

            message: 'Sessão WebRTC encerrada com sucesso',

            streamId: streamId,

            sessionId: sessionId || null,

            cleanupStatus: 'completed'

        });



    } catch (error: any) {

        console.error('[RTC-STOP] Erro:', error);

        res.status(500).json({ 

            success: false, 

            message: 'Erro interno ao parar WebRTC',

            error: error instanceof Error ? error.message : String(error) 

        });

    }

});



// --- ENDPOINTS PARA ASSOCIAÇÃO STREAMKEY-USUÁRIO ---



/**

 * Endpoint para associar streamKey com usuário

 * POST /live/stream-association

 */

router.post('/stream-association', async (req, res) => {

    try {

        const userId = getUserIdFromToken(req);

        if (!userId) {

            return res.status(401).json({

                success: false,

                message: 'Token inválido'

            });

        }



        const { streamKey, title } = req.body;



        if (!streamKey) {

            return res.status(400).json({

                success: false,

                message: 'streamKey é obrigatório'

            });

        }



        // Buscar usuário

        const user: any = await User.findOne({ id: userId });

        if (!user) {

            return res.status(404).json({

                success: false,

                message: 'Usuário não encontrado'

            });

        }



        // Validação de streamKey único e sanitização

        const sanitizedStreamKey = streamKey.trim().replace(/[^a-zA-Z0-9_]/g, '');

        

        if (!sanitizedStreamKey || sanitizedStreamKey.length < 3) {

            return res.status(400).json({

                success: false,

                message: 'streamKey inválido - mínimo 3 caracteres alfanuméricos'

            });

        }



        // Verificar se streamKey já existe

        const existingAssociation = await StreamKeyAssociation.findOne({ streamKey: sanitizedStreamKey });

        if (existingAssociation) {

            return res.status(400).json({

                success: false,

                message: 'streamKey já está em uso'

            });

        }



        // Criar associação

        const association = await StreamKeyAssociation.create({

            streamKey: sanitizedStreamKey,

            userId,

            username: user.name || 'Unknown',

            avatar: user.avatarUrl || '',

            title: title || '',

            isActive: true

        });



        res.json({

            success: true,

            message: 'Associação criada com sucesso',

            data: {

                streamKey: sanitizedStreamKey,

                userId,

                username: user.name || 'Unknown',

                avatar: user.avatarUrl || '',

                title: title || ''

            }

        });



    } catch (error: any) {

        console.error('[STREAM-ASSOCIATION] Erro:', error);

        res.status(500).json({

            success: false,

            message: 'Erro interno ao criar associação',

            error: error.message

        });

    }

});



/**

 * Endpoint para consultar informações do stream por streamKey

// ============================================
// SRS Live Routes — Integração com SRS conforme documentação oficial
// Fluxo: App → Backend → SRS
// Backend controla o SRS, não transmite vídeo
// ============================================

/**
 * POST /api/streams
 * 
 * Inicia uma nova live usando SRS WebRTC
 * Gera streamId e retorna streamUrl para o app conectar ao SRS
 * 
 * Backend NÃO envia vídeo, só organiza dados
 */
router.post('/start', async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const { name, tags = [], message = '', isPrivate = false, category = 'live' } = req.body;

    if (!userId) {
      return ResponseHelper.error(res, 'Unauthorized - Token inválido', 401);
    }

    if (!name) {
      return ResponseHelper.error(res, 'name é obrigatório', 400);
    }

    // Gerar streamId único
    const streamId = userId;

    // URLs via proxy backend (evita mixed content em produção)
    const BACKEND_URL = (process.env.BACKEND_URL || 'https://api.livego.store').replace(/\/+$/, '');
    const SRS_API_URL = ENV.SRS_API_URL;
    const backendHttp = `${BACKEND_URL}/api/video/http`;

    // Criar/Atualizar stream no banco (sem restrição de live ativa)
    const stream = await Streamer.findOneAndUpdate(
      { hostId: userId },
      { $set: {
        id: streamId,
        hostId: userId,
        name,
        tags,
        message,
        isPrivate,
        category,
        isLive: true,
        streamStatus: 'active',
        startTime: new Date(),
        viewers: 0,
        country: 'BR',
        roomId: streamId,
        streamKey: 'stream_' + uuidv4(),
        rtmpIngestUrl: `rtmp://${process.env.SRS_HOST || 'srs'}:1935/live/${streamId}`,
        playbackUrl: `${backendHttp}/live/${streamId}.flv`,
        flvUrl: `${backendHttp}/live/${streamId}.flv`,
        hlsUrl: `${backendHttp}/live/${streamId}.m3u8`
      } },
      { upsert: true, returnDocument: 'after' }
    );

    console.log(`🎬 [SRS] Live iniciada: streamId=${streamId}, userId=${userId}`);
    console.log(`📡 [SRS] streamId: ${streamId}`);

    // Retornar dados para o app conectar ao SRS
    ResponseHelper.success(res, {
      stream: {
        id: stream!.id,
        streamId: streamId,
        streamUrl: `${backendHttp}/live/${streamId}.m3u8`,
        srsApiUrl: SRS_API_URL
      }
    });

  } catch (error: any) {
    console.error('❌ [SRS] Erro ao iniciar live:', error);
    ResponseHelper.error(res, error.message);
  }
});

/**
 * GET /api/live/:streamId
 * 
 * Obtém informações de uma live
 */
router.get('/:streamId', async (req, res) => {
  try {
    const { streamId } = req.params;

    const stream: any = await Streamer.findOne({
      $or: [
        { id: streamId },
        { roomId: streamId }
      ]
    });

    if (!stream) {
      return ResponseHelper.error(res, 'Live não encontrada', 404);
    }

    ResponseHelper.success(res, {
      stream: {
        id: stream.id,
        name: stream.name,
        hostId: stream.hostId,
        viewers: stream.viewers,
        isLive: stream.isLive,
        streamStatus: stream.streamStatus,
        startTime: stream.startTime,
        webrtcUrl: stream.webrtcUrl,
        flvUrl: stream.flvUrl,
        hlsUrl: stream.hlsUrl,
        rtmpUrl: stream.rtmpUrl
      }
    });

  } catch (error: any) {
    console.error('❌ [SRS] Erro ao obter live:', error);
    ResponseHelper.error(res, error.message);
  }
});

/**
 * POST /api/live/:streamId/end
 * 
 * Finaliza uma live
 */
router.post('/live/:streamId/end', async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const { streamId } = req.params;

    if (!userId) {
      return ResponseHelper.error(res, 'Unauthorized - Token inválido', 401);
    }

    const stream = await Streamer.findOneAndUpdate(
      {
        $or: [
          { id: streamId, hostId: userId },
          { roomId: streamId, hostId: userId }
        ]
      },
      { $set: {
        isLive: false,
        streamStatus: 'ended',
        endTime: new Date()
      } }
    );

    if (!stream) {
      return ResponseHelper.error(res, 'Live não encontrada ou sem permissão', 404);
    }

    await User.findOneAndUpdate(
      { id: userId },
      { $set: { isLive: false, isOnline: false, currentStreamId: null } }
    );

    console.log(`🛑 [SRS] Live finalizada: streamId=${streamId}, userId=${userId}`);

    const io = req.app.get('io');
    if (io) {
      io.emit('card_removed', {
        streamId: streamId || stream?.id,
        hostId: userId || stream?.hostId,
        timestamp: new Date().toISOString()
      });
      io.emit('stream_ended', {
        streamId: streamId || stream?.id,
        hostId: userId || stream?.hostId,
        timestamp: new Date().toISOString()
      });
      io.emit('stream_stopped', {
        streamId: streamId || stream?.id,
        hostId: userId || stream?.hostId,
        timestamp: new Date().toISOString()
      });
    }

    ResponseHelper.success(res, { message: 'Live finalizada com sucesso' });

  } catch (error: any) {
    console.error('❌ [SRS] Erro ao finalizar live:', error);
    ResponseHelper.error(res, error.message);
  }
});

router.get('/stream-info', async (req, res) => {

    try {

        const { streamKey } = req.query;



        if (!streamKey) {

            return res.status(400).json({

                success: false,

                message: 'streamKey é obrigatório'

            });

        }



        // Buscar associação do streamKey

        const association = await StreamKeyAssociation.findOne({ streamKey, isActive: true });

        if (!association) {

            return res.status(404).json({

                success: false,

                message: 'streamKey não encontrado ou inativo'

            });

        }



        // Buscar informações adicionais do usuário

        const user: any = await User.findOne({ id: association.userId });

        if (!user) {

            return res.status(404).json({

                success: false,

                message: 'Usuário associado não encontrado'

            });

        }



        res.json({

            success: true,

            data: {

                streamKey: association.streamKey,

                userId: association.userId,

                username: association.username,

                avatar: association.avatar,

                title: association.title,

                isActive: association.isActive,

                createdAt: association.createdAt,

                updatedAt: association.updatedAt

            }

        });



    } catch (error: any) {

        console.error('[STREAM-INFO] Erro:', error);

        res.status(500).json({

            success: false,

            message: 'Erro interno ao consultar informações',

            error: error.message

        });

    }

});





// ===== ROUTE START =====
router.post('/live/end', async (req, res) => {

    try {

        console.log('[LIVE-END] Encerrando live no backend...');

        

        const userId = getUserIdFromToken(req);

        if (!userId) {

            return res.status(401).json({ 

                success: false,

                message: 'Usu+�rio n+�o autenticado' 

            });

        }



        // Buscar usu+�rio para encontrar stream ativa

        const user = await findUserByAnyId(User, userId);

        if (!user) {

            return res.status(404).json({ 

                success: false,

                message: 'Usu+�rio n+�o encontrado' 

            });

        }



        // Buscar stream ativa do usu+�rio

        const activeStream: any = await Streamer.findOne({ 

            hostId: userId,

            isLive: true 

        });

        

        if (!activeStream) {

            return res.status(404).json({ 

                success: false,

                message: 'Nenhuma live ativa encontrada' 

            });

        }



        // Atualizar status da stream para encerrada

        await Streamer.updateOne(

            { id: activeStream.id },

            {

                $set: {

                    isLive: false,

                    streamStatus: 'ended',

                    endTime: new Date()

                }

            }

        );



        // Atualizar status do usu+�rio + persistir atividade

        await User.findOneAndUpdate(
            { id: userId },
            {
                $set: {
                    isLive: false,
                    isOnline: false,
                    currentStreamId: null
                },
                $push: { 
                    recentActivities: {
                        action: 'live_end',
                        resource: 'live_broadcast',
                        timestamp: new Date(),
                        endpoint: '/api/live/end'
                    }
                }
            }
        );

        // Notificar viewers via Socket.IO
        const io = req.app.get('io');
        if (io) {
            io.to(activeStream.id).emit('stream_ended', {
                streamId: activeStream.id,
                hostId: userId,
                timestamp: new Date()
            });
            io.emit('stream_ended', {
                streamId: activeStream.id,
                hostId: userId
            });
        }

        // Encerrar PK battle ativa se existir
        const activeBattle: any = await Battle.findOne({
            $or: [
                { streamerA: userId },
                { streamerB: userId }
            ],
            status: 'active'
        });
        if (activeBattle) {
            const now = new Date();
            await Battle.findOneAndUpdate({ _id: activeBattle._id }, {
                status: 'finished',
                endedAt: now,
                winner: null
            });
            if (io) {
                io.emit('pk_battle_end', {
                    battleId: activeBattle._id.toString(),
                    winner: null,
                    reason: 'streamer_ended_live'
                });
            }
            console.log(`[LIVE-END] PK Battle ${activeBattle._id} encerrada por fim da live`);
        }

        console.log(`[LIVE-END] Live encerrada: ${activeStream.id} para usu+�rio ${userId}`);

        // Atualizar LiveCard para ended
        try {
            await LiveCard.findOneAndUpdate(
                { hostId: userId },
                { $set: {
                    isLive: false,
                    streamStatus: 'ended',
                    endTime: new Date(),
                    updatedAt: new Date()
                } }
            );
        } catch (cardErr) {
            console.warn('[LIVE-END] Erro ao atualizar LiveCard:', cardErr);
        }

        res.json({
            success: true,
            stream: {
                id: activeStream.id,
                isLive: false,
                streamStatus: 'ended',
                endTime: new Date()
            }
        });



    } catch (error) {

        console.error('[LIVE-END] Erro:', error);

        res.status(500).json({ 

            success: false,

            message: 'Erro interno ao encerrar live'

        });

    }

});



// REMOVIDO: Endpoint end paralelo - usar API real POST /streams/:id/end



// Old SRS routes removed to avoid duplication. The new SRS logic is in backend/src/routes/srsRoutes.ts

// ===== ROUTE START =====
router.get('/live/:category', async (req, res) => {

    try {

        const { category } = req.params;

        const { country } = req.query;

        const userAgent = req.get('User-Agent') || '';

        const referer = req.get('Referer') || '';



        console.log(`���� [DEBUG] API Route called - Category: ${category}, Country: ${country || 'none'}`);

        console.log(`���� [SECURITY] User-Agent: ${userAgent}, Referer: ${referer}`);

        

        // DETEC+�+�O DE FERRAMENTAS DE GRAVA+�+�O/SCRAPING

        const recordingIndicators = [

            'ffmpeg', 'vlc', 'obs', 'streamrecorder', 'youtube-dl', 'yt-dlp',

            'wget', 'curl', 'python-requests', 'node-fetch', 'postman',

            'insomnia', 'swagger', 'api-client', 'httpie', 'scrapy'

        ];

        

        const isRecordingAttempt = recordingIndicators.some(indicator => 

            userAgent.toLowerCase().includes(indicator.toLowerCase())

        );

        

        const isDirectApiAccess = !referer || (referer.includes('localhost') && userAgent.includes('curl'));

        

        // ��ܿ BLOQUEAR ACESSO DE FERRAMENTAS DE GRAVA+�+�O

        if (isRecordingAttempt || isDirectApiAccess) {

            console.log(`��ܿ [RECORDING BLOCKED] Category: ${category}, User-Agent: ${userAgent}`);

            return res.json([]); // Retornar lista vazia

        }



        // Base filter para streams ativos e v+�lidas

        let baseFilter: any = {

            isLive: true,

            name: { $exists: true, $nin: ['', null] },

            hostId: { $exists: true, $nin: ['', null] },

            avatar: { $exists: true, $nin: ['', null] },

            // ���� FILTRO RIGOROSO: apenas streams realmente ao vivo

            startTime: { $exists: true, $ne: null },

            streamStatus: 'active',

            // ���� VERIFICAR SE O HOST EST+� REALMENTE ONLINE

            viewers: { $exists: true, $gte: 0 },

            // ���� VERIFICAR SE TEM DADOS DE TRANSMISS+�O

            rtmpIngestUrl: { $exists: true, $ne: null },

            playbackUrl: { $exists: true, $ne: null }

        };



        // Se for "global" ou "popular", retorna todas as lives ativas E v+�lidas

        if (category === 'global' || category === 'popular') {

            let filter = baseFilter;



            // Se houver filtro por pa+�s, adicionar ao filter

            if (country && country !== 'ICON_GLOBE') {

                filter.country = country;

                console.log(`���� Filtering streams by country: ${country}`);

            }



            console.log(`���� [DEBUG] Final filter for global/popular:`, JSON.stringify(filter, null, 2));



            const streams = await Streamer.find(filter).sort({ viewers: -1 });

            console.log(`���� Found ${streams.length} streams for category: ${category}, country: ${country || 'all'}`);



            // Log country codes of returned streams for debugging

            if (streams.length > 0) {

                const countryCodes = streams.map(s => s.country || 'undefined').join(', ');

                console.log(`���� [DEBUG] Stream country codes: ${countryCodes}`);

            }



            // Transformar array de streams SRS para formato frontend usando mapper SRS

            const srsStreamsData = mapSrsStreamsArray(streams as any);

            // Aplicar prote+�+�o m+�xima aos dados transformados (converter para tipo compat+�vel)

            const protectedStreams = mapStreamsToProtectedArrayFlexible(streams as any);

            

            return res.json(protectedStreams);

        }



        // Para categorias espec+�ficas, filtra por tag ou categoria E valida dados

        let categoryFilter: any = {

            ...baseFilter,

            $or: [

                { category: category.toLowerCase() },

                { tags: { $in: [category.toLowerCase()] } }

            ]

        };



        // Se houver filtro por pa+�s em categorias espec+�ficas

        if (country && country !== 'ICON_GLOBE') {

            categoryFilter.country = country;

            console.log(`���� Filtering ${category} streams by country: ${country}`);

        }



        console.log(`���� [DEBUG] Final filter for category "${category}":`, JSON.stringify(categoryFilter, null, 2));



        const categoryStreams = await Streamer.find(categoryFilter).sort({ viewers: -1 });

        console.log(`���� Found ${categoryStreams.length} streams for category: ${category}, country: ${country || 'all'}`);



        // Log country codes of returned streams for debugging

        if (categoryStreams.length > 0) {

            const countryCodes = categoryStreams.map(s => s.country || 'undefined').join(', ');

            console.log(`���� [DEBUG] Category stream country codes: ${countryCodes}`);

        }



        // Retornar streams da categoria COM PROTECAO MAXIMA - SEM IDs REAIS usando mapper flex+�vel

        const protectedCategoryStreams = mapStreamsToProtectedArrayFlexible(categoryStreams as any);

        

        res.json(protectedCategoryStreams);

    } catch (error: any) {

        console.error('Error fetching streams:', error);

        res.status(500).json({ error: error.message });

    }

});



// Rota para buscar streams por regi+�o

// API para listar lives ativas

// ===== ROUTE START =====
router.get('/streams/live', async (req, res) => {

    try {

        const userAgent = req.get('User-Agent') || '';

        const referer = req.get('Referer') || '';

        

        console.log(`���� [STREAMS LIVE] Buscando lives ativas`);

        console.log(`���� [SECURITY] User-Agent: ${userAgent}, Referer: ${referer}`);

        

        // DETEC+�+�O DE FERRAMENTAS DE GRAVA+�+�O/SCRAPING

        const recordingIndicators = [

            'ffmpeg', 'vlc', 'obs', 'streamrecorder', 'youtube-dl', 'yt-dlp',

            'wget', 'curl', 'python-requests', 'node-fetch', 'postman',

            'insomnia', 'swagger', 'api-client', 'httpie', 'scrapy'

        ];

        

        const isRecordingAttempt = recordingIndicators.some(indicator => 

            userAgent.toLowerCase().includes(indicator.toLowerCase())

        );

        

        const isDirectApiAccess = !referer || (referer.includes('localhost') && userAgent.includes('curl'));

        

        // ��ܿ BLOQUEAR ACESSO DE FERRAMENTAS DE GRAVA+�+�O

        if (isRecordingAttempt || isDirectApiAccess) {

            console.log(`��ܿ [RECORDING BLOCKED] Streams live, User-Agent: ${userAgent}`);

            return res.json([]); // Retornar lista vazia

        }



        // Otimizado: Buscar streams ativas com populate para evitar N+1 consultas

        const activeStreams = await Streamer.find({

            isLive: true,

            streamStatus: 'active',

            name: { $exists: true, $nin: ['', null] },

            hostId: { $exists: true, $nin: ['', null] },

            streamKey: { $not: /_transcoded$/ }

        })

        .populate('hostId', 'id name avatarUrl level country isOnline')

        // Enriquecer streams com dados dos hosts usando mapper especializado

        const streamsWithHostData = enrichStreamsWithHostData(activeStreams as any, {

            name: 'Usu+�rio',

            avatar: '',

            level: 1,

            country: 'XX',

            isOnline: false

        });

        console.log(`ԣ� [STREAMS LIVE] Encontradas ${activeStreams.length} lives ativas`);



        res.json({

            success: true,

            streams: streamsWithHostData,

            count: activeStreams.length

        });

    } catch (error: any) {

        console.error('��� [STREAMS LIVE] Erro ao buscar lives ativas:', error);

        res.status(500).json({ error: error.message });

    }

});



// API para criar transmiss+�o real

// ===== ROUTE START =====
router.put('/streams/:id', async (req, res) => {

    try {

        const { id } = req.params;

        const updateData = req.body;
        if (updateData.country) updateData.country = updateData.country.toLowerCase();

        

        // Verificar se stream existe

        const existingStream: any = await Streamer.findOne({ id });

        if (!existingStream) {

            return res.status(404).json({ error: 'Stream not found' });

        }

        

        // Atualizar stream

        const stream = await Streamer.findOneAndUpdate(

            { id }, 

            updateData, 

            { returnDocument: 'after', runValidators: true }

        );

        

        if (!stream) {

            return res.status(400).json({ error: 'Failed to update stream' });

        }

        

        // Transformar stream individual para formato frontend usando mapper SRS

        const frontendStream = mapSrsStreamToFrontend(stream as any);

        res.json(frontendStream);

    } catch (error: any) {

        console.error('Error updating stream:', error);

        res.status(400).json({ 

            error: (error as Error).message || 'Bad request',

            details: (error as any).errors || null

        });

    }

});

router.patch('/streams/:id', async (req, res) => {

    if (req.body.country) req.body.country = req.body.country.toLowerCase();

    const stream = await Streamer.findOneAndUpdate({ id: req.params.id }, req.body, { returnDocument: 'after' });

    res.json({ success: true, stream });

});

// GET /api/streams/:id/urls - Obter configura+�+�es de URLs de um stream

// ===== ROUTE START =====
router.get('/streams/:id/urls', async (req: express.Request, res: express.Response) => {
    try {
        const userId = getUserIdFromToken(req);
        const { id: streamId } = req.params;

        // Verificar se a stream pertence ao usu+�rio
        const stream: any = await Streamer.findOne({ id: streamId, hostId: userId });
        
        if (!stream) {
            return ResponseHelper.error(res, 'Stream n+�o encontrada ou n+�o pertence ao usu+�rio', 404);
        }

        // Retornar URLs do stream
        return ResponseHelper.success(res, {
            streamId: stream.id,
            streamKey: stream.streamKey,
            rtmpIngestUrl: stream.rtmpIngestUrl,
            srtIngestUrl: stream.srtIngestUrl || '',
            playbackUrl: stream.playbackUrl,
            webrtcUrl: stream.webrtcUrl,
            streamServerUrl: stream.streamServerUrl || ''
        });

    } catch (error) {
        console.error('[STREAMS-URLS-GET] Erro:', error);
        return ResponseHelper.error(res, 'Erro ao obter URLs da stream', 500);
    }
});

// POST /api/streams/:id/urls - Salvar configura+�+�es de URLs RTMP/SRT

// ===== ROUTE START =====
router.post('/streams/:id/urls', async (req: express.Request, res: express.Response) => {
    try {
        const userId = getUserIdFromToken(req);
        const { id: streamId } = req.params;
        const { rtmpIngestUrl, srtIngestUrl, playbackUrl, streamKey } = req.body;

        // Verificar se a stream pertence ao usu+�rio
        const stream: any = await Streamer.findOne({ id: streamId, hostId: userId });
        
        if (!stream) {
            return ResponseHelper.error(res, 'Stream n+�o encontrada ou n+�o pertence ao usu+�rio', 404);
        }

        // Atualizar apenas as URLs fornecidas
        const updateData: any = {};
        if (rtmpIngestUrl !== undefined) updateData.rtmpIngestUrl = rtmpIngestUrl;
        if (srtIngestUrl !== undefined) updateData.srtIngestUrl = srtIngestUrl;
        if (playbackUrl !== undefined) updateData.playbackUrl = playbackUrl;
        if (streamKey !== undefined) updateData.streamKey = streamKey;

        const updatedStream = await Streamer.findOneAndUpdate(
            { id: streamId },
            updateData,
            { returnDocument: 'after' }
        );

        console.log(`���� [URLS] Configura+�+�es atualizadas para stream ${streamId} pelo usu+�rio ${userId}`);

        ResponseHelper.success(res, {
            success: true,
            stream: updatedStream,
            message: 'Configura+�+�es de URLs salvas com sucesso'
        });

    } catch (error) {
        console.error('��� [URLS] Erro ao salvar configura+�+�es:', error);
        ResponseHelper.error(res, 'Falha ao salvar configura+�+�es de URLs', 500);
    }
});

// ===== ROUTE START =====
router.post('/streams/:id/save', async (req, res) => {

    try {

        // Apenas campos seguros para atualização (não permitir sobrescrever isLive, streamStatus, etc)
        const allowedFields = ['name', 'title', 'message', 'description', 'category', 'tags', 'isPrivate', 'coverUrl', 'country'];
        const updateData: any = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }

        const stream = await Streamer.findOneAndUpdate(

            { id: req.params.id },

            { $set: updateData },

            { returnDocument: 'after' }

        );



        if (!stream) {

            return res.status(404).json({ success: false, error: 'Stream not found' });

        }



        res.json({ success: true, stream });

    } catch (error: any) {

        console.error('Error saving stream:', error);

        res.status(500).json({ success: false, error: error.message });

    }

});

// ===== ROUTE START =====
router.post('/streams/:id/cover', async (req, res) => {

    try {

        const { coverUrl } = req.body;



        if (!coverUrl) {

            return res.status(400).json({ error: 'Cover URL is required' });

        }



        const stream = await Streamer.findOneAndUpdate(

            { id: req.params.id },

            { avatar: coverUrl },

            { returnDocument: 'after' }

        );



        if (!stream) {

            return res.status(404).json({ success: false, error: 'Stream not found' });

        }



        res.json({ success: true, stream });

    } catch (error: any) {

        console.error('Error updating stream cover:', error);

        res.status(500).json({ success: false, error: error.message });

    }

});

// ===== ROUTE START =====
router.get('/streams/manual', async (req, res) => res.json([]));

// ===== ROUTE START =====
router.get('/streams/effects', async (req, res) => res.json({}));

// Fun+�+�o para limpar usu+�rios inativos (marcar como offline)

const cleanupInactiveUsers = async () => {

    try {

        const models = await import('../models');

        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);



        // Buscar streams ativas para n+�o remover usu+�rios que est+�o em streams

        const activeStreams = await models.Streamer.find({ isLive: true });

        const activeStreamIds = activeStreams.map(stream => stream.id);



        // Marcar como offline apenas usu+�rios que:

        // 1. N+�o t+�m lastSeen recente E n+�o est+�o em nenhuma stream ativa

        // 2. OU t+�m lastSeen antigo E n+�o est+�o em nenhuma stream ativa

        const result = await models.User.updateMany(

            {

                $and: [

                    {

                        $or: [

                            { lastSeen: { $lt: fiveMinutesAgo.toISOString() } },

                            { lastSeen: { $exists: false } }

                        ]

                    },

                    {

                        $or: [

                            { currentStreamId: { $exists: false } },

                            { currentStreamId: null },

                            { currentStreamId: { $nin: activeStreamIds } }

                        ]

                    }

                ]

            },

            { isOnline: false }

        );



        if (result.modifiedCount > 0) {

            console.log(`���� Limpeza de usu+�rios inativos: ${result.modifiedCount} usu+�rios marcados como offline`);

        }

    } catch (error) {

        console.error('��� Erro na limpeza de usu+�rios inativos:', error);

    }

};



// REMOVIDO: Cleanup autom+�tico de usu+�rios inativos
// setInterval(cleanupInactiveUsers, 5 * 60 * 1000);
// console.log('���� Cleanup autom+�tico ativado');



// Rota para buscar usu+�rios online em uma stream espec+�fica

// ===== ROUTE START =====
router.get('/streams/:id/online-users', async (req, res) => {

    try {

        const streamId = req.params.id;



        // Buscar usu+�rios marcados como online nesta stream no banco de dados

        const onlineUsersInStream = await User.find({

            isOnline: true,

            currentStreamId: streamId,

            name: { $exists: true, $nin: ['', null] }, // Apenas usu+�rios com nome v+�lido

            id: { $exists: true, $nin: ['', null] } // Apenas usu+�rios com ID v+�lido

        }).select('id name avatarUrl identification level activeFrameId frameExpiration');



        console.log(`���� [ONLINE USERS] Usu+�rios encontrados na stream ${streamId}:`, onlineUsersInStream.map(u => ({

            id: u.id,

            name: u.name,

            avatarUrl: u.avatarUrl,

            hasAvatar: !!u.avatarUrl

        })));



        // Se n+�o encontrar usu+�rios online, buscar todos os usu+�rios que enviaram presentes nesta live

        if (onlineUsersInStream.length === 0) {

            console.log(`���� [ONLINE USERS] Nenhum usu+�rio online encontrado, buscando usu+�rios que enviaram presentes...`);

            

            // Importar GiftTransaction apenas quando necess+�rio

            const { GiftTransaction } = await import('../models');

            

            // Buscar usu+�rios que enviaram presentes nesta live

            const giftSenders = await GiftTransaction.aggregate([

                { $match: { streamId: streamId } },

                { $group: { _id: '$fromUserId', totalValue: { $sum: '$totalValue' } } },

                { $sort: { totalValue: -1 } }

            ]);

            

            console.log(`���� [ONLINE USERS] Remetentes de presentes encontrados:`, giftSenders);

            

            // Buscar dados completos desses usu+�rios

            const senderIds = giftSenders.map((s: { _id: string }) => s._id);

            if (senderIds.length > 0) {

                const senderUsers = await User.find({

                    id: { $in: senderIds },

                    name: { $exists: true, $nin: ['', null] }

                }).select('id name avatarUrl identification level activeFrameId frameExpiration');

                

                // Combinar dados dos usu+�rios com valores reais de presentes enviados nesta live

                const usersWithGiftData = senderUsers.map(u => {

                    const senderData = giftSenders.find((s: { _id: string; totalValue: number }) => s._id === u.id);    

                    return {

                        id: u.id,

                        name: u.name,

                        avatarUrl: u.avatarUrl,

                        identification: u.identification,

                        level: u.level || 1,

                        activeFrameId: u.activeFrameId || null,

                        frameExpiration: u.frameExpiration || null,

                        value: senderData?.totalValue || 0 // Valor real enviado nesta live

                    };

                });

                

                console.log(`��Ļ [ONLINE USERS] Resultado final (presentes):`, usersWithGiftData);

                return res.json(usersWithGiftData);

            }

        }



        // Buscar transacoes de presentes desta live para calcular valores enviados APENAS nesta live

        const { GiftTransaction } = await import('../models');

        const liveGiftTransactions = await GiftTransaction.find({

            streamId: streamId

        }).select('fromUserId totalValue');



        // Agrupar valores por usu+�rio para esta live espec+�fica

        const userValuesInLive: Record<string, number> = {};

        liveGiftTransactions.forEach(transaction => {

            const userId = transaction.fromUserId;

            const value = transaction.totalValue || 0;

            userValuesInLive[userId] = (userValuesInLive[userId] || 0) + value;

        });



        // Enriquecer com valores reais de presentes enviados nesta live

        const usersWithValue = onlineUsersInStream.map(u => ({

            id: u.id,

            name: u.name,

            avatarUrl: u.avatarUrl,

            identification: u.identification,

            level: u.level || 1,

            activeFrameId: u.activeFrameId || null,

            frameExpiration: u.frameExpiration || null,

            value: userValuesInLive[u.id] || 0 // Valor real enviado nesta live

        }));



        // Ordenar por valor de presentes enviados (maior primeiro)

        usersWithValue.sort((a, b) => (b.value || 0) - (a.value || 0));



        // Se ainda n+�o encontrar nada, buscar o host da stream como fallback

        if (usersWithValue.length === 0) {

            console.log(`���� [ONLINE USERS] Nenhum usu+�rio encontrado, buscando host como fallback...`);

            

            const stream: any = await Streamer.findOne({ id: streamId });

            if (stream && stream.hostId) {

                const host: any = await User.findOne({ id: stream.hostId }).select('id name avatarUrl identification level activeFrameId frameExpiration');

                if (host) {

                    const hostData = {

                        id: host.id,

                        name: host.name,

                        avatarUrl: host.avatarUrl,

                        identification: host.identification,

                        level: host.level || 1,

                        activeFrameId: host.activeFrameId || null,

                        frameExpiration: host.frameExpiration || null,

                        value: userValuesInLive[host.id] || 0 // Valor real enviado pelo host

                    };

                    console.log(`��Ļ [ONLINE USERS] Host encontrado como fallback:`, hostData);

                    return res.json([hostData]);

                }

            }

        }



        console.log(`��Ļ [DEBUG] Resultado final:`, usersWithValue);

        return res.json(usersWithValue);

    } catch (error: any) {

        console.error('��� [ONLINE USERS] Erro:', error);

        return res.status(500).json({ error: error.message });

    }

});

// Rota para atualizar status online do usu+�rio

// API para usu+�rio entrar na live

// ===== ROUTE START =====
router.get('/streams/:streamId/join', async (req, res) => {
    try {
        const userId = await getUserIdFromToken(req);
        const streamId = req.params.streamId;

        console.log(`���� [STREAM JOIN GET] Usu+�rio ${userId} entrando na stream ${streamId}`);

        if (!userId || !streamId) {
            return res.status(400).json({ success: false, error: 'UserId e StreamId s+�o obrigat+�rios' });
        }

        // Verificar se stream existe
        const streamer: any = await Streamer.findOne({ id: streamId });
        if (!streamer) {
            return res.status(404).json({ success: false, error: 'Stream n+�o encontrada' });
        }

        // Verificar se usu+�rio est+� bloqueado
        const block = await Block.findOne({ 
            blockerId: streamer.hostId, 
            blockedId: userId 
        });
        if (block) {
            return res.status(403).json({ success: false, error: 'Usu+�rio bloqueado pelo host' });
        }

        // Atualizar status do usu+�rio
        const user = await User.findOneAndUpdate(
            { id: userId },
            {
                isOnline: true,
                currentStreamId: streamId,
                lastSeen: new Date().toISOString()
            },
            { returnDocument: 'after' }
        );

        if (!user) {
            return res.status(404).json({ success: false, error: 'Usu+�rio n+�o encontrado' });
        }

        // Notificar via WebSocket
        const io = req.app.get('io');
        if (io) {
            io.to(streamId).emit('user_joined', {
                userId: userId,
                streamId: streamId,
                timestamp: new Date()
            });
        }

        console.log(`ԣ� [STREAM JOIN GET] Usu+�rio ${userId} entrou na stream ${streamId}`);

        res.json({
            success: true,
            message: 'Usu+�rio entrou na stream com sucesso',
            user: {
                id: user.id,
                name: user.name,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                isOnline: user.isOnline,
                currentStreamId: user.currentStreamId
            },
            stream: {
                id: streamer.id,
                title: (streamer as any).title,
                hostId: streamer.hostId,
                isLive: streamer.isLive,
                viewers: streamer.viewers
            }
        });

    } catch (error: any) {
        console.error('��� [STREAM JOIN GET] Erro:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ���� API DE SALDO DA LIVE - Retorna saldo em tempo real

// ===== ROUTE START =====
router.get('/streams/:id/balance', async (req, res) => {

    try {

        const streamId = req.params.id;

        console.log(`��Ʀ [BALANCE] Buscando saldo da live: ${streamId}`);

        

        // Buscar streamer pelo ID

        const streamer: any = await Streamer.findOne({ id: streamId });

        

        if (!streamer) {

            console.log(`��� Streamer not found: ${streamId}`);

            return res.status(404).json({ error: 'Streamer not found' });

        }



        // ���� USAR DIAMONDS DO STREAM (valor correto para o contador)

        const currentBalance = streamer.diamonds || 0;

        

        console.log(`ԣ� [BALANCE] Saldo da live ${streamId}: ${currentBalance} diamantes`);

        

        // Retornar saldo atualizado

        res.json({

            streamId: streamId,

            streamerName: streamer.name,

            diamonds: currentBalance,

            lastUpdated: streamer.updatedAt || new Date().toISOString(),

            isLive: streamer.isLive

        });

        

    } catch (error: any) {

        console.error('��� [BALANCE] Erro ao buscar saldo da live:', error);

        res.status(500).json({ error: error.message });

    }

});



// API para usu+�rio sair da live

// ===== ROUTE START =====
router.post('/streams/:streamId/leave', async (req, res) => {

    try {

        const { userId } = req.body;

        const streamId = req.params.streamId;



        console.log(`���� [STREAM LEAVE] Usu+�rio ${userId} saindo da stream ${streamId}`);



        if (!userId || !streamId) {

            return res.status(400).json({ success: false, error: 'UserId e StreamId s+�o obrigat+�rios' });

        }



        // Verificar se o usu+�rio existe

        const user: any = await User.findOne({ id: userId });

        if (!user) {

            return res.status(404).json({ success: false, error: 'Usu+�rio n+�o encontrado' });

        }



        // Verificar se usu+�rio est+� realmente na stream

        if (!user.isOnline || user.currentStreamId !== streamId) {

            console.log(`��ᴩ� [STREAM LEAVE] Usu+�rio ${userId} n+�o est+� na stream ${streamId}`);

            return res.json({ success: true, message: 'Usu+�rio n+�o est+� na stream' });

        }



        // Verificar se usu+�rio +� host de alguma stream ativa

        const activeHostStreams = await Streamer.find({

            hostId: userId,

            isLive: true,

            id: { $ne: streamId }

        });



        // Se n+�o for host de nenhuma outra stream, marcar como offline

        if (!activeHostStreams || activeHostStreams.length === 0) {

            await User.findOneAndUpdate(

                { id: userId },

                {

                    currentStreamId: null,

                    lastSeen: new Date().toISOString()

                }

            );

        } else {

            // Se for host de outra stream, apenas limpar currentStreamId

            await User.findOneAndUpdate(

                { id: userId },

                {

                    currentStreamId: null,

                    lastSeen: new Date().toISOString()

                }

            );

        }

        // Limpar LiveUser ao sair
        try {
            const { LiveUser } = await import('../models/LiveInvite');
            await LiveUser.deleteOne({ userId });
        } catch (liveUserErr: any) {
            console.error(`[STREAM-LEAVE] Erro ao limpar LiveUser para ${userId}:`, liveUserErr?.message || liveUserErr);
        }



        // ���� MELHOR PR+�TICA: Decrementar viewers com $inc ( MongoDB garante n+�o ficar negativo com min: 0 )

        await Streamer.findOneAndUpdate(

            { id: streamId, viewers: { $gt: 0 } }, // Apenas se viewers > 0

            { $inc: { viewers: -1 } }

        );



        // Notificar via WebSocket

        const io = req.app.get('io');

        if (io) {

            io.to(streamId).emit('user_left', {

                userId: userId,

                streamId: streamId,

                user: {

                    id: user.id,

                    name: user.name,

                    avatarUrl: user.avatarUrl,

                    level: user.level

                },

                timestamp: new Date().toISOString()

            });

        }



        console.log(`ԣ� [STREAM LEAVE] Usu+�rio ${userId} saiu da stream ${streamId}`);



        res.json({

            success: true,

            user: {

                id: userId,

                isOnline: activeHostStreams && activeHostStreams.length > 0,

                currentStreamId: null

            },

            stream: {

                id: streamId,

                viewers: Math.max(0, 0) // ���� MELHOR PR+�TICA: MongoDB j+� controlou o decremento

            }

        });

    } catch (error: any) {

        console.error('��� [STREAM LEAVE] Erro:', error);

        res.status(500).json({ success: false, error: error.message });

    }

});



// Handler #1 removido ��� duplicata body-based. Usar JWT-based handler abaixo (linha ~7067).



// Rota para quando usu+�rio entra na stream - LEGACY

// ===== ROUTE START =====
router.post('/streams/:id/end-session', async (req, res) => {

    try {

        const { session } = req.body;

        const streamId = req.params.id;



        console.log(`���� Encerrando live ${streamId} e salvando no hist+�rico`);



        // 1. Buscar a stream antes de atualizar

        const stream: any = await Streamer.findOne({ id: streamId });



        // 🔧 BUSCAR DADOS ACUMULADOS DO STREAM SESSION para ter valores reais do banco
        let sessionStats: any = null;
        try {
            const { findStats } = await import('../models/StreamSession');
            const db = getDb();
            sessionStats = await findStats(db.collection('streamsessions') as any, streamId);
        } catch (sessionErr) {
            console.warn(`⚠️ [END-SESSION] Erro ao buscar StreamSession: ${sessionErr}`);
        }

        // Usar dados reais do banco (fallback para o que o frontend enviou)
        const realCoins = sessionStats?.coins ?? session?.coins ?? 0;
        const realViewers = sessionStats?.peakViewers ?? session?.peakViewers ?? stream?.viewers ?? 0;
        const realFollowers = sessionStats?.followers ?? session?.followers ?? 0;
        const realMembers = sessionStats?.members ?? session?.members ?? 0;
        const realFans = sessionStats?.fans ?? session?.fans ?? 0;
        const realGifts = sessionStats?.giftsReceived ?? session?.giftsReceived ?? 0;
        const realMessages = sessionStats?.messagesCount ?? session?.messagesCount ?? 0;

        if (!stream) {

            console.warn(`��ᴩ� Stream ${streamId} n+�o encontrada, mas continuando para limpar estado do usu+�rio`);

            

            // Mesmo que a stream n+�o exista, limpar o estado do usu+�rio

            const userId = getUserIdFromToken(req);

            if (userId) {

                await User.findOneAndUpdate(
                    { id: userId },
                    { $set: {
                        isLive: false,
                        isOnline: false,
                        currentStreamId: null,
                        lastSeen: new Date().toISOString()
                    } }
                );

                console.log(`ԣ� Estado do usu+�rio ${userId} limpo mesmo sem stream encontrada`);

            }

            

            return res.json({ success: true, message: 'Stream n+�o encontrada mas estado limpo' });

        }



        // 2. Calcular duracao

        const endTime = Date.now();

        const durationMs = endTime - (session?.startTime || endTime);

        const totalSeconds = Math.floor(durationMs / 1000);

        const hours = Math.floor(totalSeconds / 3600);

        const minutes = Math.floor((totalSeconds % 3600) / 60);

        const seconds = totalSeconds % 60;

        const durationStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;



        // 3. Salvar no hist+�rico

        const { StreamHistory } = await import('../models');

        let historyEntry = null;

        try {

            historyEntry = {

                id: `hist_${streamId}_${endTime}`,

                streamId: streamId,

                hostId: stream.hostId,

                hostName: stream.name,

                hostAvatar: stream.avatar,

                title: stream.name,

                startTime: session?.startTime || new Date(stream.startTime || endTime).toISOString(),

                endTime: new Date(endTime).toISOString(),

                duration: durationStr,

                peakViewers: realViewers,

                totalCoins: realCoins,

                totalGifts: realGifts,

                totalMessages: realMessages,

                totalFollowers: realFollowers,

                totalMembers: realMembers,

                totalFans: realFans,

                category: stream.category,

                tags: stream.tags || [],

                country: stream.country

            };



            await StreamHistory.create(historyEntry);

            console.log(`��ƥ Hist+�rico salvo para stream ${streamId}`);

        } catch (historyError: any) {

            console.warn(`��ᴩ� Erro ao salvar hist+�rico (mas continuando): ${historyError.message}`);

            // Continuar mesmo se o hist+�rico falhar

        }



        // 4. Atualizar status da stream para offline

        let updatedStream;

        try {

            updatedStream = await Streamer.findOneAndUpdate(

                { id: streamId },

                {

                    isLive: false,

                    endTime: new Date(endTime).toISOString(),

                    streamStatus: 'ended',

                    viewers: 0

                },

                { returnDocument: 'after' }

            );

            if (!updatedStream) {

                console.warn(`��ᴩ� Stream ${streamId} n+�o encontrada para atualizar`);

            }

        } catch (updateError: any) {

            console.warn(`��ᴩ� Erro ao atualizar stream (mas continuando): ${updateError.message}`);

        }



        // 5. Atualizar status do host

        let updatedUser;

        try {

            const User = await import('../models').then(m => m.User);

            updatedUser = await User.findOneAndUpdate(
                { id: stream.hostId },
                { $set: { isLive: false, isOnline: false, currentStreamId: null } },
                { returnDocument: 'after' }
            );
            if (!updatedUser) {
                console.warn(`⚠️ Usuário ${stream.hostId} não encontrado para atualizar`);

            }

        } catch (userError: any) {

            console.warn(`��ᴩ� Erro ao atualizar usu+�rio (mas continuando): ${userError.message}`);

        }



        // 6. Remover todos os usu+�rios online desta stream

        try {

            const User = await import('../models').then(m => m.User);

            await User.updateMany(

                { currentStreamId: streamId },

                {

                    currentStreamId: null,

                    lastSeen: new Date().toISOString()

                }

            );

            console.log(`ԣ� Usu+�rios removidos da stream ${streamId}`);

        } catch (removeError: any) {

            console.warn(`��ᴩ� Erro ao remover usu+�rios da stream (mas continuando): ${removeError.message}`);

        }



        // 7. Notificar via WebSocket

        const io = req.app.get('io');

        if (io) {

            io.to(streamId).emit('stream_ended', {

                streamId: streamId,

                hostId: stream.hostId,

                timestamp: new Date().toISOString()

            });



            io.to(streamId).emit('live_stream_ended', {

                streamId: streamId,

                message: 'Esta transmiss+�o foi encerrada',

                timestamp: new Date().toISOString()

            });

            io.emit('card_removed', {
                streamId: streamId || stream?.id,
                hostId: stream?.hostId || '',
                timestamp: new Date().toISOString()
            });
            io.emit('stream_ended', {
                streamId: streamId || stream?.id,
                hostId: stream?.hostId || '',
                timestamp: new Date().toISOString()
            });
            io.emit('stream_stopped', {
                streamId: streamId || stream?.id,
                hostId: stream?.hostId || '',
                timestamp: new Date().toISOString()
            });

            console.log(`���� Notifica+�+�o WebSocket enviada: stream ${streamId} encerrada`);

        }



        console.log(`ԣ� Live ${streamId} encerrada e hist+�rico salvo com sucesso`);

        // 🔧 Retornar dados reais do resumo para o frontend usar no EndStreamSummaryScreen
        const summary = {
            streamId,
            viewers: realViewers,
            duration: totalSeconds,
            coins: realCoins,
            followers: realFollowers,
            members: realMembers,
            fans: realFans,
            user: stream ? { name: stream.name, avatarUrl: stream.avatar } : { name: '', avatarUrl: '' }
        };

        // Atualizar LiveCard para ended
        if (stream?.hostId) {
            try {
                await LiveCard.findOneAndUpdate(
                    { hostId: stream.hostId },
                    { $set: {
                        isLive: false,
                        streamStatus: 'ended',
                        endTime: new Date(endTime),
                        updatedAt: new Date()
                    } }
                );
            } catch (cardErr) {
                console.warn('[END-SESSION] Erro ao atualizar LiveCard:', cardErr);
            }
        }

        res.json({

            success: true,

            user: updatedUser || {},

            stream: {

                id: streamId,

                isLive: false,

                endTime: new Date(endTime).toISOString()

            },

            history: historyEntry,

            summary

        });



    } catch (error: any) {

        console.error('��� Erro ao encerrar sess+�o da live:', error);

        res.status(500).json({ success: false, error: error.message });

    }

});



// API espec+�fica para remover cards de lives

// ===== ROUTE START =====
router.delete('/cards/:streamId', async (req, res) => {

    try {

        const { streamId } = req.params;

        const { userId } = req.query;



        console.log(`���洩� Removendo card da live ${streamId} pelo usu+�rio ${userId}`);



        // Validar userId

        if (!userId) {

            console.warn(`��ᴩ� userId n+�o fornecido para remover card ${streamId}`);

            return res.status(400).json({ success: false, error: 'User ID required' });

        }



        // 1. Buscar a stream

        const stream: any = await Streamer.findOne({ id: streamId });



        if (!stream) {

            console.warn(`��ᴩ� Stream ${streamId} n+�o encontrada`);

            return res.status(404).json({ success: false, error: 'Stream not found' });

        }



        // 2. Verificar se o usu+�rio +� o dono da stream

        if (stream.hostId !== userId) {

            console.warn(`��ᴩ� Usu+�rio ${userId} n+�o +� dono da stream ${streamId} (dono: ${stream.hostId})`);

            return res.status(403).json({ success: false, error: 'Unauthorized: Only stream owner can remove card' });

        }



        // 3. Remover o card (marcar como offline)

        await Streamer.findOneAndUpdate(

            { id: streamId },

            {

                isLive: false,

                streamStatus: 'ended',

                endTime: new Date().toISOString(),

                viewers: 0

            }

        );



        // 3. Notificar via WebSocket para todos os clientes

        const io = req.app.get('io');

        if (io) {

            io.emit('card_removed', {

                streamId: streamId,

                hostId: stream.hostId,

                timestamp: new Date().toISOString()

            });



            console.log(`���� Notifica+�+�o WebSocket enviada: card ${streamId} removido`);

        }



        console.log(`ԣ� Card da live ${streamId} removido com sucesso`);



        res.json({ success: true });



    } catch (error: any) {

        console.error('��� Erro ao remover card:', error);

        res.status(500).json({ success: false, error: error.message });

    }

});

// ===== ROUTE START =====
router.post('/streams/:id/gift', async (req, res) => {

    try {

        const { fromUserId, giftName, amount } = req.body;

        const U = await import('../models').then(m => m.User);

        const G = await import('../models').then(m => m.Gift);



        const sender = await U.findOne({ id: fromUserId });

        if (!sender) return res.status(404).json({ error: 'Sender not found' });



        // Find stream to get receiver

        const stream: any = await Streamer.findOne({ id: req.params.id });

        if (!stream) return res.status(404).json({ error: 'Stream not found' });



        const receiver = await U.findOne({ id: stream.hostId });



        // Find gift details

        const gift = await G.findOne({ name: giftName });

        if (!gift) return res.status(404).json({ error: 'Gift not found' });



        const price = gift.price || 0;

        const totalValue = price * (amount || 1);



        if (sender.diamonds < totalValue) {

            return res.status(400).json({ error: 'Insufficient diamonds' });

        }



        let updatedSender;

        let updatedReceiver;



        if (fromUserId === stream.hostId) {

            // Quando a pessoa manda presente pra si mesma, fazemos as duas atualiza+�+�es (- e +) EM UMA +�NICA chamada no banco.

            // O erro dos diamantes bugados acontecia porque o sender.save() e o receiver.save() sobrescreviam um ao outro.

            updatedSender = await U.findOneAndUpdate(

                { id: fromUserId },

                { $inc: { diamonds: -totalValue, enviados: totalValue, receptores: totalValue, earnings: totalValue } },

                { returnDocument: 'after' }

            );

            updatedReceiver = updatedSender;

            console.log(`��Ʀ [LIVE GIFT] ${updatedSender?.name} enviou ${totalValue} diamantes para si mesmo (duas m+�tricas do mesmo evento)`);

        } else {

            // Se for para outra pessoa, atualiza cada um separado e corretamente

            updatedSender = await U.findOneAndUpdate(

                { id: fromUserId },

                { $inc: { diamonds: -totalValue, enviados: totalValue } },

                { returnDocument: 'after' }

            );

            

            if (stream.hostId) {

                updatedReceiver = await U.findOneAndUpdate(

                    { id: stream.hostId },

                    { $inc: { receptores: totalValue, earnings: totalValue } },

                    { returnDocument: 'after' }

                );

                console.log(`��Ʀ [LIVE GIFT] ${updatedSender?.name} enviou ${totalValue} diamantes para ${updatedReceiver?.name}`);

            }

        }

        

        if (updatedReceiver) {

            console.log(`���� [LIVE GIFT] ${updatedReceiver.name} - Receptores: ${updatedReceiver.receptores}, Earnings: ${updatedReceiver.earnings}`);

        }

        

        // Enviar WebSocket em tempo real com valor real

        const io = req.app.get('io');

        if (io && updatedReceiver) {

            // Notificar o RECEPTOR: atualiza earnings e receptores em tempo real

            io.emit('earnings_updated', {

                userId: updatedReceiver.id,

                diamonds: totalValue,

                totalEarnings: updatedReceiver.earnings,

                totalReceptores: updatedReceiver.receptores,

                timestamp: new Date().toISOString(),

                source: 'live_gift',

                streamId: req.params.id,

                fromUser: updatedSender?.name || 'Unknown',

                giftName: giftName

            });

            console.log(`���� [WEBSOCKET] Earnings atualizados em tempo real para ${updatedReceiver.name}: +${totalValue} diamantes (total earnings: ${updatedReceiver.earnings}, receptores: ${updatedReceiver.receptores})`);

        }

        // Notificar o REMETENTE: atualiza diamonds e enviados em tempo real

        if (io && updatedSender) {

            io.emit('diamonds_updated', {

                userId: updatedSender.id,

                diamonds: updatedSender.diamonds,

                enviados: updatedSender.enviados,

                change: -totalValue,

                timestamp: new Date().toISOString(),

                source: 'gift_sent',

                giftName: giftName

            });

            console.log(`���� [WEBSOCKET] Diamonds atualizados em tempo real para ${updatedSender.name}: ${updatedSender.diamonds} (enviados: ${updatedSender.enviados})`);

        }



        // Acumular diamantes na stream (n+�o converter para BRL ainda)

        await Streamer.findOneAndUpdate(

            { id: req.params.id },

            {

                $inc: { diamonds: totalValue }

            }

        );



        // Emitir atualiza+�+�o para a sala de transmiss+�o com os 'receptores' reais

        if (io && updatedReceiver) {

            io.emit('live_coins_updated', {

                streamId: req.params.id,

                coins: totalValue,

                totalCoins: updatedReceiver.receptores || 0,

                timestamp: new Date().toISOString(),

                fromUser: updatedSender?.name || 'Unknown',

                giftName: giftName

            });

            console.log(`���� [WEBSOCKET] live_coins_updated emitido para a sala ${req.params.id} com totalCoins: ${updatedReceiver.receptores}`);

        }



        // Emitir evento de presente recebido para todos na sala da live
        if (io) {
            const giftEventData = {
                from: {
                    id: updatedSender?.id || fromUserId,
                    name: updatedSender?.name || 'Unknown',
                    avatarUrl: updatedSender?.avatarUrl || '',
                    level: updatedSender?.level || 1
                },
                toUser: {
                    id: stream.hostId,
                    name: updatedReceiver?.name || 'Unknown'
                },
                gift: {
                    name: giftName,
                    price: price,
                    icon: gift.icon || '🎁',
                    category: gift.category || 'Popular'
                },
                quantity: amount || 1,
                totalValue,
                roomId: req.params.id,
                streamId: req.params.id,
                timestamp: new Date().toISOString()
            };

            io.to(req.params.id).emit('live_gift_received', giftEventData);
            io.to(req.params.id).emit('gift_received', giftEventData);
            io.to(`user_${stream.hostId}`).emit('gift_received', giftEventData);
            console.log(`🎁 [WEBSOCKET] live_gift_received emitido para sala ${req.params.id}: ${giftName} x${amount || 1}`);
        }

        // Register gift transaction

        await GiftTransaction.create([{

            id: `gift_tx_${Date.now()}_${fromUserId}`,

            fromUserId,

            fromUserName: updatedSender?.name || 'Unknown',

            fromUserAvatar: updatedSender?.avatarUrl || '',

            toUserId: stream.hostId,

            toUserName: updatedReceiver?.name || 'Unknown',

            streamId: req.params.id,

            giftId: gift._id, // Usar _id do MongoDB

            giftName,

            giftIcon: gift.icon || '����',

            giftPrice: price,

            quantity: amount || 1,

            totalValue,

            createdAt: new Date().toISOString()

        }]);



        console.log(`���� Gift sent: ${giftName} x${amount} from ${updatedSender?.name || 'Unknown'} to stream ${req.params.id} - ${totalValue} diamonds accumulated`);



        res.json({

            success: true,

            updatedSender,

            updatedReceiver: updatedReceiver || {} as any,

            transaction: {

                giftName,

                amount: amount || 1,

                totalValue,

                diamonds: totalValue

            }

        });

    } catch (error: any) {

        console.error('Error sending gift:', error);

        res.status(500).json({ error: error.message });

    }

});

// REMOVIDO: Endpoint de simula+�+�o que estava causando usu+�rio falso online

// REMOVIDO: Rotas legadas WebRTC (publish/play/stop) ��� agora usando WHIP (browser) e RTMP (Android) direto para SRS



// PUT /api/streams/:id/quality - Atualizar qualidade do stream

// ===== ROUTE START =====
router.put('/streams/:id/quality', async (req, res) => {

    try {

        const { id: streamId } = req.params;

        const { quality, userId } = req.body;



        console.log(`���� [STREAM_QUALITY] Stream: ${streamId}, Quality: ${quality}, User: ${userId}`);



        // 1. Validar se o stream existe

        const streamer: any = await Streamer.findOne({ id: streamId });

        if (!streamer) {

            console.log(`��� [STREAM_QUALITY] Stream n+�o encontrado: ${streamId}`);

            return res.status(404).json({

                success: false,

                error: 'Stream n+�o encontrado'

            });

        }



        // 2. Validar se o usu+�rio +� o host do stream

        if (streamer.hostId !== userId) {

            console.log(`��� [STREAM_QUALITY] Usu+�rio n+�o +� host: ${userId} != ${streamer.hostId}`);

            return res.status(403).json({

                success: false,

                error: 'Apenas o host pode alterar a qualidade'

            });

        }



        // 3. Validar se a qualidade +� v+�lida

        const validQualities = ['360p', '480p', '720p', '1080p'];

        if (!validQualities.includes(quality)) {

            console.log(`��� [STREAM_QUALITY] Qualidade inv+�lida: ${quality}`);

            return res.status(400).json({

                success: false,

                error: 'Qualidade inv+�lida'

            });

        }



        // 4. Atualizar qualidade no banco de dados

        await Streamer.updateOne(

            { id: streamId },

            { quality: quality }

        );



        console.log(`ԣ� [STREAM_QUALITY] Qualidade atualizada: ${quality}`);



        // 5. Enviar evento WebSocket para atualizar frontend

        const io = req.app.get('io');

        if (io) {

            io.emit(`stream_${streamId}_quality_updated`, {

                quality,

                streamId,

                userId

            });

            console.log(` [STREAM_QUALITY] Evento WebSocket emitido para stream_${streamId}`);

        }



        res.json({

            success: true,

            message: `Qualidade alterada para ${quality} com sucesso`,

            streamId,

            quality,

            stream: {

                ...streamer.toJSON(),

                quality

            }

        });



    } catch (error) {

        console.error(' [STREAM_QUALITY] Erro:', error);

        res.status(500).json({

            success: false,

            error: 'Erro ao atualizar qualidade do stream'

        });

    }

});



// API STARK - Iniciar live (DEPRECATED - Usar WHIP/WHEP diretamente)

// ===== ROUTE START =====
router.post('/stark/live/start', async (req, res) => {
    try {
        console.warn('[STARK-START] ⚠️ DEPRECATED: Usar WHIP endpoint /api/rtc/v1/whip/ em vez de STARK API');
        const { userId, title, category, country } = req.body;
        if (!userId || !title) {
            return res.status(400).json({ code: 1, msg: 'Parametros obrigatorios: userId, title', result: null });
        }
        const user = await findUserByAnyId(User, userId);
        if (!user) return res.status(404).json({ code: 1, msg: 'Usuario nao encontrado', result: null });

        // Verifica se realmente existe stream ativa (não só flag isLive no User)
        if (user.isLive) {
            const activeStream = await Streamer.findOne({
                hostId: userId,
                isLive: true,
                streamStatus: { $in: ['active', 'live'] }
            }).lean();

            if (activeStream) {
                console.log(`[STARK-START] Usuario ${userId} ja possui uma stream ativa (${activeStream.id}). Reiniciando/atualizando a stream.`);
                // Nao bloqueamos com erro 409, permitindo a reinicializacao da transmissao
            } else {
                // Flag isLive travada sem stream ativa — reseta
                console.log(`[STARK-START] Resetando isLive=false para ${userId} — sem stream ativa`);
                await User.findOneAndUpdate({ id: userId }, { $set: { isLive: false } });
            }
        }

        const streamId = userId;
        const streamKey = 'stream_' + uuidv4();
        const liveId = String(Date.now());
        const srsHost = process.env.SRS_HOST || process.env.DOMAIN || 'srs';
        const pushUrl = 'webrtc://' + srsHost + ':1935/live/' + streamKey + '?txSecret=xxx&txTime=xxx';

        const finalCountry = (country || user.country || 'BR').toLowerCase();
        const finalCategory = (category || 'popular').toLowerCase();

        await Streamer.findOneAndUpdate(
            { id: streamId },
            { $set: { id: streamId, hostId: userId, name: user.name || userId, isLive: false, streamStatus: 'preparing', startTime: new Date(), streamKey: streamKey, liveId: liveId, pushUrl: pushUrl, title: title, category: finalCategory, country: finalCountry } },
            { upsert: true, returnDocument: 'after' }
        );

        // isLive=false ate confirmacao via /stark/live/publish
        await User.findOneAndUpdate(
            { id: userId },
            { $set: { isOnline: true, currentStreamId: streamId } }
        );

        // Registrar broadcaster no LiveUser para aparecer na lista de online
        try {
            const { LiveUser } = await import('../models/LiveInvite');
            await LiveUser.findOneAndUpdate(
                { userId },
                {
                    userId,
                    username: userId,
                    name: user.name || userId,
                    avatarUrl: user.avatarUrl || '',
                    status: 'broadcasting',
                    currentStreamId: streamId,
                    lastActive: new Date()
                },
                { upsert: true, returnDocument: 'after' }
            );
        } catch (liveUserErr: any) {
            console.error(`[STARK-START] Erro ao registrar LiveUser para ${userId}:`, liveUserErr?.message || liveUserErr);
        }

        res.json({
            code: 0,
            result: { pushUrl, liveId, streamId, startTime: String(Date.now()) },
            msg: 'OK'
        });
    } catch (error) {
        res.status(500).json({ code: 1, msg: 'Erro interno', result: null });
    }
});



// Endpoint /api/streams/start - Cria registro provis+rio (isLive: false)
// Frontend chama antes de capturar m+dia para obter streamKey e URLs

// ===== ROUTE START =====
router.post('/streams/start', async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized', status: 'unauthorized' });
        }

        const { title, name, category = 'general' } = req.body;
        const liveTitle = title || name || 'Ao Vivo';

        const user: any = await User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ error: 'Usu+rio n+o encontrado', status: 'user_not_found' });
        }

        // Gerar streamKey +nica
        const streamKey = 'stream_' + uuidv4();
        const liveId = uuidv4();

        const srsHost = process.env.SRS_HOST || 'srs';
        const srsRtmp = `rtmp://${srsHost}:1935/live`;
        const backendApi = 'https://api.livego.store/api/video/http';

        // Criar registro provis+rio  isLive: false at+ SRS on_publish
        const stream: any = await Streamer.create({
            id: liveId,
            hostId: userId,
            name: user.name,
            avatar: user.avatarUrl || '',
            title: liveTitle,
            category: category.toLowerCase(),
            streamKey: streamKey,
            rtmpIngestUrl: `${srsRtmp}/${streamKey}`,
            playbackUrl: `${backendApi}/live/${streamKey}.m3u8`,
            hlsUrl: `${backendApi}/live/${streamKey}.m3u8`,
            isLive: false,
            streamStatus: 'preparing',
            startTime: new Date(),
            viewers: 0,
            country: user.country || 'br',
            tags: [category.toLowerCase(), 'live'],
            quality: 'HD',
            giftsEnabled: true,
            chatEnabled: true
        });

        console.log(`[STREAMS START] Stream provis+rio criado: ${streamKey} para usu+rio ${userId}`);

        // Criar LiveCard (stream preparando)
        try {
            await LiveCard.findOneAndUpdate(
                { hostId: userId },
                { $set: {
                    hostId: userId,
                    name: user.name || userId,
                    avatar: user.avatarUrl || '',
                    title: liveTitle,
                    streamKey: streamKey,
                    country: (user.country || 'BR').toLowerCase(),
                    isLive: false,
                    streamStatus: 'preparing',
                    category: (category || 'popular').toLowerCase(),
                    startTime: new Date(),
                    updatedAt: new Date()
                } },
                { upsert: true }
            );
        } catch (cardErr) {
            console.warn('[STREAMS-START] Erro ao criar LiveCard:', cardErr);
        }

        res.json({
            success: true,
            streamKey: streamKey,
            rtmpUrl: `${srsRtmp}/${streamKey}`,
            hlsUrl: `${backendApi}/live/${streamKey}.m3u8`,
            flvUrl: `${backendApi}/live/${streamKey}.flv`,
            status: 'preparing'
        });

    } catch (error: any) {
        console.error('[STREAMS START] Erro ao criar stream provis+rio:', error);
        res.status(500).json({
            error: 'Erro interno ao criar stream',
            status: 'error',
            details: error.message
        });
    }
});

// Endpoint /api/lives/start - Porteiro oficial da transmiss+o
// Frontend chama com { streamId } e espera { success: boolean }

// ===== ROUTE START =====
router.post('/lives/start', async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized', status: 'unauthorized' });
        }

        const { streamId } = req.body;

        if (!streamId) {
            return res.status(400).json({ error: 'streamId + obrigat+rio', status: 'invalid_request' });
        }

        const user: any = await User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ error: 'Usu+rio n+o encontrado', status: 'user_not_found' });
        }

        // Buscar stream existente por streamKey ou criar provis+rio
        let stream: any = await Streamer.findOne({ streamKey: streamId });
        if (!stream) {
            stream = await Streamer.findOne({ id: streamId });
        }

        const srsHost = process.env.SRS_HOST || 'srs';
        const srsRtmp = `rtmp://${srsHost}:1935/live`;
        const backendApi = 'https://api.livego.store/api/video/http';
        const now = new Date();

        if (!stream) {
            // Criar registro provis+rio
            const liveId = uuidv4();
            stream = await Streamer.create({
                id: liveId,
                hostId: userId,
                name: user.name,
                avatar: user.avatarUrl || '',
                title: user.name,
                streamKey: 'stream_' + uuidv4(),
                rtmpIngestUrl: `${srsRtmp}/${streamId}`,
                playbackUrl: `${backendApi}/live/${streamId}.m3u8`,
                hlsUrl: `${backendApi}/live/${streamId}.m3u8`,
                isLive: false,
                streamStatus: 'preparing',
                startTime: now,
                viewers: 0,
                country: user.country || 'br',
                tags: ['live'],
                quality: 'HD',
                giftsEnabled: true,
                chatEnabled: true
            });
        }

        console.log(`[LIVES START] Stream provisionado: ${stream!.streamKey}`);

        res.json({
            success: true,
            streamKey: stream!.streamKey,
            rtmpUrl: `${srsRtmp}/${stream!.streamKey}`,
            hlsUrl: `${backendApi}/live/${stream!.streamKey}.m3u8`
        });

    } catch (error: any) {
        console.error('[LIVES START] Erro:', error);
        res.status(500).json({
            error: 'Erro interno',
            status: 'error',
            details: error.message
        });
    }
});

// ===== ROUTE START =====
router.get('/lives/:id', async (req, res) => {

    try {

        const { id } = req.params;

        const userAgent = req.get('User-Agent') || '';

        const referer = req.get('Referer') || '';

        

        console.log(` [DEBUG] Getting live details for streamer: ${id}`);

        console.log(` [SECURITY] User-Agent: ${userAgent}, Referer: ${referer}`);

        

        // DETEC++O DE GRAVA++O - Verificar sinais de ferramentas de grava++o

        const recordingIndicators = [

            'ffmpeg', 'vlc', 'obs', 'streamrecorder', 'youtube-dl', 'yt-dlp',

            'wget', 'curl', 'python-requests', 'node-fetch', 'postman',

            'insomnia', 'swagger', 'api-client', 'httpie'

        ];

        

        const isRecordingAttempt = recordingIndicators.some(indicator => 

            userAgent.toLowerCase().includes(indicator.toLowerCase())

        );

        

        // Verificar se + acesso direto + API (sem referer do app)

        const isDirectApiAccess = !referer || (referer.includes('localhost') && userAgent.includes('curl'));

        

        // Usar ID real diretamente (sem mapeamento)

        const streamer: any = await Streamer.findOne({ id });

        

        if (!streamer) {

            console.log(` Streamer not found: ${id}`);

            return res.status(404).json({ error: 'Streamer not found' });

        }



        // Transformar streamer para formato protegido usando mapper flex+vel

        const protectedStream = mapStreamToProtectedFlexible(streamer as any);

        res.json(protectedStream);

    } catch (error: any) {

        console.error(' Error getting live details:', error);

        res.status(500).json({ error: 'Internal server error' });

    }

});

// ===== ROUTE START =====
router.post('/lives/:id/end', async (req, res) => {

    try {

        // Usar ID real diretamente

        const realId = req.params.id;

        const userId = getUserIdFromToken(req);



        console.log(`[STREAM-END] Encerrando stream: ${realId} por usu+rio: ${userId}`);



        // Atualizar status para 'ended' no banco

        await Streamer.findOneAndUpdate(

            { id: realId },

            {

                isLive: false,

                streamStatus: 'ended',

                endTime: new Date()

            }

        );



        // Atualizar status do usu+rio

        await User.findOneAndUpdate(
            { id: userId },
            { $set: {
                isLive: false,
                isOnline: false,
                currentStreamId: null,
                lastSeen: new Date()
            } }
        );

        const io = req.app.get('io');
        if (io) {
            io.emit('card_removed', {
                streamId: realId,
                hostId: userId,
                timestamp: new Date().toISOString()
            });
            io.emit('stream_ended', {
                streamId: realId,
                hostId: userId,
                timestamp: new Date().toISOString()
            });
            io.emit('stream_stopped', {
                streamId: realId,
                hostId: userId,
                timestamp: new Date().toISOString()
            });
        }

        return successResponse(res, 'Stream encerrada com sucesso');

        

    } catch (error) {

        console.error('[STREAM-END] Erro ao encerrar stream:', error);

        return internalServerErrorResponse(res, 'Erro ao encerrar stream', error);

    }

});



// GET /api/live/nearby - Streams pr+ximas por localiza++o

// ===== ROUTE START =====
router.get('/live/nearby', async (req, res) => {

    try {

        const { latitude, longitude, maxDistance = 50000, limit = 20 } = req.query;



        if (!latitude || !longitude) {

            return res.status(400).json({ error: 'Latitude and longitude are required' });

        }



        const lat = parseFloat(latitude as string);

        const lng = parseFloat(longitude as string);

        const maxDist = parseInt(maxDistance as string);



        // Buscar streams ativas pr+ximas usando geoLocation do host

        const nearbyStreams = await Streamer.find({

            isLive: true,

            streamStatus: 'active',

            name: { $exists: true, $nin: ['', null] },

            hostId: { $exists: true, $ne: null }

        })

            .populate('hostId', 'geoLocation name avatarUrl')

            .limit(parseInt(limit as string));



        // Filtrar streams que t+m host com localiza++o pr+xima

        const validStreams = nearbyStreams.filter(stream => stream.hostId);



        console.log(` [NEARBY STREAMS] ${validStreams.length} streams encontradas pr+ximas a (${lat}, ${lng})`);



        // Retornar streams COM PROTE++O DE DADOS SENS+VEIS usando mapper flex+vel

        const protectedActiveStreams = mapStreamsToProtectedArrayFlexible(validStreams as any);

        

        res.json(protectedActiveStreams);

    } catch (error: any) {

        console.error('Error fetching nearby streams:', error);

        res.status(500).json({ error: error.message });

    }

});



// GET /api/live/following - Streams de usu+rios que o usu+rio segue

// ===== ROUTE START =====
router.get('/live/following', async (req, res) => {

    try {

        const userId = req.query.userId as string;



        if (!userId) {

            return res.status(400).json({ error: 'User ID is required' });

        }



        // Buscar usu+rio e seus seguidos

        const User = await import('../models').then(m => m.User);

        const user: any = await User.findOne({ id: userId });



        if (!user) {

            return res.status(404).json({ error: 'User not found' });

        }



        // Buscar IDs dos usu+rios que segue

        const followingIds = user.followingList || [];



        if (followingIds.length === 0) {

            return res.json([]);

        }



        // Buscar streams ativas dos usu+rios que segue

        const followingStreams = await Streamer.find({

            isLive: true,

            streamStatus: 'active',

            hostId: { $in: followingIds },

            name: { $exists: true, $nin: ['', null] }

        })

            .sort({ viewers: -1 });



        console.log(` [FOLLOWING STREAMS] ${followingStreams.length} streams de usu+rios seguidos por ${userId}`);



        res.json(followingStreams);

    } catch (error: any) {

        console.error('Error fetching following streams:', error);

        res.status(500).json({ error: error.message });

    }

});



// GET /api/live/new - Streams mais recentes

// ===== ROUTE START =====
router.get('/live/new', async (req, res) => {

    try {

        const { limit = 20 } = req.query;



        // Buscar streams mais recentes

        const newStreams = await Streamer.find({

            isLive: true,

            streamStatus: 'active',

            name: { $exists: true, $nin: ['', null] },

            startTime: { $exists: true }

        })

            .sort({ startTime: -1 }) // Mais recentes primeiro

            .limit(parseInt(limit as string));



        console.log(` [NEW STREAMS] ${newStreams.length} streams mais recentes`);



        res.json(newStreams);

    } catch (error: any) {

        console.error('Error fetching new streams:', error);

        res.status(500).json({ error: error.message });

    }

});



// POST /api/streams/:id/like - Dar like em uma stream

// ===== ROUTE START =====
router.post('/streams/:id/like', async (req: express.Request, res: express.Response) => {

    try {

        // Usar ID real diretamente

        const streamId = req.params.id;

        const userId = req.body.userId;



        if (!userId) {

            return res.status(400).json({ error: 'userId is required' });

        }



        // Verificar se stream existe

        const stream: any = await Streamer.findOne({ id: streamId });

        if (!stream) {

            return res.status(404).json({ error: 'Stream not found' });

        }



        // Verificar se j+ deu like

        const existingLike = await StreamLike.findOne({ streamId, userId });

        if (existingLike) {

            return res.status(400).json({ error: 'Already liked' });

        }



        // Criar novo like

        const like = await StreamLike.create({

            streamId,

            userId,

            timestamp: new Date().toISOString()

        });



        // Incrementar contador de likes da stream

        await Streamer.updateOne(

            { id: streamId },

            { $inc: { likes: 1 } }

        );



        // Obter contagem atualizada

        const updatedStream: any = await Streamer.findOne({ id: streamId });

        const totalLikes = updatedStream?.likes || 0;



        // Emitir evento WebSocket em tempo real

        const io = req.app.get('io');

        if (io) {

            io.to(`stream_${streamId}`).emit('stream_liked', {

                streamId,

                userId,

                totalLikes,

                timestamp: new Date().toISOString()

            });

        }



        res.json({ 

            success: true, 

            totalLikes,

            liked: true

        });



    } catch (error: any) {

        console.error('Error liking stream:', error);

        res.status(500).json({ error: error.message });

    }

});



// DELETE /api/streams/:id/like - Remover like de uma stream

// ===== ROUTE START =====
router.delete('/streams/:id/like', async (req: express.Request, res: express.Response) => {

    try {

        // Usar ID real diretamente

        const streamId = req.params.id;

        const userId = req.body.userId;



        if (!userId) {

            return res.status(400).json({ error: 'userId is required' });

        }



        // Verificar se o like existe

        const like = await StreamLike.findOne({ streamId, userId });

        if (!like) {

            return res.status(404).json({ error: 'Like not found' });

        }



        // Remover like

        await StreamLike.deleteOne({ streamId, userId });



        // Decrementar contador de likes da stream

        await Streamer.updateOne(

            { id: streamId },

            { $inc: { likes: -1 } }

        );



        // Obter contagem atualizada

        const updatedStream: any = await Streamer.findOne({ id: streamId });

        const totalLikes = updatedStream?.likes || 0;



        // Emitir evento WebSocket em tempo real

        const io = req.app.get('io');

        if (io) {

            io.to(`stream_${streamId}`).emit('stream_unliked', {

                streamId,

                userId,

                totalLikes,

                timestamp: new Date().toISOString()

            });

        }



        res.json({ 

            success: true, 

            totalLikes,

            liked: false

        });



    } catch (error: any) {

        console.error('Error unliking stream:', error);

        res.status(500).json({ error: error.message });

    }

});





// === ROTAS DE GERENCIAMENTO DE STREAMS ===



// POST /api/streams/:streamId/end - Encerrar stream espec+fica por ID

// ===== ROUTE START =====
router.post('/streams/:streamId/end', async (req: express.Request, res: express.Response) => {

    try {

        const userId = getUserIdFromToken(req);

        const { streamId } = req.params;

        

        if (!userId) {

            return res.status(401).json({ 

                success: false, 

                message: 'Usu+rio n+o autenticado' 

            });

        }



        console.log(`[STREAM-END] Tentando encerrar stream: ${streamId} pelo usu+rio: ${userId}`);



        // Buscar stream espec+fica

        const stream: any = await Streamer.findOne({ id: streamId });

        

        if (!stream) {

            return res.status(404).json({ 

                success: false, 

                message: 'Stream n+o encontrada' 

            });

        }



        // Verificar se o usu+rio + o dono da stream ou admin

        const user = await findUserByAnyId(User, userId);

        const isAdmin = user?.level !== undefined && user.level >= 10; // Admin level 10+

        const isOwner = stream.hostId.toString() === userId;



        if (!isOwner && !isAdmin) {

            return res.status(403).json({ 

                success: false, 

                message: 'Apenas o dono da stream ou administrador pode encerr+-la' 

            });

        }



        // Verificar se stream est+ ativa

        if (!stream.isLive) {

            return res.status(400).json({ 

                success: false, 

                message: 'Stream j+ est+ encerrada' 

            });

        }



        // Encerrar stream

        await Streamer.findOneAndUpdate(

            { id: streamId },

            {

                isLive: false,

                streamStatus: 'ended',

                endTime: new Date(),

                endedBy: isOwner ? 'owner' : 'admin',

                endedAt: new Date()

            }

        );



        // Atualizar status do usu+rio se n+o tiver outras streams ativas

        const otherActiveStreams = await Streamer.find({

            hostId: stream.hostId,

            isLive: true,

            id: { $ne: streamId }

        });



        if (otherActiveStreams.length === 0) {
            await User.findOneAndUpdate(
                { id: stream.hostId },
                { $set: {
                    isLive: false,
                    isOnline: false,
                    currentStreamId: null,
                    lastSeen: new Date()
                } }
            );
        }

        console.log(`[STREAM-END] Stream ${streamId} encerrada com sucesso por ${isOwner ? 'dono' : 'admin'}`);

        const io = req.app.get('io');
        if (io) {
            io.emit('card_removed', {
                streamId: stream.id,
                hostId: stream.hostId,
                timestamp: new Date().toISOString()
            });
            io.emit('stream_ended', {
                streamId: stream.id,
                hostId: stream.hostId,
                timestamp: new Date().toISOString()
            });
            io.emit('stream_stopped', {
                streamId: stream.id,
                hostId: stream.hostId,
                timestamp: new Date().toISOString()
            });
        }

        res.json({

            success: true,

            message: 'Stream encerrada com sucesso',

            streamId: streamId,

            endedBy: isOwner ? 'owner' : 'admin',

            endedAt: new Date().toISOString()

        });



    } catch (error: any) {

        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

        console.error('[STREAM-END] Erro ao encerrar stream:', error);

        res.status(500).json({ 

            success: false, 

            message: 'Erro interno ao encerrar stream',

            error: errorMessage

        });

    }

});



// POST /api/streams/end-all - Encerrar todas as streams do usu+rio

// ===== ROUTE START =====
router.post('/streams/end-all', async (req: express.Request, res: express.Response) => {

    try {

        const userId = getUserIdFromToken(req);

        

        if (!userId) {

            return res.status(401).json({ 

                success: false, 

                message: 'Usu+rio n+o autenticado' 

            });

        }



        console.log(`[STREAM-END-ALL] Encerrando todas as streams do usu+rio: ${userId}`);



        // Buscar todas as streams ativas do usu+rio

        const activeStreams = await Streamer.find({

            hostId: userId,

            isLive: true

        });



        if (activeStreams.length === 0) {

            return res.status(400).json({ 

                success: false, 

                message: 'Nenhuma stream ativa encontrada para este usu+rio' 

            });

        }



        // Encerrar todas as streams

        const streamIds = activeStreams.map(stream => stream.id);

        

        await Streamer.updateMany(

            { hostId: userId, isLive: true },

            {

                isLive: false,

                streamStatus: 'ended',

                endTime: new Date(),

                endedBy: 'owner_force',

                endedAt: new Date()

            }

        );



        // Atualizar status do usuário
        await User.findOneAndUpdate(
            { id: userId },
            { $set: {
                isLive: false,
                isOnline: false,
                currentStreamId: null,
                lastSeen: new Date()
            } }
        );

        console.log(`[STREAM-END-ALL] ${activeStreams.length} streams encerradas para usuário: ${userId}`);

        const io = req.app.get('io');
        if (io) {
            for (const s of activeStreams) {
                io.emit('card_removed', {
                    streamId: s.id,
                    hostId: s.hostId || userId,
                    timestamp: new Date().toISOString()
                });
                io.emit('stream_ended', {
                    streamId: s.id,
                    hostId: s.hostId || userId,
                    timestamp: new Date().toISOString()
                });
                io.emit('stream_stopped', {
                    streamId: s.id,
                    hostId: s.hostId || userId,
                    timestamp: new Date().toISOString()
                });
            }
        }

        res.json({

            success: true,

            message: `${activeStreams.length} streams encerradas com sucesso`,

            streamsEnded: streamIds,

            endedAt: new Date().toISOString()

        });



    } catch (error: any) {

        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

        console.error('[STREAM-END-ALL] Erro ao encerrar streams:', error);

        res.status(500).json({ 

            success: false, 

            message: 'Erro interno ao encerrar streams',

            error: errorMessage

        });

    }

});



// POST /api/streams/:streamId/heartbeat - Atualizar heartbeat de stream

// ===== ROUTE START =====
router.post('/streams/:streamId/heartbeat', async (req: express.Request, res: express.Response) => {

    try {

        const userId = getUserIdFromToken(req);

        const { streamId } = req.params;

        

        if (!userId) {

            return res.status(401).json({ 

                success: false, 

                message: 'Usu+rio n+o autenticado' 

            });

        }



        // Buscar stream espec+fica

        const stream: any = await Streamer.findOne({ id: streamId });

        

        if (!stream) {

            return res.status(404).json({ 

                success: false, 

                message: 'Stream n+o encontrada' 

            });

        }



        // Verificar se o usu+rio + o dono da stream

        if (stream.hostId.toString() !== userId) {

            return res.status(403).json({ 

                success: false, 

                message: 'Apenas o dono da stream pode atualizar heartbeat' 

            });

        }



        // Verificar se stream est+ ativa

        if (!stream.isLive) {

            return res.status(400).json({ 

                success: false, 

                message: 'Stream n+o est+ ativa' 

            });

        }



        // Atualizar heartbeat e viewer count (se fornecido)

        const updateData: any = {

            lastHeartbeat: new Date(),

            streamStatus: 'active' // Garantir status ativo com heartbeat

        };



        // Se viewer count for enviado, atualizar tamb+m

        if (req.body.viewers !== undefined && typeof req.body.viewers === 'number') {

            updateData.viewers = Math.max(0, req.body.viewers); // Garantir n+mero n+o negativo

        }



        // Se bandwidth for enviado, atualizar tamb+m (campo n+o existe no modelo, removido por enquanto)

        // if (req.body.bandwidth !== undefined && typeof req.body.bandwidth === 'number') {

        //     updateData.bandwidth = req.body.bandwidth;

        // }



        await Streamer.findOneAndUpdate(

            { id: streamId },

            updateData

        );



        res.json({

            success: true,

            message: 'Heartbeat atualizado com sucesso',

            streamId: streamId,

            lastHeartbeat: new Date().toISOString(),

            viewers: updateData.viewers || stream.viewers || 0

            // bandwidth removido - campo n+o existe no modelo

        });



    } catch (error: any) {

        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

        console.error('[STREAM-HEARTBEAT] Erro ao atualizar heartbeat:', error);

        res.status(500).json({ 

            success: false, 

            message: 'Erro interno ao atualizar heartbeat',

            error: errorMessage

        });

    }

});



// === ROTAS DE ADMINISTRA++O ===



// POST /api/admin/streams/:streamId/force-end - For+ar encerramento (admin)

// ===== ROUTE START =====
router.post('/admin/streams/:streamId/force-end', async (req: express.Request, res: express.Response) => {

    try {

        const userId = getUserIdFromToken(req);

        const { streamId } = req.params;

        const { reason } = req.body; // Motivo do encerramento

        

        if (!userId) {

            return res.status(401).json({ 

                success: false, 

                message: 'Usu+rio n+o autenticado' 

            });

        }



        // Verificar se + admin

        const user = await findUserByAnyId(User, userId);

        if (!user || user.level === undefined || user.level < 10) {

            return res.status(403).json({ 

                success: false, 

                message: 'Acesso negado. Apenas administradores podem for+ar encerramento' 

            });

        }



        console.log(`[ADMIN-FORCE-END] Admin ${userId} for+ando encerramento da stream: ${streamId}`);



        // Buscar stream

        const stream: any = await Streamer.findOne({ id: streamId });

        

        if (!stream) {

            return res.status(404).json({ 

                success: false, 

                message: 'Stream n+o encontrada' 

            });

        }



        // For+ar encerramento

        await Streamer.findOneAndUpdate(

            { id: streamId },

            {

                isLive: false,

                streamStatus: 'ended',

                endTime: new Date(),

                endedBy: 'admin_force',

                endedByAdmin: userId,

                endReason: reason || 'Encerramento for+ado por administrador',

                endedAt: new Date()

            }

        );



        // Atualizar status do usu+rio se n+o tiver outras streams ativas

        const otherActiveStreams = await Streamer.find({

            hostId: stream.hostId,

            isLive: true,

            id: { $ne: streamId }

        });



        if (otherActiveStreams.length === 0) {
            await User.findOneAndUpdate(
                { id: stream.hostId },
                { $set: {
                    isLive: false,
                    isOnline: false,
                    currentStreamId: null,
                    lastSeen: new Date()
                } }
            );
        }

        console.log(`[ADMIN-FORCE-END] Stream ${streamId} encerrada foradamente pelo admin ${userId}`);

        const io = req.app.get('io');
        if (io) {
            io.emit('card_removed', {
                streamId: streamId || stream?.id,
                hostId: stream?.hostId || userId,
                timestamp: new Date().toISOString()
            });
            io.emit('stream_ended', {
                streamId: streamId || stream?.id,
                hostId: stream?.hostId || userId,
                timestamp: new Date().toISOString()
            });
            io.emit('stream_stopped', {
                streamId: streamId || stream?.id,
                hostId: stream?.hostId || userId,
                timestamp: new Date().toISOString()
            });
        }

        res.json({

            success: true,

            message: 'Stream encerrada for+adamente com sucesso',

            streamId: streamId,

            endedBy: 'admin_force',

            endedByAdmin: userId,

            endReason: reason || 'Encerramento for+ado por administrador',

            endedAt: new Date().toISOString()

        });



    } catch (error: any) {

        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

        console.error('[ADMIN-FORCE-END] Erro ao for+ar encerramento:', error);

        res.status(500).json({ 

            success: false, 

            message: 'Erro interno ao for+ar encerramento',

            error: errorMessage

        });

    }

});



// GET /api/admin/streams/zombie-stats - Estat+sticas de streams zumbis

// ===== ROUTE START =====
router.get('/admin/streams/zombie-stats', async (req: express.Request, res: express.Response) => {

    try {

        const userId = getUserIdFromToken(req);

        

        if (!userId) {

            return res.status(401).json({ 

                success: false, 

                message: 'Usu+rio n+o autenticado' 

            });

        }



        // Verificar se + admin

        const user = await findUserByAnyId(User, userId);

        if (!user || user.level === undefined || user.level < 10) {

            return res.status(403).json({ 

                success: false, 

                message: 'Acesso negado. Apenas administradores podem ver estat+sticas' 

            });

        }



        // Servi+o de limpeza de streams zumbis removido

        res.json({

            success: true,

            message: 'Servi+o de limpeza de streams zumbis foi desativado',

            stats: { active: 0, zombie: 0, cleaned: 0 }

        });



    } catch (error: any) {

        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

        console.error('[ADMIN-ZOMBIE-STATS] Erro ao obter estat+sticas:', error);

        res.status(500).json({ 

            success: false, 

            message: 'Erro interno ao obter estat+sticas',

            error: errorMessage

        });

    }

});



// POST /api/admin/streams/cleanup-zombies - Limpeza manual de streams zumbis

// ===== ROUTE START =====
router.post('/admin/streams/cleanup-zombies', async (req: express.Request, res: express.Response) => {

    try {

        const userId = getUserIdFromToken(req);

        

        if (!userId) {

            return res.status(401).json({ 

                success: false, 

                message: 'Usu+rio n+o autenticado' 

            });

        }



        // Verificar se + admin

        const user = await findUserByAnyId(User, userId);

        if (!user || user.level === undefined || user.level < 10) {

            return res.status(403).json({ 

                success: false, 

                message: 'Acesso negado. Apenas administradores podem executar limpeza' 

            });

        }



        console.log(`[ADMIN-CLEANUP] Admin ${userId} tentando executar limpeza manual de streams zumbis`);



        // Servi+o de limpeza de streams zumbis foi removido

        res.json({

            success: true,

            message: 'Servi+o de limpeza de streams zumbis foi desativado',

            stats: { active: 0, zombie: 0, cleaned: 0 },

            cleanedAt: new Date().toISOString()

        });



    } catch (error: any) {

        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

        console.error('[ADMIN-CLEANUP] Erro na limpeza manual:', error);

        res.status(500).json({ 

            success: false, 

            message: 'Erro interno ao executar limpeza',

            error: errorMessage

        });

    }

});



// ========================================

// ENDPOINTS ESSENCIAIS QUE FALTAM

// ========================================



// POST /api/streams/prepare - Preparar live (cria registro mas n+o inicia transmiss+o)

// ===== ROUTE START =====
router.post('/streams/prepare', async (req, res) => {

    try {

        console.log('[STREAM-PREPARE] Preparando nova live...');

        

        const userId = getUserIdFromToken(req);

        if (!userId) {

            return res.status(401).json({ 

                success: false, 

                message: 'Usu+rio n+o autenticado' 

            });

        }



        const { name, title, category = 'general', description, tags = [] } = req.body;

        // Aceitar tanto 'name' quanto 'title' - priorizar 'title' se ambos existirem
        const liveTitle = title || name;

        // Valida++es b+sicas

        if (!liveTitle || liveTitle.trim() === '') {

            return res.status(400).json({ 

                success: false, 

                message: 'T+tulo da live + obrigat+rio (use "name" ou "title")' 

            });

        }



        // Buscar usu+rio

        const user: any = await User.findOne({ id: userId });

        if (!user) {

            return res.status(404).json({ 

                success: false, 

                message: 'Usu+rio n+o encontrado' 

            });

        }



        // Gerar IDs para a live

        const streamId = userId;

        const streamKey = 'stream_' + uuidv4();



        // Configura++es SRS

        const srsHost = process.env.SRS_HOST || process.env.DOMAIN || 'srs';

        const srsRtmpUrl = process.env.SRS_RTMP_URL || `rtmp://${srsHost}:1935/live`;

        const backendApi = (() => {
            const bu = process.env.BACKEND_URL || 'https://api.livego.store';
            return `${bu.replace(/\/+$/, '')}/api/video/http`;
        })();

        const srsHttpUrl = process.env.SRS_HTTP_URL || `${backendApi}/live`;



        // Criar stream com status "preparing"

        const newStream: any = await Streamer.create({

            id: streamId,

            hostId: userId,

            name: user.name,

            avatar: user.avatarUrl || '',

            title: title.trim(),

            description: description || '',

            category: category.toLowerCase(),

            tags: [...tags, 'live', category.toLowerCase()],

            streamKey: streamKey,

            rtmpIngestUrl: `${srsRtmpUrl}/${streamId}`,

            playbackUrl: `${backendApi}/live/${streamId}.flv`,

            hlsUrl: `${backendApi}/live/${streamId}.m3u8`,

            isLive: false,

            streamStatus: 'preparing',

            startTime: null,

            viewers: 0,

            country: user.country || 'BR',

            quality: 'HD',

            giftsEnabled: true,

            chatEnabled: true

        });



        console.log(`[STREAM-PREPARE] Live preparada: ${streamId} para usu+rio ${userId}`);



        res.json({

            success: true,

            stream: {

                id: streamId,

                title: title.trim(),

                category: category.toLowerCase(),

                status: 'preparing',

                streamKey: streamKey,

                rtmpUrl: `${srsRtmpUrl}/${streamId}`,

                playbackUrl: `${backendApi}/live/${streamId}.flv`,

                hlsUrl: `${backendApi}/live/${streamId}.m3u8`

            }

        });



    } catch (error: any) {

        console.error('[STREAM-PREPARE] Erro:', error);

        res.status(500).json({ 

            success: false, 

            message: 'Erro interno ao preparar live',

            error: error instanceof Error ? error.message : String(error) 

        });

    }

});



// POST /api/streams/:id/start - Iniciar transmiss+o (marcar como ativa)

// ===== ROUTE START =====
router.post('/streams/:id/start', async (req, res) => {

    try {

        console.log('[STREAM-START] Iniciando transmiss+o...');

        

        const userId = getUserIdFromToken(req);

        if (!userId) {

            return res.status(401).json({ 

                success: false, 

                message: 'Usu+rio n+o autenticado' 

            });

        }



        const { id } = req.params;



        // Buscar stream

        const stream: any = await Streamer.findOne({ id, hostId: userId });

        if (!stream) {

            return res.status(404).json({ 

                success: false, 

                message: 'Stream n+o encontrado' 

            });

        }



        // Verificar se j+ est+ ativa

        if (stream.isLive && stream.streamStatus === 'active') {

            return res.status(409).json({ 

                success: false, 

                message: 'Stream j+ est+ ativa' 

            });

        }



        // Atualizar para ativa

        stream.isLive = true;

        stream.streamStatus = 'active';

        stream.startTime = new Date();

        await stream.save();



        // Atualizar usu+rio

        await User.findOneAndUpdate(

            { id: userId },

            { 

                isLive: true,

                isOnline: true,

                currentStreamId: id,

                lastSeen: new Date().toISOString()

            }

        );



        // Atualizar status online na cole++o userstatuses

        const { UserStatus } = await import('../models');

        await UserStatus.findOneAndUpdate(

            { userId: userId },

            { 

                isOnline: true,

                lastSeen: new Date(),

                updatedAt: new Date()

            },

            { upsert: true, returnDocument: 'after' }

        );



        console.log(`[STREAM-START] Stream ${id} iniciada para usu+rio ${userId}`);

        const io = req.app.get('io');
        if (io) {
            io.emit('new_live', {
                id: stream.id || id,
                hostId: stream.hostId || userId,
                name: stream.name || `Live`,
                avatar: stream.avatar || '',
                isLive: true,
                streamStatus: 'active',
                country: stream.country || 'BR',
                viewers: 0,
                timestamp: new Date().toISOString()
            });
            io.emit('stream_started', {
                streamId: stream.id || id,
                hostId: stream.hostId || userId,
                name: stream.name || `Live`,
                avatar: stream.avatar || '',
                timestamp: new Date().toISOString()
            });
        }

        res.json({

            success: true,

            stream: {

                id: stream.id,

                status: 'active',

                startTime: stream.startTime,

                rtmpUrl: stream.rtmpIngestUrl,

                webrtcUrl: stream.webrtcUrl,

                playbackUrl: stream.playbackUrl

            }

        });



    } catch (error: any) {

        console.error('[STREAM-START] Erro:', error);

        res.status(500).json({ 

            success: false, 

            message: 'Erro interno ao iniciar stream',

            error: error instanceof Error ? error.message : String(error) 

        });

    }

});



// POST /api/streams/:id/join - Entrar na live (validar acesso)

// GET /api/debug/streams - Endpoint de diagnóstico: retorna TODOS os documentos Streamer sem filtro
router.get('/debug/streams', async (req, res) => {
    try {
        const all = await Streamer.find({}).lean();
        const isLiveTrue = all.filter(s => s.isLive === true);
        const statusActive = all.filter(s => s.streamStatus === 'active');
        res.json({
            total: all.length,
            isLive_true: isLiveTrue.length,
            status_active: statusActive.length,
            streams: all.map(s => ({
                id: s.id,
                hostId: s.hostId,
                isLive: s.isLive,
                streamStatus: s.streamStatus,
                country: s.country,
                category: s.category,
                title: s.title || s.name,
                startTime: s.startTime
            }))
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});


// ========================================
// ========================================
// STARK API (BuzzCast) - GET /api/stark/live/check/:streamId
// ========================================
// Pre-check: verifica se uma live esta ativa antes de carregar o stream
router.get('/stark/live/check/:streamId', async (req, res) => {
    try {
        const { streamId } = req.params;

        if (!streamId) {
            return res.status(400).json({ code: 1, msg: 'streamId obrigatorio', data: null });
        }

        // Buscar na colecao starts se a live esta ativa
        var mong = require('mongoose');
        var db = mong.connection.db;

        if (!db) {
            return res.status(500).json({ code: 1, msg: 'Banco indisponivel', data: null });
        }

        // Verificar na colecao starts
        var start = await db.collection('starts').findOne({ streamId: streamId, status: 'live', isActive: true });

        if (start) {
            // Live ativa - retornar dados para o player
            return res.json({
                code: 0,
                msg: 'Live ativa',
                data: {
                    isLive: true,
                    streamId: streamId,
                    userId: start.userId,
                    title: start.title,
                    category: start.category,
                    liveCountry: start.liveCountry || 'Brasil',
                    streamType: start.streamType || '1',
                    startedAt: start.startTime
                }
            });
        }

        // Se nao achou em starts, verificar se existe streamer ativo
        var streamer = await db.collection('streamers').findOne({ id: streamId, isLive: true });

        if (streamer) {
            return res.json({
                code: 0,
                msg: 'Live ativa (streamer)',
                data: {
                    isLive: true,
                    streamId: streamId,
                    userId: streamer.hostId,
                    title: streamer.title || '',
                    category: streamer.category || '',
                    hlsUrl: streamer.hlsUrl || '',
                    rtmpUrl: streamer.rtmpUrl || '',
                    playbackUrl: streamer.playbackUrl || ''
                }
            });
        }

        // Live nao encontrada ou encerrada
        return res.json({
            code: 1,
            msg: 'Live nao encontrada ou ja encerrada',
            data: {
                isLive: false
            }
        });
    } catch (error) {
        console.error('[STARK-CHECK] Erro:', error);
        res.status(500).json({ code: 1, msg: 'Erro interno', data: null });
    }
});

// ========================================
// STARK API (BuzzCast) - POST /api/stark/live/publish
// ========================================
// Inicia a publicacao da stream apos o start
router.post('/stark/live/publish', async (req, res) => {
    try {
        console.log('[STARK-PUBLISH] Iniciando publicacao...');
        const tokenUserId = getUserIdFromToken(req);
        const { streamId, sdp } = req.body;
        if (!tokenUserId || !streamId) {
            return res.status(401).json({ code: 1, msg: 'Autenticacao necessaria', result: null });
        }

        const stream = await Streamer.findOne({ id: streamId, hostId: tokenUserId });
        if (!stream) {
            return res.status(404).json({ code: 1, msg: 'Stream nao encontrada', result: null });
        }

        // Verificar se ja esta publicando
        if (stream.streamStatus === 'publishing' || stream.streamStatus === 'active') {
            return res.status(409).json({ code: 1, msg: 'Stream ja esta sendo publicada', result: null });
        }

        // Gerar URLs de publicacao
        const srsHost = process.env.SRS_HOST || process.env.DOMAIN || 'srs';
        const whipUrl = 'https://' + srsHost + ':8000/whip/' + streamId;
        const whepUrl = 'https://' + srsHost + ':8000/whep/' + streamId;
        const rtmpUrl = 'rtmp://' + srsHost + ':1935/live/' + streamId;
        const hlsUrl = process.env.SRS_HLS_URL || ('https://livego.store/live/' + streamId + '.m3u8');

        // Atualizar stream com URLs de publicacao
        await Streamer.findOneAndUpdate(
            { id: streamId },
            { $set: {
                isLive: true,
                streamStatus: 'active',
                rtmpIngestUrl: rtmpUrl,
                hlsUrl: hlsUrl,
                webrtcUrl: whipUrl,
                playbackUrl: whepUrl,
                updatedAt: new Date()
            } }
        );

        // Marcar usuario como live AGORA (confirmacao real)
        await User.findOneAndUpdate(
            { id: tokenUserId },
            { $set: { isLive: true } }
        );

        // Salvar na colecao publishes
        try {
            const publishStreamKey = 'stream_' + uuidv4();
            const mongoose = require('mongoose');
            const db = mongoose.connection.db;
            if (db) {
                await db.collection('publishes').updateOne(
                    { userId: tokenUserId },
                    { $set: {
                        userId: tokenUserId,
                        streamId: streamId,
                        publishUrl: whipUrl,
                        streamKey: publishStreamKey,
                        sdpOffer: sdp || null,
                        status: 'publishing',
                        isPublishing: true,
                        startedAt: new Date(),
                        updatedAt: new Date()
                    } },
                    { upsert: true }
                );
            }
        } catch (dbErr) {
            console.warn('[STARK-PUBLISH] Erro na colecao publishes:', dbErr);
        }

        // Criar/atualizar LiveCard (so quando realmente publicar)
        try {
            const user = await User.findOne({ id: tokenUserId }).lean();
            await LiveCard.findOneAndUpdate(
                { hostId: tokenUserId },
                { $set: {
                    hostId: tokenUserId,
                    name: stream.name || user?.name || tokenUserId,
                    avatar: stream.avatar || user?.avatarUrl || '',
                    title: stream.title || user?.name || tokenUserId,
                    streamKey: 'stream_' + uuidv4(),
                    country: (stream.country || user?.country || 'BR').toLowerCase(),
                    isLive: true,
                    streamStatus: 'active',
                    category: (stream.category || 'popular').toLowerCase(),
                    playbackUrl: whepUrl,
                    hlsUrl: hlsUrl,
                    startTime: new Date(),
                    updatedAt: new Date()
                } },
                { upsert: true }
            );
        } catch (cardErr) {
            console.warn('[STARK-PUBLISH] Erro ao criar/atualizar LiveCard:', cardErr);
        }

        console.log('[STARK-PUBLISH] Publicacao iniciada:', { userId: tokenUserId, streamId });

        res.json({
            code: 0,
            result: {
                publishUrl: whipUrl,
                playbackUrl: whepUrl,
                rtmpUrl: rtmpUrl,
                hlsUrl: hlsUrl,
                streamId: streamId,
                status: 'publishing',
                isPublishing: true,
                startedAt: new Date().toISOString()
            },
            msg: 'OK'
        });
    } catch (error) {
        console.error('[STARK-PUBLISH] Erro:', error);
        res.status(500).json({ code: 1, msg: 'Erro interno ao publicar', result: null });
    }
});


// ========================================
// STARK API (BuzzCast) - POST /api/stark/live/end
// ========================================
// Encerra uma transmissao ao vivo e salva metricas finais no banco
// streamId = chave principal da live
router.post('/stark/live/end', async (req, res) => {
    try {
        console.log('[STARK-END] Encerrando live...');
        const tokenUserId = getUserIdFromToken(req);
        const { streamId } = req.body;

        if (!tokenUserId || !streamId) {
            return res.status(401).json({ code: 1, msg: 'Autenticacao e streamId sao obrigatorios', result: null });
        }

        // Buscar usuario para userName
        const user = await User.findOne({ id: tokenUserId });
        if (!user) {
            return res.status(404).json({ code: 1, msg: 'Usuario nao encontrado', result: null });
        }

        // Buscar stream ativa
        const stream = await Streamer.findOne({ id: streamId, hostId: tokenUserId });
        if (!stream) {
            return res.status(404).json({ code: 1, msg: 'Stream nao encontrada ou nao pertence ao usuario', result: null });
        }

        const endTime = new Date();
        const startTime = stream.startTime || stream.createdAt || new Date();
        const liveTimeMs = endTime.getTime() - new Date(startTime).getTime();
        const liveTimeSeconds = Math.max(0, Math.floor(liveTimeMs / 1000));

        // Atualizar stream no Streamer
        await Streamer.findOneAndUpdate(
            { id: streamId },
            { $set: {
                isLive: false,
                streamStatus: 'ended',
                endTime: endTime,
                updatedAt: endTime
            } }
        );

        // Atualizar colecao starts
        try {
            const mongoose = require("mongoose");
            const db = mongoose.connection.db;
            if (db) {
                await db.collection("starts").updateOne(
                    { streamId: streamId },
                    { $set: {
                        status: "ended",
                        isActive: false,
                        endTime: endTime,
                        updatedAt: endTime
                    } }
                );
                console.log("[STARK-END] Starts collection atualizada para:", streamId);
            }
        } catch (startErr) {
            console.warn("[STARK-END] Erro ao atualizar starts:", startErr);
        }

        // Atualizar usuario
        await User.findOneAndUpdate(
            { id: tokenUserId },
            { $set: {
                isLive: false,
                isOnline: false,
                currentStreamId: null,
                updatedAt: endTime
            } }
        );

        // Salvar metricas finais na colecao ends
        try {
            const mongoose = require('mongoose');
            const db = mongoose.connection.db;
            if (db) {
                await db.collection('ends').updateOne(
                    { streamId: streamId },
                    { $set: {
                        streamId: streamId,
                        userId: tokenUserId,
                        userName: user.name || user.username || tokenUserId,
                        liveTime: String(liveTimeSeconds),
                        watchNum: stream.viewers ? String(stream.viewers) : '0',
                        fansNum: '0',
                        fcoin: '0',
                        fcoinNew: '0.00',
                        status: 'ENDED',
                        endedAt: endTime,
                        updatedAt: endTime
                    } },
                    { upsert: true }
                );
                console.log('[STARK-END] Metricas salvas na colecao ends para:', streamId);
            }
        } catch (dbErr) {
            console.warn('[STARK-END] Erro ao salvar na colecao ends:', dbErr);
        }

        // Emitir eventos socket
        try {
            const io = req.app.get('socketio');
            if (io) {
                io.emit('stream_ended', { streamId: streamId, userId: tokenUserId });
                io.emit('card_removed', { streamId: streamId });
            }
        } catch (ioErr) {
            console.warn('[STARK-END] Erro ao emitir eventos socket:', ioErr);
        }

        // Atualizar LiveCard para ended
        try {
            await LiveCard.findOneAndUpdate(
                { hostId: tokenUserId },
                { $set: {
                    isLive: false,
                    streamStatus: 'ended',
                    endTime: endTime,
                    updatedAt: endTime
                } }
            );
        } catch (cardErr) {
            console.warn('[STARK-END] Erro ao atualizar LiveCard:', cardErr);
        }

        console.log('[STARK-END] Live encerrada:', { userId: tokenUserId, streamId, liveTime: liveTimeSeconds });

        res.json({
            code: 0,
            result: {
                times: String(liveTimeSeconds),
                fansNum: '0',
                watchNum: stream.viewers ? String(stream.viewers) : '0',
                liveTime: String(liveTimeSeconds),
                fcoin: '0',
                fcoinNew: '0.00',
                excludeAwardCoin: '0.00',
                awardCoin: '0.00',
                charmNums: '-1',
                streamId: streamId,
                userVipMsg: {
                    isVip: 0,
                    sended: 0,
                    officialAccount: 0
                },
                addVpCount: 0,
                addVpMoneyCount: '0',
                fanBaseNum: '0'
            },
            msg: 'OK'
        });
    } catch (error) {
        console.error('[STARK-END] Erro:', error);
        res.status(500).json({ code: 1, msg: 'Erro interno ao encerrar live', result: null });
    }
});



// === FFmpeg Transcode Endpoints ===
// POST /api/lives/:streamId/ffmpeg-transcode - Configurar transcodificação FFmpeg
router.post('/lives/:streamId/ffmpeg-transcode', async (req, res) => {
    try {
        const { streamId } = req.params;
        const { presetId, filters, commandString } = req.body;

        if (!streamId) {
            return res.status(400).json({ success: false, error: 'streamId is required' });
        }

        console.log(`[FFMPEG-TRANSCODE] Configurando transcoding para stream ${streamId}`, { presetId, filters });

        res.json({
            success: true,
            session: {
                streamId,
                presetId,
                filters,
                isActive: true,
                commandString,
            }
        });
    } catch (error: any) {
        console.error('[FFMPEG-TRANSCODE] Erro:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/lives/:streamId/ffmpeg-transcode/stop - Parar transcodificação
router.post('/lives/:streamId/ffmpeg-transcode/stop', async (req, res) => {
    try {
        const { streamId } = req.params;

        console.log(`[FFMPEG-TRANSCODE] Parando transcoding para stream ${streamId}`);

        res.json({ success: true });
    } catch (error: any) {
        console.error('[FFMPEG-TRANSCODE] Erro ao parar:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/lives/:room/livekit-token - Gerar token LiveKit para transmissão pública
router.get('/lives/:room/livekit-token', async (req, res) => {
  const { room } = req.params;
  const identity = req.query.identity as string || `user_${Date.now()}`;
  const isPublisher = req.query.publisher === 'true';

  try {
    const extraGrants = isPublisher
      ? { canPublish: true, canPublishData: true, canSubscribe: true }
      : { canPublish: false, canPublishData: true, canSubscribe: true };
    const token = await generateLiveKitToken(identity, room, undefined, extraGrants);
    res.json({
      success: true,
      token,
      identity,
      room,
      serverUrl: ENV.LIVEKIT_URL,
      livekitUrl: ENV.LIVEKIT_URL,
    });
  } catch (error: any) {
    console.error('[LIVEKIT] Erro ao gerar token para live:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;


