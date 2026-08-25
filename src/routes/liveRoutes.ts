// @ts-nocheck
import express from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../config/db';
import { v4 as uuidv4 } from 'uuid';
import { Streamer, User, Message, Followers, Friendship, Block, UserLevel, StreamKeyAssociation, GiftTransaction, StreamLike, Battle, LiveCard, LiveMessage } from '../models/index';
import { getUserIdFromToken, generateJWT } from '../middleware/auth';
import { ResponseHelper } from '../middleware/responseHelper';
import { ENV } from '../config/env';
import { isTranscodeVariant, TRANSCODE_VARIANT_REGEX } from '../utils/streamKeyUtils';
import { autoEndStreamOnDisconnect } from '../services/streamEndService';
import { emitWebhook } from '../services/WebhookBroadcasterService';

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

// Auto-encerramento: janela de reconexão (ms) após on_unpublish antes de encerrar a live
const SRS_HOOK_RECONNECT_MS = 15000;
const srsHookReconnectTimers = new Map<string, NodeJS.Timeout>();

function resolveAvatar(user: any): string {
  if (!user) return DEFAULT_AVATAR;
  if (user.avatarUrl && user.avatarUrl.trim() !== '') return user.avatarUrl;
  if (user.name && user.name.trim() !== '') {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=7c3aed&color=fff&size=100`;
  }
  return DEFAULT_AVATAR;
}

// 🧹 Chat morre junto com a transmissão: apaga TODAS as mensagens da stream.
// Chamado em todas as rotas de encerramento para que a próxima live
// comece com o chat 100% vazio (nenhuma mensagem da transmissão anterior permanece).
async function clearLiveChat(streamId: string) {
    if (!streamId) return;
    try {
        const result = await LiveMessage.deleteMany({ streamId: String(streamId) });
        console.log(`[CHAT-CLEAR] 🧹 Chat apagado da stream ${streamId}: ${result?.deletedCount ?? 0} mensagens`);
    } catch (err: any) {
        console.warn('[CHAT-CLEAR] ⚠️ Erro ao apagar chat da stream:', streamId, err?.message || err);
    }
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

// Mapa nome normalizado (sem acentos) → código ISO (ex: 'portugal' → 'pt', 'brasil' → 'br')
const COUNTRY_NAME_TO_CODE: Record<string, string> = (() => {
    const map: Record<string, string> = {};
    for (const [code, info] of Object.entries(COUNTRY_FLAGS)) {
        map[code] = code;
        const nameNorm = info.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        map[nameNorm] = code;
    }
    return map;
})();

function normalizeCountryCode(value: any): string {
    const raw = String(value ?? '').trim().toLowerCase();
    const norm = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return COUNTRY_NAME_TO_CODE[norm] || norm;
}

// Filtro Mongo que casa o país por código ISO OU nome (normalizado), cobrindo
// dados legados gravados como 'portugal'/'brasil' em vez de 'pt'/'br'.
function buildCountryFilter(countryValue: any): Record<string, any> {
    const target = normalizeCountryCode(countryValue);
    if (!target) return {};
    const variants: string[] = [target];
    for (const [key, code] of Object.entries(COUNTRY_NAME_TO_CODE)) {
        if (code === target && !variants.includes(key)) variants.push(key);
    }
    return { $in: variants };
}




// Endpoint PUBLISH - Usa token gerado na START e inicia transmissão SRS

// ─── POST /api/srs/hook ──────────────────────────────────────────────────────
// Chamado pelo SRS via http_hooks on_publish / on_unpublish.
// NAO exige autenticacao — SRS nao envia JWT.
// code:0 = permitir; outro code = rejeitar.
router.post('/srs/hook', async (req, res) => {
    try {
        const { action, stream } = req.body || {};
        console.log('[SRS-HOOK] action=' + action + ' stream=' + stream);

        if (!action || !stream) {
            return res.json({ code: 0 });
        }

        const streamKey = String(stream);
        const hostId = streamKey.replace(/^stream_/, '');

        // Ignorar variantes de transcode (_t240/_t360/_transcoded) — não criam live
        if (isTranscodeVariant(streamKey)) {
            console.log('[SRS-HOOK] ⏭️ Stream transcodificada/variante ignorada: ' + streamKey);
            return res.json({ code: 0 });
        }

        if (action === 'on_publish') {
            if (srsHookReconnectTimers.has(streamKey)) {
                const t = srsHookReconnectTimers.get(streamKey);
                clearTimeout(t!);
                srsHookReconnectTimers.delete(streamKey);
                console.log('[SRS-HOOK] Reconexão detectada — auto-end cancelado para ' + streamKey);
            }

            let userName = hostId, userAvatar = '';
            try {
                const u: any = await User.findOne({ id: hostId }).lean();
                if (u) { userName = u.name || hostId; userAvatar = u.avatarUrl || ''; }
            } catch (_) {}

            await Streamer.findOneAndUpdate(
                { $or: [{ id: hostId }, { streamKey }] },
                { $set: { isLive: true, streamStatus: 'active', streamKey, id: hostId } },
                { upsert: true }
            ).catch(() => {});
            await User.findOneAndUpdate({ id: hostId }, { $set: { isLive: true, currentStreamId: hostId } }).catch(() => {});
            await LiveCard.findOneAndUpdate(
                { hostId },
                { $set: { hostId, name: userName, avatar: userAvatar, streamKey, isLive: true, streamStatus: 'active', startTime: new Date(), kickedUsers: [], updatedAt: new Date() } },
                { upsert: true }
            ).catch(() => {});

            const io = req.app.get('io');
            if (io) {
                io.emit('stream_started', { streamId: hostId, streamKey, name: userName, avatar: userAvatar, timestamp: new Date().toISOString() });
                io.emit('new_live', { id: hostId, hostId, name: userName, avatar: userAvatar, isLive: true, streamStatus: 'active', timestamp: new Date().toISOString() });
            }
            console.log('[SRS-HOOK] on_publish: ' + streamKey + ' -> isLive=true');
        }

        if (action === 'on_unpublish') {
            // Auto-encerramento com grace period: se o host não reconectar
            // dentro da janela, a live é encerrada (host saiu da tela / outro app).
            const io = req.app.get('io');
            const existing = srsHookReconnectTimers.get(streamKey);
            if (existing) clearTimeout(existing);
            console.log('[SRS-HOOK] on_unpublish: ' + streamKey + ' -> encerra em ' + (SRS_HOOK_RECONNECT_MS / 1000) + 's se não reconectar');
            const timer = setTimeout(() => {
                srsHookReconnectTimers.delete(streamKey);
                autoEndStreamOnDisconnect(streamKey, io);
            }, SRS_HOOK_RECONNECT_MS);
            srsHookReconnectTimers.set(streamKey, timer);
        }

        return res.json({ code: 0 });
    } catch (err: any) {
        console.error('[SRS-HOOK] Erro:', err.message);
        return res.json({ code: 0 });
    }
});
// ─────────────────────────────────────────────────────────────────────────────


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
                $push: { recentActivities: { $each: [{
                        action: 'audio_permission_request',
                        resource: purpose,
                        timestamp: new Date(),
                        endpoint: '/api/permissions/audio/request'
                    }], $slice: -50 } }
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
                $push: { recentActivities: { $each: [{
                        action: 'audio_permission_granted',
                        resource: 'microphone_access',
                        timestamp: new Date(),
                        endpoint: '/api/permissions/audio/grant'
                    }], $slice: -50 } }
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
                $push: { recentActivities: { $each: [{
                        action: 'audio_permission_denied',
                        resource: 'microphone_access',
                        timestamp: new Date(),
                        endpoint: '/api/permissions/audio/deny'
                    }], $slice: -50 } }
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
                $push: { recentActivities: { $each: [{
                        action: 'camera_permission_request',
                        resource: purpose,
                        timestamp: new Date(),
                        endpoint: '/api/permissions/camera/request'
                    }], $slice: -50 } }
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
                $push: { recentActivities: { $each: [{
                        action: 'camera_permission_granted',
                        resource: 'camera_access',
                        timestamp: new Date(),
                        endpoint: '/api/permissions/camera/grant'
                    }], $slice: -50 } }
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
                $push: { recentActivities: { $each: [{
                        action: 'camera_permission_denied',
                        resource: 'camera_access',
                        timestamp: new Date(),
                        endpoint: '/api/permissions/camera/deny'
                    }], $slice: -50 } }
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

        // 🪝 Webhook LiveGo: membro entrou (via REST /streams/:id/join)
        try { emitWebhook('LiveGo.CallbackAfterMemberStatusChange', { RoomId: id, UserId: userId, Status: 'online', Action: 'join', Timestamp: Date.now() }); } catch (e: any) { console.warn('[WEBHOOK] member join', e); }
        // 🪝 Webhook LiveGo: lotação >= 70%
        try { const sAfter: any = await Streamer.findOne({ id }).select('viewers maxViewers').lean(); const maxV = (sAfter && sAfter.maxViewers) || 0; const v = (sAfter && sAfter.viewers) || 0; if (maxV > 0 && v / maxV >= 0.7) { emitWebhook('LiveGo.CallbackAfterCreateRoomReachingThreshold', { RoomId: id, Viewers: v, MaxViewers: maxV, Percent: Math.round((v / maxV) * 100), Timestamp: Date.now() }); } } catch (e: any) { console.warn('[WEBHOOK] threshold', e); }



        // Atualizar currentStreamId do usuário e incrementar livesJoined

        await User.findOneAndUpdate(
            { id: userId },
            {
                $set: { currentStreamId: id, isOnline: true },
                $inc: { livesJoined: 1 },
                $push: { recentActivities: { $each: [{
                        action: 'live_join',
                        resource: 'streaming',
                        timestamp: new Date(),
                        endpoint: '/api/streams/:id/join'
                    }], $slice: -50 } }
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

        // 🧹 Chat morre com a transmissão
        await clearLiveChat(stream.id || id);



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

        // 🪝 Webhook LiveGo: sala destruída (fim da live por /streams/:id/end)
        try { emitWebhook('LiveGo.CallbackAfterDestroyRoom', { RoomId: stream.id || id, HostId: stream.hostId || userId, EndedBy: 'owner', EndTime: Date.now() }); } catch (e: any) { console.warn('[WEBHOOK] room destroyed (end)', e); }

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

        // streamKey SEMPRE = stream_{hostId}, igual ao que WHIP publish usa
        // Garante que FFmpeg, SRS e espectadores usem a mesma stream
        const streamKey = `stream_${hostId}`;

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
                    kickedUsers: [],
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

        // 🪝 Webhook LiveGo: sala criada
        try { emitWebhook('LiveGo.CallbackAfterCreateRoom', { RoomId: streamId, RoomName: streamTitle, HostId: hostId, Owner_Account: hostId, RoomType: 'Live', StreamKey: streamKey, Category: category, Status: 'preparing', CreateTime: Math.floor(Date.now() / 1000), EventTime: Date.now() }); } catch (e: any) { console.warn('[WEBHOOK] room created', e); }

        res.json({ success: true, stream });
    } catch (error: any) {
        console.error('[STREAMS-POST] Erro:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/streams', async (req, res) => {
    try {
        const {
            category = 'popular',
            country = 'all',
            limit = 50,
            cursor = '',
            isLive = 'true',
            userId,
            latitude,
            longitude
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
                    if (isTranscodeVariant(streamKey)) continue;
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
                                category: (user as any)?.category || 'popular',
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

        // Construir filtro base: apenas streams ativas
        const baseFilter: any = {
            streamKey: { $not: TRANSCODE_VARIANT_REGEX }
        };
        if (isLive === 'true') {
            baseFilter.isLive = true;
            baseFilter.streamStatus = { $in: ['active', 'live'] };
        } else if (isLive === 'false') {
            baseFilter.isLive = false;
        }

        const cat = (category as string).toLowerCase();
        let sortField: any = { viewers: -1, startTime: -1, _id: -1 };
        let useGeoSearch = false;

        // Aplicar filtros por categoria
        if (cat === 'followed' && userId) {
            const follows = await Followers.find({
                followerId: userId as string,
                isActive: true
            }).select('followingId').lean();
            const followedIds = follows.map(f => f.followingId);
            if (followedIds.length === 0) {
                return res.json({
                    code: 0, msg: 'OK',
                    data: { streams: [], nextCursor: null, hasMore: false }
                });
            }
            baseFilter.hostId = { $in: followedIds };
        } else if (cat === 'nearby') {
            useGeoSearch = true;
        } else if (cat === 'new') {
            sortField = { startTime: -1, _id: -1 };
        } else if (cat === 'all' || cat === 'popular') {
        } else if (cat === 'private') {
            baseFilter.isPrivate = true;
        } else {
            baseFilter.category = cat;
        }

        // ⛔ BAN POR CONTA: usuário bloqueado por um host NÃO vê as lives dele
        // em lugar nenhum (cards, seguidos, busca). Perfil do host some pra ele.
        if (userId) {
            try {
                const { StreamBan } = await import('../models');
                const bans = await StreamBan.find({ bannedUserId: String(userId) }).select('hostId').lean();
                const bannedHostIds = bans.map(b => b.hostId);
                if (bannedHostIds.length > 0) {
                    if (Array.isArray((baseFilter.hostId as any)?.$in)) {
                        baseFilter.hostId.$in = baseFilter.hostId.$in.filter((id: string) => !bannedHostIds.includes(String(id)));
                    } else {
                        baseFilter.hostId = { $nin: bannedHostIds };
                    }
                }
            } catch (banErr) {
                console.warn('[STREAMS] Falha ao filtrar hosts bloqueadores:', banErr);
            }
        }

        if (cursor) {
            baseFilter._id = { $lt: new ObjectId(cursor as string) };
        }

        let cardDocs: any[] = [];

        if (useGeoSearch && latitude && longitude) {
            const lat = parseFloat(latitude as string);
            const lng = parseFloat(longitude as string);
            if (!isNaN(lat) && !isNaN(lng)) {
                const nearbyUsers = await User.find({
                    latitude: { $exists: true, $ne: null },
                    longitude: { $exists: true, $ne: null }
                }).select('id latitude longitude').lean();

                const maxDist = 50000;
                const nearbyIds: string[] = [];
                for (const u of nearbyUsers) {
                    const uLat = (u as any).latitude;
                    const uLng = (u as any).longitude;
                    if (uLat == null || uLng == null) continue;
                    const R = 6371000;
                    const dLat = (lat - uLat) * Math.PI / 180;
                    const dLng = (lng - uLng) * Math.PI / 180;
                    const a = Math.sin(dLat/2) ** 2 +
                             Math.cos(lat * Math.PI / 180) * Math.cos(uLat * Math.PI / 180) *
                             Math.sin(dLng/2) ** 2;
                    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    if (dist <= maxDist) nearbyIds.push(u.id);
                }

                if (nearbyIds.length > 0) {
                    baseFilter.hostId = { $in: nearbyIds };
                } else {
                    return res.json({
                        code: 0, msg: 'OK',
                        data: { streams: [], nextCursor: null, hasMore: false }
                    });
                }
            }
        }

        const hasCountryFilter = country && country !== 'all' && country !== 'ICON_GLOBE';

        if (hasCountryFilter) {
            const countryFilter = { ...baseFilter, country: buildCountryFilter(country) };
            cardDocs = await LiveCard.find(countryFilter)
                .sort(sortField)
                .limit(parseLimit + 1)
                .lean();
            // 🔧 FILTRO ESTRITO: sem fallback para todos os países — o usuário escolheu
            // um país e deve ver SOMENTE as lives daquele país.
        } else {
            cardDocs = await LiveCard.find(baseFilter)
                .sort(sortField)
                .limit(parseLimit + 1)
                .lean();
        }

        if (!hasCountryFilter && cardDocs.length === 0 && isLive === 'true') {
            const fallbackFilter: any = { ...baseFilter };
            delete fallbackFilter.country;
            cardDocs = await LiveCard.find(fallbackFilter)
                .sort(sortField)
                .limit(parseLimit + 1)
                .lean();
        }

        if (!hasCountryFilter && cardDocs.length === 0 && isLive === 'true') {
            cardDocs = await LiveCard.find({
                isLive: true,
                streamStatus: { $in: ['active', 'live'] }
            })
                .sort({ viewers: -1, startTime: -1, _id: -1 })
                .limit(parseLimit + 1)
                .lean();
        }

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
            code: 0, msg: 'OK',
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

    // 🧹 Chat morre com a transmissão
    await clearLiveChat(streamId || stream?.id);

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

        }        // Buscar usuário para encontrar stream ativa

        const user = await findUserByAnyId(User, userId);

        if (!user) {

            return res.status(404).json({ 

                success: false,

                message: 'Usuário não encontrado' 

            });

        }



        // Buscar stream ativa do usuário

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

        const streamId = typeof activeStream.id === 'string' ? activeStream.id : String(activeStream.id || '');

        // ── Etapa 1: Atualizar status da stream para encerrada ──
        try {
            await Streamer.updateOne(
                { id: streamId },
                {
                    $set: {
                        isLive: false,
                        streamStatus: 'ended',
                        endTime: new Date()
                    }
                }
            );
            console.log('[LIVE-END] ✅ Streamer.updateOne OK');
        } catch (stepErr: any) {
            console.error('[LIVE-END] ❌ Erro em Streamer.updateOne:', stepErr.message);
        }

        // 🪝 Webhook LiveGo: sala destruída (fim da live por /live/end)
        try { emitWebhook('LiveGo.CallbackAfterDestroyRoom', { RoomId: streamId, HostId: userId, EndedBy: 'owner', EndTime: Date.now() }); } catch (e: any) { console.warn('[WEBHOOK] room destroyed (live/end)', e); }

        // ── Etapa 2: Atualizar status do usuário + persistir atividade ──
        try {
            await User.findOneAndUpdate(
                { id: userId },
                {
                    $set: {
                        isLive: false,
                        isOnline: false,
                        currentStreamId: null
                    },
                    $push: { recentActivities: { $each: [{
                            action: 'live_end',
                            resource: 'live_broadcast',
                            timestamp: new Date(),
                            endpoint: '/api/live/end'
                        }], $slice: -50 } }
                }
            );
            console.log('[LIVE-END] ✅ User.findOneAndUpdate OK');
        } catch (stepErr: any) {
            console.error('[LIVE-END] ❌ Erro em User.findOneAndUpdate:', stepErr.message);
        }

        // ── Etapa 3: Notificar viewers via Socket.IO ──
        const io = req.app.get('io');
        if (io) {
            try {
                io.to(streamId).emit('stream_ended', {
                    streamId: streamId,
                    hostId: userId,
                    timestamp: new Date()
                });
                io.emit('stream_ended', {
                    streamId: streamId,
                    hostId: userId
                });
                console.log('[LIVE-END] ✅ Socket.IO emit OK');
            } catch (stepErr: any) {
                console.error('[LIVE-END] ❌ Erro em Socket.IO emit:', stepErr.message);
            }
        }

        // ── Etapa 4: Encerrar PK battle ativa se existir ──
        try {
            const activeBattle: any = await Battle.findOne({
                $or: [
                    { streamerA: userId },
                    { streamerB: userId },
                    { streamerA: streamId },
                    { streamerB: streamId }
                ],
                status: 'active'
            }).lean();
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
                console.log('[LIVE-END] ✅ PK Battle', activeBattle._id, 'encerrada por fim da live');
            }
        } catch (battleErr: any) {
            console.warn('[LIVE-END] ⚠️ Erro ao buscar/encerrar PK Battle (ignorado):', battleErr.message);
        }

        // ── Etapa 5: Atualizar LiveCard para ended ──
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
            console.log('[LIVE-END] ✅ LiveCard atualizado');
        } catch (cardErr: any) {
            console.warn('[LIVE-END] ⚠️ Erro ao atualizar LiveCard:', cardErr.message);
        }

        // ── Etapa 6: 🧹 Chat morre com a transmissão — apaga TODAS as mensagens ──
        await clearLiveChat(streamId);

        console.log('[LIVE-END] ✅ Live encerrada:', streamId, 'para usuário', userId);

        res.json({
            success: true,
            stream: {
                id: streamId,
                isLive: false,
                streamStatus: 'ended',
                endTime: new Date()
            }
        });



    } catch (error: any) {

        console.error('[LIVE-END] ❌ Erro NÃO TRATADO:', error?.message || error, error?.stack || '');

        res.status(500).json({ 

            success: false,

            message: 'Erro interno ao encerrar live',
            error: error?.message || 'Unknown error'

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

            streamKey: { $not: TRANSCODE_VARIANT_REGEX }

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

        // 🪝 Webhook LiveGo: sala atualizada (info) + metadados
        try {
            emitWebhook('LiveGo.CallbackAfterUpdateRoomInfo', { RoomId: req.params.id, UpdatedFields: Object.keys(updateData), UpdateTime: Date.now() });
            for (const f of Object.keys(updateData)) {
                const v = updateData[f];
                if (v === '' || v === null || v === undefined) {
                    emitWebhook('LiveGo.CallbackAfterDelMetadata', { RoomId: req.params.id, MetadataKeys: [f], EventTime: Date.now() });
                } else {
                    emitWebhook('LiveGo.CallbackAfterSetMetadata', { RoomId: req.params.id, Metadata: [{ Key: f, Value: typeof v === 'object' ? JSON.stringify(v) : String(v) }], EventTime: Date.now() });
                }
            }
        } catch (e: any) { console.warn('[WEBHOOK] room updated', e); }



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

        // 🪝 Webhook LiveGo: sala atualizada (cover)
        try { emitWebhook('LiveGo.CallbackAfterUpdateRoomInfo', { RoomId: req.params.id, UpdatedFields: ['coverUrl'], CoverURL: coverUrl, UpdateTime: Date.now() }); } catch (e: any) { console.warn('[WEBHOOK] cover updated', e); }



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



        // 💎 DIAMANTES POR SESSÃO DE LIVE: o streamKey é REUTILIZADO entre lives,
        // então filtrar só por streamId mostrava diamantes de sessões antigas.
        // Filtramos também por createdAt >= startTime DA LIVE ATUAL — quando a
        // live encerra e uma nova começa, os contadores voltam ao zero. O saldo
        // real do criador (GiftTransaction histórico) NÃO é apagado.
        const streamDoc: any = await Streamer.findOne({
            $or: [{ id: streamId }, { streamKey: streamId }]
        }).select('startTime').lean();
        const sessionStart: Date | null = streamDoc?.startTime ? new Date(streamDoc.startTime) : null;
        const sessionFilter: any = (sessionStart && !isNaN(sessionStart.getTime()))
            ? { createdAt: { $gte: sessionStart } }
            : {};



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

            

            // Buscar usu+�rios que enviaram presentes nesta live (SESSÃO ATUAL)

            const giftSenders = await GiftTransaction.aggregate([

                { $match: { streamId: streamId, ...sessionFilter } },

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

            streamId: streamId,

            ...sessionFilter

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

        // 🪝 Webhook LiveGo: membro saiu (via REST /streams/:streamId/leave)
        try { emitWebhook('LiveGo.CallbackAfterMemberStatusChange', { RoomId: streamId, UserId: userId, Status: 'offline', Action: 'leave', Timestamp: Date.now() }); } catch (e: any) { console.warn('[WEBHOOK] member leave', e); }



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

// POST /api/streams/:id/toggle-mic - Alterna o microfone do host
// 🔧 FIX: era a PRIMEIRA de duas rotas com o mesmo path (a segunda era código
// morto). Antes retornava 404 quando não havia streamsession ativa e tinha a
// semântica do estado invertida. Agora: persiste no Streamer SEMPRE (sessão é
// opcional), aceita estado explícito `microphoneEnabled` do front e emite os
// dois flags coerentes (isMuted = !enabled).
router.post('/streams/:id/toggle-mic', async (req, res) => {
    try {
        const streamId = req.params.id;
        const db = getDb();
        const sessions = db.collection('streamsessions');
        const session = await sessions.findOne({ streamId, endTime: { $exists: false } });
        const userId = getUserIdFromToken(req);
        if (userId && session && String(session.hostId) !== String(userId)) {
            return res.status(403).json({ success: false, error: 'Apenas o host pode alternar o microfone' });
        }
        // Estado atual: sessão (se existir) ou doc do Streamer; undefined = ligado.
        let currentEnabled: boolean;
        if (session) {
            currentEnabled = !(session as any).isMicrophoneMuted;
        } else {
            const streamDoc = await Streamer.findOne({ id: streamId }).select('microphoneEnabled').lean();
            currentEnabled = ((streamDoc as any)?.microphoneEnabled) !== false;
        }
        const desired = (req.body || {}).microphoneEnabled;
        const enabled = typeof desired === 'boolean' ? desired : !currentEnabled;
        // Persiste na sessão (se houver) e SEMPRE no Streamer — mesmo sem sessão ativa.
        if (session) {
            await sessions.updateOne(
                { streamId, endTime: { $exists: false } },
                { $set: { isMicrophoneMuted: !enabled, updatedAt: new Date() } }
            );
        }
        await Streamer.findOneAndUpdate(
            { id: streamId },
            { $set: { microphoneEnabled: enabled } }
        );
        const io = req.app.get('io');
        if (io) {
            io.to(streamId).emit('mic_toggled', {
                streamId,
                roomId: streamId,
                userId,
                isMuted: !enabled,
                microphoneEnabled: enabled,
                timestamp: new Date().toISOString()
            });
        }
        console.log(`[TOGGLE-MIC] Stream ${streamId}: microfone ${enabled ? 'ATIVADO' : 'MUTADO'} por ${userId || 'host'}`);
        res.json({ success: true, isMuted: !enabled, microphoneEnabled: enabled });
    } catch (error: any) {
        console.error('[TOGGLE-MIC] Erro:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== ROUTE START =====

// POST /api/streams/:id/toggle-sound - Alterna o som do stream
// 🔧 FIX: mesmos problemas do toggle-mic (404 sem sessão + semântica invertida).
// Agora funciona com ou sem sessão ativa e aceita estado explícito.
router.post('/streams/:id/toggle-sound', async (req, res) => {
    try {
        const streamId = req.params.id;
        const db = getDb();
        const sessions = db.collection('streamsessions');
        const session = await sessions.findOne({ streamId, endTime: { $exists: false } });
        const userId = getUserIdFromToken(req);
        if (userId && session && String(session.hostId) !== String(userId)) {
            return res.status(403).json({ success: false, error: 'Apenas o host pode alternar o som' });
        }
        let currentEnabled: boolean;
        if (session) {
            currentEnabled = !(session as any).isStreamMuted;
        } else {
            const streamDoc = await Streamer.findOne({ id: streamId }).select('soundEnabled').lean();
            currentEnabled = ((streamDoc as any)?.soundEnabled) !== false;
        }
        const desired = (req.body || {}).soundEnabled;
        const enabled = typeof desired === 'boolean' ? desired : !currentEnabled;
        if (session) {
            await sessions.updateOne(
                { streamId, endTime: { $exists: false } },
                { $set: { isStreamMuted: !enabled, updatedAt: new Date() } }
            );
        }
        await Streamer.findOneAndUpdate(
            { id: streamId },
            { $set: { soundEnabled: enabled } }
        );
        const io = req.app.get('io');
        if (io) {
            io.to(streamId).emit('sound_toggled', {
                streamId,
                roomId: streamId,
                userId,
                isMuted: !enabled,
                soundEnabled: enabled,
                timestamp: new Date().toISOString()
            });
        }
        console.log(`[TOGGLE-SOUND] Stream ${streamId}: som ${enabled ? 'ATIVADO' : 'MUTADO'} por ${userId || 'host'}`);
        res.json({ success: true, isMuted: !enabled, soundEnabled: enabled });
    } catch (error: any) {
        console.error('[TOGGLE-SOUND] Erro:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== ROUTE START =====

// POST /api/streams/:id/toggle-auto-follow - Alterna o seguimento automatico
// 🔧 FIX: era a PRIMEIRA de duas rotas com o mesmo path (a 2ª era código
// morto). Antes retornava 404 sem sessão ativa e gravava APENAS na sessão —
// o fluxo de presentes lê Streamer.autoFollowEnabled, então o toggle não
// surtia efeito real. Agora grava SEMPRE no Streamer (sessão opcional).
router.post('/streams/:id/toggle-auto-follow', async (req, res) => {
    try {
        const streamId = req.params.id;
        const { isEnabled } = req.body ?? {};
        const db = getDb();
        const sessions = db.collection('streamsessions');
        const session = await sessions.findOne({ streamId, endTime: { $exists: false } });
        const userId = getUserIdFromToken(req);
        if (userId && session && String(session.hostId) !== String(userId)) {
            return res.status(403).json({ success: false, error: 'Apenas o host pode alterar esta configuracao' });
        }
        let currentState = false;
        if (session) {
            currentState = !!(session as any).isAutoFollowEnabled;
        } else {
            const doc = await Streamer.findOne({ id: streamId }).select('autoFollowEnabled').lean();
            currentState = !!((doc as any)?.autoFollowEnabled);
        }
        const newState = typeof isEnabled === 'boolean' ? isEnabled : !currentState;
        if (session) {
            await sessions.updateOne(
                { streamId, endTime: { $exists: false } },
                { $set: { isAutoFollowEnabled: newState, updatedAt: new Date() } }
            );
        }
        await Streamer.findOneAndUpdate(
            { id: streamId },
            { $set: { autoFollowEnabled: newState } }
        );
        const io = req.app.get('io');
        if (io) {
            io.to(streamId).emit('auto_follow_toggled', { streamId, roomId: streamId, userId, autoFollowEnabled: newState, isEnabled: newState, timestamp: new Date().toISOString() });
        }
        console.log(`[TOGGLE-AUTO-FOLLOW] Stream ${streamId}: ${newState ? 'ON' : 'OFF'} por ${userId || 'host'}`);
        res.json({ success: true, isEnabled: newState, autoFollowEnabled: newState });
    } catch (error: any) {
        console.error('[TOGGLE-AUTO-FOLLOW] Erro:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== ROUTE START =====

// POST /api/streams/:id/toggle-auto-invite - Alterna o convite automatico
// 🔧 FIX: mesmos problemas do auto-follow (404 sem sessão + gravava só na
// sessão; o fluxo de presentes lê Streamer.autoInviteEnabled).
router.post('/streams/:id/toggle-auto-invite', async (req, res) => {
    try {
        const streamId = req.params.id;
        const { isEnabled } = req.body ?? {};
        const db = getDb();
        const sessions = db.collection('streamsessions');
        const session = await sessions.findOne({ streamId, endTime: { $exists: false } });
        const userId = getUserIdFromToken(req);
        if (userId && session && String(session.hostId) !== String(userId)) {
            return res.status(403).json({ success: false, error: 'Apenas o host pode alterar esta configuracao' });
        }
        let currentState = false;
        if (session) {
            currentState = !!(session as any).isAutoPrivateInviteEnabled;
        } else {
            const doc = await Streamer.findOne({ id: streamId }).select('autoInviteEnabled').lean();
            currentState = !!((doc as any)?.autoInviteEnabled);
        }
        const newState = typeof isEnabled === 'boolean' ? isEnabled : !currentState;
        if (session) {
            await sessions.updateOne(
                { streamId, endTime: { $exists: false } },
                { $set: { isAutoPrivateInviteEnabled: newState, updatedAt: new Date() } }
            );
        }
        await Streamer.findOneAndUpdate(
            { id: streamId },
            { $set: { autoInviteEnabled: newState } }
        );
        const io = req.app.get('io');
        if (io) {
            io.to(streamId).emit('auto_invite_toggled', { streamId, roomId: streamId, userId, autoInviteEnabled: newState, isAutoPrivateInviteEnabled: newState, isEnabled: newState, timestamp: new Date().toISOString() });
        }
        console.log(`[TOGGLE-AUTO-INVITE] Stream ${streamId}: ${newState ? 'ON' : 'OFF'} por ${userId || 'host'}`);
        res.json({ success: true, isEnabled: newState, autoInviteEnabled: newState });
    } catch (error: any) {
        console.error('[TOGGLE-AUTO-INVITE] Erro:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

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

        // 🪝 Webhook LiveGo: sala destruída (fim da live por end-session)
        try { emitWebhook('LiveGo.CallbackAfterDestroyRoom', { RoomId: streamId, HostId: stream.hostId || '', EndedBy: 'owner', EndTime: Date.now() }); } catch (e: any) { console.warn('[WEBHOOK] room destroyed (end session)', e); }



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



        // 🧹 Chat morre com a transmissão
        await clearLiveChat(streamId);

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

        const io = req.app.get('io');

        // Emitir o presente IMEDIATAMENTE após a validação, antes das escritas no DB,
        // para que todos os participantes (incluindo o remetente) vejam a animação sem atraso.
        if (io) {
            const giftEventId = `gift_tx_${Date.now()}_${fromUserId}`;
            const giftEventData = {
                id: giftEventId,
                from: {
                    id: sender.id || fromUserId,
                    name: sender.name || 'Unknown',
                    avatarUrl: sender.avatarUrl || '',
                    level: sender.level || 1
                },
                toUser: {
                    id: stream.hostId,
                    name: stream.name || 'Unknown'
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

        // 🪝 Webhook LiveGo: presente enviado (caminho real do app /streams/:id/gift)
        try { emitWebhook('LiveGo.CallbackAfterGift', { RoomId: req.params.id, FromUserId: fromUserId, FromUserName: sender.name || '', ToUserId: stream.hostId, ToUserName: stream.name || '', GiftName: giftName, GiftPrice: price, Quantity: amount || 1, TotalValue: totalValue, Timestamp: Date.now() }); } catch (e: any) { console.warn('[WEBHOOK] gift (liveRoutes)', e); }

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



        // 🔄 SEGUIR AUTOMÁTICO (por PRESENTE): só vale se o host MARCOU a caixa
        // "Seguir Auto". Quem MANDA PRESENTE na live passa a ser seguido PELO
        // HOST automaticamente. Quem NÃO manda presente, NÃO é seguido.
        if ((stream as any).autoFollowEnabled && stream.hostId && String(stream.hostId) !== String(fromUserId)) {
            try {
                const hostId = String(stream.hostId);
                const gifterId = String(fromUserId);
                const existingFollow = await Followers.findOne({ followerId: hostId, followingId: gifterId, isActive: true });
                if (!existingFollow) {
                    const inactiveFollow = await Followers.findOne({ followerId: hostId, followingId: gifterId, isActive: false });
                    if (inactiveFollow) {
                        await Followers.findOneAndUpdate(
                            { followerId: hostId, followingId: gifterId, isActive: false },
                            { $set: { isActive: true, followedAt: new Date() }, $unset: { unfollowedAt: 1 } }
                        );
                    } else {
                        await Followers.create({
                            id: `followers_${hostId}_${gifterId}`,
                            followerId: hostId,
                            followingId: gifterId,
                            followedAt: new Date(),
                            isActive: true
                        });
                    }
                    // Host segue +1; quem mandou presente ganha fã +1
                    await User.findOneAndUpdate({ id: hostId }, { $inc: { following: 1 }, $addToSet: { followingList: gifterId } });
                    await User.findOneAndUpdate({ id: gifterId }, { $inc: { fans: 1 }, $addToSet: { followersList: hostId }, $set: { isFollowed: true } });

                    // Avisa em tempo real que o host passou a seguir o remetente
                    const ioAuto = req.app.get('io') || (global as any).io;
                    if (ioAuto) {
                        ioAuto.to(`user_${gifterId}`).emit('new_follower', {
                            followerId: hostId,
                            followerName: updatedReceiver?.name || 'Host',
                            followerAvatar: updatedReceiver?.avatarUrl || '',
                            autoFollow: true,
                            timestamp: new Date().toISOString()
                        });
                    }
                    try { emitWebhook('LiveGo.CallbackAfterFollow', { FollowerId: hostId, FollowedId: gifterId, AutoFollow: true, Timestamp: Date.now() }); } catch (e: any) { console.warn('[WEBHOOK] auto-follow', e); }
                    console.log(`[AUTO-FOLLOW] Host ${hostId} agora segue ${gifterId} (mandou presente na live ${req.params.id})`);
                }
            } catch (autoFollowErr: any) {
                console.warn('[AUTO-FOLLOW] Erro no seguir automático:', autoFollowErr?.message || autoFollowErr);
            }
        }

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

n//
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

        const streamer: any = await Streamer.findOne({ id }).lean();

        

        if (!streamer) {

            console.log(` Streamer not found: ${id}`);

            return res.status(404).json({ error: 'Streamer not found' });

        }

        // 🔄 RESTAURAÇÃO APÓS F5/REFRESH: retornar o documento REAL (id,
        // hostId e streamKey inclusos). O mapper "protegido" trocava o id
        // por um hash e omitia streamKey/hostId — ao recarregar a página em
        // /live/:id o player assinava um stream INEXISTENTE e a sala ficava
        // com tela preta. Os mesmos dados já são expostos pelo feed de cards.

        res.json({ success: true, stream: streamer });

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

            { $set: {

                isLive: false,

                streamStatus: 'ended',

                endTime: new Date()

            } }

        );

        // 🪝 Webhook LiveGo: sala destruída (fim da live por /lives/:id/end)
        try { emitWebhook('LiveGo.CallbackAfterDestroyRoom', { RoomId: realId, HostId: userId || '', EndedBy: 'owner', EndTime: Date.now() }); } catch (e: any) { console.warn('[WEBHOOK] room destroyed (lives end)', e); }



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

        // 🧹 Chat morre com a transmissão
        await clearLiveChat(realId);

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

            io.to(streamId).emit('stream_liked', {

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

            io.to(streamId).emit('stream_unliked', {

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

        // 🪝 Webhook LiveGo: sala destruída (fim da live por /streams/:streamId/end)
        try { emitWebhook('LiveGo.CallbackAfterDestroyRoom', { RoomId: streamId, HostId: stream.hostId || '', EndedBy: isOwner ? 'owner' : 'admin', EndTime: Date.now() }); } catch (e: any) { console.warn('[WEBHOOK] room destroyed (end)', e); }

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

        // 🧹 Chat morre com a transmissão
        await clearLiveChat(streamId);

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

        // 🧹 Chat morre com a transmissão (todas as streams)
        for (const s of activeStreams) {
            await clearLiveChat(s.id);
        }

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

        // 🧹 Chat morre com a transmissão
        await clearLiveChat(streamId || stream?.id);

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

        // 🧹 Chat morre com a transmissão
        await clearLiveChat(streamId);

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

// GET /api/new-users/recent - Listar novos usuários recentes
router.get('/new-users/recent', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const { NewUserNotificationService } = await import('../services/NewUserNotificationService');
    const messages = await NewUserNotificationService.getRecentNewUsers(limit);
    res.json({ success: true, messages });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// POST /api/streams/:id/live-message - Enviar mensagem na live (REST equivalente ao socket send_live_message)
router.post('/streams/:id/live-message', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = getUserIdFromToken(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Usuario nao autenticado' });
        }
        const { text } = req.body;
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Texto da mensagem e obrigatorio' });
        }
        const user = await User.findOne({ id: userId }).lean();
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
        }
        const stream = await Streamer.findOne({ id }).lean();
        if (!stream) {
            return res.status(404).json({ success: false, message: 'Stream nao encontrada' });
        }
        const liveMessage = await LiveMessage.create({
            streamId: id,
            userId,
            userName: user.name || 'Usuario',
            avatarUrl: user.avatarUrl || '',
            level: user.level || 1,
            activeFrameId: user.activeFrameId || null,
            text: text.trim(),
            timestamp: new Date()
        });
        const messagePayload = {
            id: liveMessage.id,
            userId,
            userName: user.name || 'Usuario',
            avatarUrl: user.avatarUrl || '',
            level: user.level || 1,
            activeFrameId: user.activeFrameId || null,
            text: text.trim(),
            timestamp: new Date()
        };
        // ⚡ Broadcast em tempo real via Socket.IO — mesma sala (join_stream → socket.join(streamId))
        // usada por host e espectadores. O frontend escuta o evento 'live_message'.
        try {
            const io = req.app.get('io');
            if (io) {
                io.to(id).emit('live_message', messagePayload);
            }
        }
        catch (ioErr) {
            console.warn('[LIVE-MESSAGE-REST] Erro ao emitir socket:', ioErr);
        }
        console.log('[LIVE-MESSAGE-REST] Mensagem criada na live', id, 'por', userId);
        res.json({
            success: true,
            message: 'Mensagem enviada com sucesso',
            data: messagePayload
        });
    } catch (error) {
        console.error('[LIVE-MESSAGE-REST] Erro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno ao enviar mensagem',
            error: error instanceof Error ? error.message : String(error)
        });
    }
});


// GET /api/streams/:id/live-messages - Buscar histórico de mensagens da live
router.get("/streams/:id/live-messages", async (req, res) => {
    try {
        const { id } = req.params;
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
        const messages = await LiveMessage.find({ streamId: id })
            .sort({ timestamp: 1 })
            .limit(limit)
            .lean();
        res.json({ success: true, messages });
    } catch (error) {
        console.error("[LIVE-MESSAGES-GET] Erro:", error);
        res.status(500).json({ success: false, error: "Erro ao buscar mensagens" });
    }
});




// POST /api/streams/:id/publish - Marcar stream como live e preparar para ingest+o SRS
router.post("/streams/:id/publish", async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Usu+rio n+o autenticado" });
        }

        const { id } = req.params;
        const realId = id.startsWith("stream_") ? id.replace("stream_", "") : id;

        console.log(`[STREAM-PUBLISH] 🚀 Solicitando publica++o para stream ${realId} (userId: ${userId})`);

        const user = await User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ success: false, message: "Usu+rio n+o encontrado" });
        }

        const streamerData = {
            id: realId,
            hostId: userId,
            name: user.name || "Streamer",
            avatar: resolveAvatar(user),
            isLive: true,
            streamStatus: "active",
            startTime: new Date(),
            streamKey: `stream_${realId}`,
            tags: ["live"],
            country: user.country || "br"
        };

        const stream = await Streamer.findOneAndUpdate(
            { id: realId, hostId: userId },
            { $set: streamerData },
            { upsert: true, new: true }
        );

        await User.findOneAndUpdate(
            { id: userId },
            { $set: { isLive: true, currentStreamId: realId, isOnline: true } }
        );

        await LiveCard.findOneAndUpdate(
            { hostId: userId },
            { 
                $set: {
                    hostId: userId,
                    name: stream.name,
                    avatar: stream.avatar,
                    title: stream.title || stream.message || `Live de ${stream.name}`,
                    streamKey: stream.streamKey,
                    isLive: true,
                    startTime: stream.startTime,
                    category: stream.category || "popular",
                    country: stream.country || "br",
                    streamStatus: "active"
                }
            },
            { upsert: true }
        );

        const io = req.app.get("io");
        if (io) {
            io.emit("new_live", {
                id: stream.streamKey,
                hostId: userId,
                name: stream.name,
                avatar: stream.avatar,
                isLive: true,
                streamStatus: "active",
                country: stream.country,
                viewers: 0,
                timestamp: stream.startTime.toISOString()
            });
        }

        console.log(`[STREAM-PUBLISH] ✅ Stream ${realId} ativada com sucesso`);

        res.json({
            success: true,
            stream: stream
        });
    } catch (error) {
        console.error("[STREAM-PUBLISH] Erro:", error);
        res.status(500).json({ 
            success: false, 
            message: "Erro interno ao publicar stream",
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

// 🪝 POST /api/streams/:id/transfer-owner — transferir propriedade da sala
router.post('/streams/:id/transfer-owner', async (req, res) => {
    try {
        const { id } = req.params;
        const { newOwnerId, userId } = req.body;
        if (!newOwnerId || !userId) {
            return res.status(400).json({ success: false, error: 'newOwnerId e userId obrigatórios' });
        }
        const { Streamer } = await import('../models/index');
        const stream = await Streamer.findOne({ id });
        if (!stream) {
            return res.status(404).json({ success: false, error: 'Stream não encontrada' });
        }
        if (stream.hostId !== userId) {
            return res.status(403).json({ success: false, error: 'Apenas o proprietário atual pode transferir' });
        }
        const oldOwnerId = stream.hostId;
        await Streamer.findOneAndUpdate({ id }, { $set: { hostId: newOwnerId } });
        console.log(`[TRANSFER-OWNER] Sala ${id}: ${oldOwnerId} → ${newOwnerId}`);
        try { emitWebhook('LiveGo.CallbackAfterOwnerChange', { RoomId: id, OldOwnerId: oldOwnerId, NewOwnerId: newOwnerId, Timestamp: Date.now() }); } catch (e: any) { console.warn('[WEBHOOK] owner change', e); }
        res.json({ success: true, oldOwnerId, newOwnerId });
    } catch (error) {
        console.error("[TRANSFER-OWNER] Erro:", error);
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
});

// ===== SEGUIR AUTO / AUTO CONVITE =====
// ⚠️ As rotas toggle-mic, toggle-sound, toggle-auto-follow e toggle-auto-invite
// ficam definidas UMA ÚNICA VEZ (linhas ~5793-5975). Versões duplicadas aqui
// eram código morto (o Express usa a primeira rota registrada) e foram
// removidas para evitar confusão.

export default router;


