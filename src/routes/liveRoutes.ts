import express from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../config/db';
import { v4 as uuidv4 } from 'uuid';
import { Streamer, User, Message, Followers, Friendship, Block, UserLevel, StreamKeyAssociation, GiftTransaction, StreamLike, Battle } from '../models/index';
import { getUserIdFromToken, generateJWT } from '../middleware/auth';
import { ResponseHelper } from '../middleware/responseHelper';

import { 

    mapSrsStreamToFrontend, 

    mapSrsStreamsArray, 

    mapStreamToProtectedFlexible, 

    mapStreamsToProtectedArrayFlexible,

    enrichStreamsWithHostData,

    validateSrsStreamData,

    validateStreamerDocument

} from '../mappers/srsStreamMapper';

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

        const hasActiveStream = await Streamer.findOne({ 

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

                api: process.env.SRS_API_URL || 'https://srs:1990'

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

                host: process.env.SRS_HOST || '72.60.249.175',

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

        const liveId = `live_${userId}_${timestamp}`;

        const streamId = `stream_${userId}_${timestamp}`;

        const streamKey = streamId; // Stream key simples = streamId



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

        const srsHost = process.env.SRS_HOST || '72.60.249.175';

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

        const srsHost = process.env.SRS_HOST || '72.60.249.175';

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

            avatar: user.avatarUrl || '',

            location: user.country || 'BR',

            time: 'Ao Vivo',

            message: `Live de ${user.name}`,

            tags: ['live'],

            isLive: true,

            streamStatus: 'publishing', // Status: publishing (ao vivo)

            startTime: new Date(),

            streamKey: streamKey,

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
            { upsert: true, new: true }
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
                currentStreamId: null 
            } }
        );

        console.log(`[LIVE-CLEAR] ${clearedStreams.length} lives limpas: ${clearedStreams.join(', ')}`);

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
        const streamId = `stream_${userId}`;
        const liveId = uuidv4();

        // Configurações SRS
        const srsHost = process.env.SRS_HOST || '72.60.249.175';
        const srsPort = process.env.SRS_PORT || '1935';
        const srsApp = process.env.SRS_APP || 'live';
        const vhost = process.env.SRS_VHOST || '__defaultVhost__';

        // URLs dinâmicas
        const pushUrl = `rtmp://${srsHost}:${srsPort}/${srsApp}/${streamId}`;
        const webrtcUrl = `webrtc://${srsHost}:8000/${srsApp}/${streamId}`;
        const BACKEND_URL = process.env.BACKEND_URL || 'https://api.livego.store';
        const httpFlvUrl = `${BACKEND_URL}/api/video/http/live/${streamId}.flv`;
        const hlsUrl = `${BACKEND_URL}/api/video/http/live/${streamId}.m3u8`;

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
            streamKey: streamId,
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
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Atualizar status do usuário (isLive só será true quando SRS chamar on_publish)
        await User.findOneAndUpdate(
            { id: userId },
            { $set: { 
                isLive: true,
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
            { upsert: true, new: true }
        );



        console.log(`[STREAM-START] Stream ${streamId} iniciada para usuário ${userId}`);



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

        const stream = await Streamer.findOne({ id });

        if (!stream) {

            return res.status(404).json({ 

                success: false, 

                message: 'Stream não encontrado' 

            });

        }



        // Verificar se stream está ativa

        if (!stream.isLive || stream.streamStatus !== 'active') {

            return res.status(400).json({ 

                success: false, 

                message: 'Stream não está ativa' 

            });

        }



        // Buscar dados do espectador

        const viewer = await User.findOne({ id: userId });

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



        console.log(`[STREAM-JOIN] Usuário ${userId} entrou na live ${id}`);



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

        const stream = await Streamer.findOne({ id, hostId: userId });

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

        const srsApiUrl = process.env.SRS_API_URL || `https://${srsHost}:1990`;



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

        let stream = await Streamer.findOne({ id, hostId: userId });

        

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

                currentStreamId: null

            } }

        );



        console.log(`[STREAM-END] Stream ${id} finalizada para usuário ${userId}`);



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



// GET /api/streams - Listar streams (rota principal para frontend)
router.get('/streams', async (req, res) => {
    try {
        console.log('[API-STREAMS] Listando streams...');

        // Parâmetros de query
        const {
            category = 'popular',
            country = 'all',
            limit = 50,
            offset = 0,
            isLive = 'true'
        } = req.query;

        // Construir filtro
        const filter: any = {};
        if (isLive === 'true') filter.isLive = true;
        if (category && category !== 'all' && category !== 'popular') filter.category = category;
        if (country && country !== 'all' && country !== 'ICON_GLOBE') filter.country = country;

        // Buscar streams no banco usando Mongoose
        const streams = await Streamer.find(filter)
            .sort({ viewers: -1, startTime: -1 })
            .limit(parseInt(limit as string))
            .skip(parseInt(offset as string))
            .lean();

        // Enriquecer com dados do host
        const enrichedStreams = await Promise.all(
            streams.map(async (stream) => {
                const host = await User.findOne({ id: stream.hostId }).lean();
                return {
                    ...stream,
                    host: host ? {
                        id: host.id,
                        name: host.name,
                        avatar: host.avatarUrl || '',
                        level: host.level || 1,
                        country: host.country || 'BR'
                    } : null
                };
            })
        );

        res.json({
            code: 0,
            msg: 'OK',
            data: {
                streams: enrichedStreams,
                total: await Streamer.countDocuments(filter)
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

                currentStreamId: null 

            } }
        );



        console.log(`[END-SESSION] Sessão encerrada para usuário ${userId}. Streams afetadas: ${result.modifiedCount}`);



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

        let stream = await Streamer.findOne({ id: streamId, hostId: userId });

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
                // MANTER currentStreamId para permitir reconexão
                // currentStreamId: null, 
                lastSeen: new Date().toISOString()
            } }
        );



        console.log(`[RTC-STOP] Status final: isLive=${stream.isLive}, streamStatus=${stream.streamStatus}`);



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

        const user = await User.findOne({ id: userId });

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
    const streamId = `live_${userId}_${Date.now()}`;

    // URLs via proxy backend (evita mixed content em produção)
    const BACKEND_URL = (process.env.BACKEND_URL || 'https://api.livego.store').replace(/\/+$/, '');
    const SRS_API_URL = process.env.SRS_API_URL || 'https://srs:1990';
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
        streamKey: streamId,
        rtmpIngestUrl: `rtmp://${process.env.SRS_HOST || 'srs'}:1935/live/${streamId}`,
        playbackUrl: `${backendHttp}/live/${streamId}.flv`,
        flvUrl: `${backendHttp}/live/${streamId}.flv`,
        hlsUrl: `${backendHttp}/live/${streamId}.m3u8`
      } },
      { upsert: true, new: true }
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

    const stream = await Streamer.findOne({
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
router.post('/:streamId/end', async (req, res) => {
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

    console.log(`🛑 [SRS] Live finalizada: streamId=${streamId}, userId=${userId}`);

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

        const user = await User.findOne({ id: association.userId });

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



export default router;

