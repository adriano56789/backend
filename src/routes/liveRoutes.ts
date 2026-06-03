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

// import { deduplicateStreamsBeforeCreate, forceCleanupDuplicateStreams } from '../middleware/StreamDeduplicationMiddleware'; // TODO: Criar middleware de deduplicaÃ§Ã£o



const router = express.Router();



const isValidObjectId = (value: string) => { try { new ObjectId(value); return true; } catch { return false; } };



// --- SRS APENAS PARA INGESTÃƒO DE VÃDEO ---
// SRS nÃ£o deve ser usado para controle de status, validaÃ§Ã£o ou lÃ³gica de aplicaÃ§Ã£o

// Uso do SRS deve ser limitado a: publish (ingest) e play (distribuiÃ§Ã£o)

// Controle de live Ã© feito pelo backend via /streams e /live/end



// GET /api/game-list - Endpoint para categorias reais do app
router.get('/game-list', async (req, res) => {
  try {
    console.log('[GAME-LIST] Buscando categorias reais do app...');
    
    // Categorias reais baseadas no app LiveGo
    const categories = [
      {
        id: 'popular',
        name: 'Popular',
        icon: 'ðŸ”¥',
        description: 'Lives mais populares',
        active: true
      },
      {
        id: 'followed',
        name: 'Seguindo',
        icon: 'â¤ï¸',
        description: 'Lives de usuÃ¡rios que vocÃª segue',
        active: true
      },
      {
        id: 'nearby',
        name: 'PrÃ³ximas',
        icon: 'ðŸ“',
        description: 'Lives na sua regiÃ£o',
        active: true
      },
      {
        id: 'pk',
        name: 'PK Battle',
        icon: 'âš”ï¸',
        description: 'Batalhas ao vivo',
        active: true
      },
      {
        id: 'new',
        name: 'Novas',
        icon: 'âœ¨',
        description: 'Lives mais recentes',
        active: true
      },
      {
        id: 'music',
        name: 'MÃºsica',
        icon: 'ðŸŽµ',
        description: 'Lives de mÃºsica',
        active: true
      },
      {
        id: 'dance',
        name: 'DanÃ§a',
        icon: 'ðŸ’ƒ',
        description: 'Lives de danÃ§a',
        active: true
      },
      {
        id: 'party',
        name: 'Festa',
        icon: 'ðŸŽ‰',
        description: 'Lives de festa',
        active: true
      },
      {
        id: 'private',
        name: 'Privado',
        icon: 'ðŸ”’',
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

// Carrega todas as informaÃ§Ãµes do usuÃ¡rio online em uma Ãºnica chamada

router.post('/token/user/online/infos', async (req, res) => {

    try {

        console.log('[USER-ONLINE-INFOS] Iniciando carregamento de dados do usuÃ¡rio...');

        

        const userId = getUserIdFromToken(req);

        if (!userId) {

            return res.status(401).json({

                code: 1,

                msg: 'UsuÃ¡rio nÃ£o autenticado'

            });

        }



        const user = await findUserByAnyId(User, userId);

        if (!user) {

            return res.status(404).json({

                code: 1,

                msg: 'UsuÃ¡rio nÃ£o encontrado'

            });

        }



        console.log(`[USER-ONLINE-INFOS] UsuÃ¡rio encontrado: ${user.name} (${userId})`);

        console.log(`[USER-ONLINE-INFOS] Status atual - isOnline: ${user.isOnline}, isLive: ${user.isLive}, currentStreamId: ${user.currentStreamId}`);



        // Verificar se existe stream realmente ativa

        const hasActiveStream = await Streamer.findOne({ 

            hostId: userId, 

            isLive: true,

            streamStatus: 'active'

        });



        // Se usuÃ¡rio estÃ¡ marcado como isLive=true mas nÃ£o tem stream ativa, resetar status

        if (user.isLive && !hasActiveStream) {

            console.log(`[USER-ONLINE-INFOS] Resetando isLive=false - usuÃ¡rio marcado como live mas sem stream ativa`);

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



        // Verificar status online do usuÃ¡rio

        const isOnline = user.isOnline || false;

        const isLive = user.isLive || false;

        const currentStreamId = user.currentStreamId || undefined;



        // Dados completos do usuÃ¡rio online

        const onlineInfos = {

            // Status do usuÃ¡rio

            status: {

                isOnline: isOnline,

                isLive: isLive,

                currentStreamId: currentStreamId,

                lastSeen: user.lastSeen || new Date(),

                serverTime: new Date().toISOString()

            },

            

            // InformaÃ§Ãµes bÃ¡sicas do usuÃ¡rio

            user: {

                id: user.id,

                name: user.name,

                avatar: user.avatarUrl || '',

                cover: user.coverUrl || '',

                bio: user.bio || '',

                level: user.level || 1,

                isVerified: false, // Propriedade nÃ£o existe no modelo User

                fans: user.fans || 0,

                following: user.following || 0,

                country: user.country || 'BR',

                diamonds: user.diamonds || 0,

                coins: 0 // Propriedade nÃ£o existe no modelo User

            },

            

            // ConfiguraÃ§Ãµes da aplicaÃ§Ã£o

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

            

            // ConfiguraÃ§Ãµes padrÃ£o da live

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

            

            // ConfiguraÃ§Ã£o SRS para ingestÃ£o de vÃ­deo

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

            

            // PermissÃµes do usuÃ¡rio

            permissions: {

                canGoLive: !isLive, // SÃ³ pode iniciar live se nÃ£o estiver ao vivo

                canReceiveGifts: true,

                canSendGifts: user.diamonds > 0,

                canUsePK: (user.level || 0) >= 5,

                canCreatePrivate: true,

                canUseBeauty: true,

                maxDuration: 14400 // 4 horas

            },

            

            // EstatÃ­sticas do usuÃ¡rio

            stats: {

                totalStreams: 0, // TODO: Buscar do histÃ³rico

                totalViews: 0, // TODO: Buscar do histÃ³rico

                totalGifts: 0, // TODO: Buscar do histÃ³rico

                avgViewers: 0, // TODO: Calcular do histÃ³rico

                totalDiamonds: user.diamonds || 0

            }

        };



        // Atualizar status online do usuÃ¡rio

        await User.findOneAndUpdate(

            { id: userId },

            { $set: {

                isOnline: true,

                lastSeen: new Date()

            } }

        );



        console.log(`[USER-ONLINE-INFOS] Dados carregados para usuÃ¡rio: ${user.name}`);

        

        // Resposta no formato BuzzCast

        res.json({

            code: 0,

            msg: 'OK',

            data: onlineInfos

        });



    } catch (error) {

        console.error('[USER-ONLINE-INFOS] Erro ao carregar informaÃ§Ãµes:', error);

        res.status(500).json({

            code: 1,

            msg: 'Erro interno ao carregar informaÃ§Ãµes do usuÃ¡rio'

        });

    }

});



// GET /api/live/source-data - ConfiguraÃ§Ãµes iniciais do usuÃ¡rio (sourceDataNew) - LEGADO

router.get('/live/source-data', async (req, res) => {

    try {

        const userId = getUserIdFromToken(req);

        if (!userId) {

            return res.status(401).json({

                success: false,

                message: 'UsuÃ¡rio nÃ£o autenticado'

            });

        }



        const user = await findUserByAnyId(User, userId);

        if (!user) {

            return res.status(404).json({

                success: false,

                message: 'UsuÃ¡rio nÃ£o encontrado'

            });

        }



        // ConfiguraÃ§Ãµes do app e do usuÃ¡rio

        const sourceData = {

            // ConfiguraÃ§Ãµes do app

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

            

            // Dados do usuÃ¡rio

            user: {

                id: user.id,

                name: user.name,

                avatar: user.avatarUrl || '',

                cover: user.coverUrl || '',

                bio: user.bio || '',

                level: user.level || 1,

                isVerified: false, // Propriedade nÃ£o existe no modelo User

                followers: user.fans || 0, // Usar 'fans' em vez de 'followers'

                country: user.country || 'BR',

                diamonds: user.diamonds || 0

            },

            

            // ConfiguraÃ§Ãµes padrÃ£o da live

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

        console.error('[SOURCE-DATA] Erro ao buscar configuraÃ§Ãµes:', error);

        res.status(500).json({

            success: false,

            message: 'Erro ao buscar configuraÃ§Ãµes iniciais'

        });

    }

});



// ...





// REMOVIDO: Endpoint start paralelo - usar API real POST /streams



// GET /api/live/info - Endpoint LiveGo style para polling de status

router.get('/live/info', async (req, res) => {

    try {

        console.log('[LIVEGO-INFO] Buscando informaÃ§Ãµes da live...');

        

        const userId = getUserIdFromToken(req);

        if (!userId) {

            return res.status(401).json({ 

                code: 1, 

                msg: 'UsuÃ¡rio nÃ£o autenticado' 

            });

        }



        // ParÃ¢metros da query (LiveGo style)

        const { 

            liveId, 

            streamId, 

            likeNum = '0',

            pushIp,

            indexs = '1'

        } = req.query;



        console.log('[LIVEGO-INFO] ParÃ¢metros:', { liveId, streamId, likeNum, pushIp, indexs });



        // Buscar stream - priorizar streamId ou liveId

        let stream;

        if (streamId) {

            stream = await Streamer.findOne({ id: streamId });

        } else if (liveId) {

            stream = await Streamer.findOne({ liveId: liveId });

        } else {

            // Se nÃ£o especificar, buscar live atual do usuÃ¡rio

            stream = await Streamer.findOne({ 

                hostId: userId,

                isLive: true 

            });

        }



        if (!stream) {

            return res.status(404).json({

                code: 1,

                msg: 'Live nÃ£o encontrada',

                data: null

            });

        }



        // Buscar dados do host

        const host = await findUserByAnyId(User, stream.hostId);

        if (!host) {

            return res.status(404).json({

                code: 1,

                msg: 'Host nÃ£o encontrado',

                data: null

            });

        }



        // Contador de viewers online (via WebSocket ou banco)

        // TODO: Implementar serviÃ§o de contagem de viewers online em tempo real

        const viewerCount = stream.viewers || 0;



        // Buscar likes da stream

        // TODO: Implementar serviÃ§o de contagem de likes

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

        console.error('[LIVEGO-INFO] Erro ao buscar informaÃ§Ãµes:', error);

        res.status(500).json({

            code: 1,

            msg: 'Erro interno ao buscar informaÃ§Ãµes da live'

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

                msg: 'UsuÃ¡rio nÃ£o autenticado' 

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

                msg: 'Live nÃ£o encontrada'

            });

        }



        // Verificar se a live pertence ao usuÃ¡rio

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



        // Atualizar lastSeen do usuÃ¡rio

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

        console.log('[LIVEGO-MONITORING] Registrando sucesso da transmissÃ£o...');

        

        const userId = getUserIdFromToken(req);

        if (!userId) {

            return res.status(401).json({ 

                code: 1, 

                msg: 'UsuÃ¡rio nÃ£o autenticado' 

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

                msg: 'Live nÃ£o encontrada'

            });

        }



        // Registrar mÃ©tricas de sucesso

        const monitoringData = {

            streamId: stream.id,

            userId: userId,

            liveId: stream.liveId || stream.id,

            startTime: startTime || stream.startTime,

            successAt: new Date(),

            

            // MÃ©tricas de qualidade

            quality: quality || 'unknown',

            bitrate: bitrate || 0,

            resolution: resolution || 'unknown',

            fps: fps || 0,

            droppedFrames: droppedFrames || 0,

            

            // Status da conexÃ£o

            connectionStatus: 'success',

            streamingSuccess: true

        };



        // Salvar mÃ©tricas (poderia ser em uma coleÃ§Ã£o separada)

        console.log('[LIVEGO-MONITORING] MÃ©tricas registradas:', monitoringData);



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



// FunÃ§Ã£o utilitÃ¡ria para formatar duraÃ§Ã£o

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



// Endpoint START (PrÃ©-live/PreparaÃ§Ã£o) - Primeira API chamada conforme padrÃ£o SRS

router.post('/srs/start', async (req, res) => {

    try {

        console.log('[SRS-START] Iniciando preparaÃ§Ã£o...');

        

        const userId = getUserIdFromToken(req);

        

        if (!userId) {

            console.log('[SRS-START] Falha: UserID nÃ£o encontrado');

            return res.status(401).json({ code: 1, msg: 'UsuÃ¡rio nÃ£o autenticado' });

        }



        console.log('[SRS-START] Gerando IDs Ãºnicos...');

        // Gerar IDs Ãºnicos para a transmissÃ£o

        const timestamp = Date.now();

        const liveId = `live_${userId}_${timestamp}`;

        const streamId = `stream_${userId}_${timestamp}`;

        const streamKey = streamId; // Stream key simples = streamId



        // GERAR TOKEN JWT para autenticaÃ§Ã£o SRS

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

        // ConfiguraÃ§Ãµes SRS

        const srsHost = process.env.SRS_HOST || '72.60.249.175';

        const srsVhost = process.env.SRS_VHOST || '__defaultVhost__';

        const srsApp = process.env.SRS_APP || 'live';

        const srsRtmpPort = process.env.SRS_RTMP_PORT || '1935';



        // Construir URLs SRS

        const pushUrl = `rtmp://${srsHost}:${srsRtmpPort}/${srsApp}?vhost=${srsVhost}&token=${token}`;

        const rtmpUrl = `rtmp://${srsHost}:${srsRtmpPort}/${srsApp}/${streamId}?vhost=${srsVhost}&token=${token}`;

        const webrtcUrl = `webrtc://${srsHost}/${srsApp}/${streamId}?vhost=${srsVhost}&token=${token}`;

        // HLS URL para reproduÃ§Ã£o via proxy HTTPS (evita mixed content)
        const BACKEND_URL = process.env.BACKEND_URL || 'https://api.livego.store';
        const hlsUrl = `${BACKEND_URL}/api/video/http/live/${streamId}.m3u8`;

        console.log('[SRS-START] URLs SRS configuradas');



        console.log('[SRS-START] Buscando dados do usuÃ¡rio no MongoDB...');

        // Buscar dados do usuÃ¡rio

        const user = await findUserByAnyId(User, userId);

        console.log('[SRS-START] UsuÃ¡rio encontrado:', user ? 'SIM' : 'NÃƒO');

        if (!user) {

            return res.status(404).json({ 

                code: 1, 

                msg: 'UsuÃ¡rio nÃ£o encontrado' 

            });

        }



        const hostName = user.name || 'Unknown';

        const hostAvatar = user.avatarUrl || '';



        // Armazenar sessÃ£o da live no banco para validaÃ§Ã£o posterior

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



        // Salvar sessÃ£o no MongoDB

        try {
            const db = getDb();
            await db.collection('live_sessions').insertOne(liveSession);
            console.log(`[SRS-START] SessÃ£o salva: ${liveId}`);
        } catch (sessionError) {
            console.error('[SRS-START] Erro ao salvar sessÃ£o:', sessionError);
        }



        // Resposta conforme documentaÃ§Ã£o SRS

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

                hlsUrl, // URL HLS para reproduÃ§Ã£o no ExoPlayer (Android) e LivePlayer (Web)

                vhost: srsVhost,

                app: srsApp,

                stream: streamId,



                // Metadados

                hostId: userId,

          hostName: user.name,

                hostAvatar: user.avatarUrl,

                preparedAt: new Date().toISOString(),

                status: 'prepared' // Status: prepared para prÃ©-live

            }

        };



        console.log('[SRS-START] TransmissÃ£o preparada com sucesso:', { liveId, streamId, token });

        res.json(response);



    } catch (error) {

        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

        const errorStack = error instanceof Error ? error.stack : undefined;

        const errorName = error instanceof Error ? error.name : 'UnknownError';

        

        console.error('[SRS-START] Erro na preparaÃ§Ã£o - Detalhes:', {

            message: errorMessage,

            stack: errorStack,

            name: errorName

        });

        res.status(500).json({ 

            code: 1,

            msg: `Erro interno ao preparar transmissÃ£o: ${errorMessage}` 

        });

    }

});



// Endpoint PUBLISH - Usa token gerado na START e inicia transmissÃ£o SRS

router.post('/srs/publish', async (req, res) => {

    try {

        console.log('[SRS-PUBLISH] Iniciando publicaÃ§Ã£o com token da START...');

        

        const userId = getUserIdFromToken(req);

        if (!userId) {

            return res.status(401).json({ 

                code: 1,

                msg: 'UsuÃ¡rio nÃ£o autenticado' 

            });

        }



        // Buscar dados do usuÃ¡rio

        const user = await findUserByAnyId(User, userId);

        if (!user) {

            return res.status(404).json({ 

                code: 1,

                msg: 'UsuÃ¡rio nÃ£o encontrado' 

            });

        }



        // VALIDAR TOKEN DA START - Buscar sessÃ£o preparada

        const jwt = require('jsonwebtoken');

        const srsSecret = process.env.SRS_SECRET || 'srs-secret-key';

        

        // O frontend deve enviar o token gerado na START

        const { token } = req.body;

        if (!token) {

            return res.status(400).json({ 

                code: 1,

                msg: 'Token da START Ã© obrigatÃ³rio' 

            });

        }



        // Validar e decodificar token JWT

        let decodedToken;

        try {

            decodedToken = jwt.verify(token, srsSecret);

            console.log('[SRS-PUBLISH] Token validado:', decodedToken);

        } catch (error) {

            console.error('[SRS-PUBLISH] Token invÃ¡lido:', error);

            return res.status(401).json({ 

                code: 1,

                msg: 'Token invÃ¡lido ou expirado' 

            });

        }



        // Verificar se o token pertence ao usuÃ¡rio correto

        if (decodedToken.userId !== userId) {

            return res.status(401).json({ 

                code: 1,

                msg: 'Token nÃ£o pertence ao usuÃ¡rio' 

            });

        }



        // Usar dados do token (gerados na START)

        const { liveId, streamId, streamKey } = decodedToken;



        // ConfiguraÃ§Ãµes SRS conforme documentaÃ§Ã£o

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



        // Atualizar status do usuÃ¡rio

        await User.findOneAndUpdate(

            { id: userId },

            { $set: {

                isLive: true,

                currentStreamId: streamId

            } }

        );



        console.log(`[SRS-PUBLISH] TransmissÃ£o iniciada: ${streamId} para usuÃ¡rio ${userId}`);

        console.log(`[SRS-PUBLISH] Usando token da START: ${token.substring(0, 20)}...`);

        console.log(`[SRS-PUBLISH] WebRTC URL: ${webrtcUrl}`);



        // Retorno conforme padrÃ£o SRS com dados reais

        res.json({

            code: 0,

            msg: 'OK',

            data: {

                // Dados essenciais SRS (do token START)

                streamId: streamId,

                liveId: liveId,

                streamKey: streamKey,

                token: token, // Token JWT da START

                

                // URLs para publicaÃ§Ã£o (dinÃ¢micas)

                pushUrl: pushUrl,

                rtmpUrl: pushUrl,

                webrtcUrl: webrtcUrl,

                

                // URLs para reproduÃ§Ã£o (dinÃ¢micas)

                playbackUrl: httpFlvUrl,

                hlsUrl: hlsUrl,

                

                // ConfiguraÃ§Ãµes SRS (dinÃ¢micas)

                vhost: vhost,

                app: app,

                stream: streamId,

                

                // Metadados (dados reais do usuÃ¡rio)

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

            msg: 'Erro interno ao iniciar transmissÃ£o' 

        });

    }

});



// Endpoint POST /live/clear - Limpar lives ativas Ã³rfÃ£s
router.post('/live/clear', async (req, res) => {
    try {
        console.log('[LIVE-CLEAR] Limpando lives ativas Ã³rfÃ£s...');
        
        const userId = getUserIdFromToken(req);
        console.log('[LIVE-CLEAR] User ID extraÃ­do do token:', userId);

        if (!userId) {
            console.log('[LIVE-CLEAR] Erro: UsuÃ¡rio nÃ£o autenticado');
            return res.status(401).json({ 
                success: false,
                message: 'UsuÃ¡rio nÃ£o autenticado' 
            });
        }

        // Buscar todas as lives ativas do usuÃ¡rio
        const activeStreams = await Streamer.find({ 
            hostId: userId,
            isLive: true 
        });

        console.log(`[LIVE-CLEAR] Encontradas ${activeStreams.length} lives ativas para o usuÃ¡rio ${userId}`);

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

        // Atualizar status do usuÃ¡rio
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

// POST /api/permissions/audio/request - Solicitar permissÃ£o de gravaÃ§Ã£o de Ã¡udio
router.post('/permissions/audio/request', async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'UsuÃ¡rio nÃ£o autenticado'
            });
        }

        const { purpose = 'live_streaming' } = req.body;

        console.log(`[AUDIO-PERMISSION] UsuÃ¡rio ${userId} solicitando permissÃ£o para: ${purpose}`);

        // Registrar solicitaÃ§Ã£o de permissÃ£o no usuÃ¡rio
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
                message: 'PermissÃ£o de Ã¡udio solicitada com sucesso'
            }
        });

    } catch (error: any) {
        console.error('[AUDIO-PERMISSION] Erro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao solicitar permissÃ£o de Ã¡udio',
            error: error.message
        });
    }
});

// POST /api/permissions/audio/grant - Conceder permissÃ£o de gravaÃ§Ã£o de Ã¡udio
router.post('/permissions/audio/grant', async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'UsuÃ¡rio nÃ£o autenticado'
            });
        }

        const { requestId, permanent = false } = req.body;

        console.log(`[AUDIO-PERMISSION] UsuÃ¡rio ${userId} concedeu permissÃ£o, permanente: ${permanent}`);

        // Atualizar status de permissÃ£o do usuÃ¡rio
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
                message: 'PermissÃ£o de Ã¡udio concedida com sucesso'
            }
        });

    } catch (error: any) {
        console.error('[AUDIO-PERMISSION] Erro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao conceder permissÃ£o de Ã¡udio',
            error: error.message
        });
    }
});

// POST /api/permissions/audio/deny - Negar permissÃ£o de gravaÃ§Ã£o de Ã¡udio
router.post('/permissions/audio/deny', async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'UsuÃ¡rio nÃ£o autenticado'
            });
        }

        const { requestId } = req.body;

        console.log(`[AUDIO-PERMISSION] UsuÃ¡rio ${userId} negou permissÃ£o de Ã¡udio`);

        // Atualizar status de permissÃ£o do usuÃ¡rio
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
                message: 'PermissÃ£o de Ã¡udio negada'
            }
        });

    } catch (error: any) {
        console.error('[AUDIO-PERMISSION] Erro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao negar permissÃ£o de Ã¡udio',
            error: error.message
        });
    }
});

// GET /api/permissions/audio/status - Verificar status da permissÃ£o de Ã¡udio
router.get('/permissions/audio/status', async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'UsuÃ¡rio nÃ£o autenticado'
            });
        }

        const user = await findUserByAnyId(User, userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'UsuÃ¡rio nÃ£o encontrado'
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
                message: `Status da permissÃ£o: ${user.audioRecordingEnabled ? 'Concedida' : (user.audioRecordingDeniedAt ? 'Negada' : 'Pendente')}`
            }
        });

    } catch (error: any) {
        console.error('[AUDIO-PERMISSION] Erro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao verificar status da permissÃ£o',
            error: error.message
        });
    }
});

// POST /api/permissions/camera/request - Solicitar permissÃ£o de cÃ¢mera
router.post('/permissions/camera/request', async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'UsuÃ¡rio nÃ£o autenticado'
            });
        }

        const { purpose = 'live_streaming' } = req.body;

        console.log(`[CAMERA-PERMISSION] UsuÃ¡rio ${userId} solicitando permissÃ£o para: ${purpose}`);

        // Registrar solicitaÃ§Ã£o de permissÃ£o no usuÃ¡rio
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
                message: 'PermissÃ£o de cÃ¢mera solicitada com sucesso'
            }
        });

    } catch (error: any) {
        console.error('[CAMERA-PERMISSION] Erro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao solicitar permissÃ£o de cÃ¢mera',
            error: error.message
        });
    }
});

// POST /api/permissions/camera/grant - Conceder permissÃ£o de cÃ¢mera
router.post('/permissions/camera/grant', async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'UsuÃ¡rio nÃ£o autenticado'
            });
        }

        const { requestId, permanent = false } = req.body;

        console.log(`[CAMERA-PERMISSION] UsuÃ¡rio ${userId} concedeu permissÃ£o, permanente: ${permanent}`);

        // Atualizar status de permissÃ£o do usuÃ¡rio
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
                message: 'PermissÃ£o de cÃ¢mera concedida com sucesso'
            }
        });

    } catch (error: any) {
        console.error('[CAMERA-PERMISSION] Erro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao conceder permissÃ£o de cÃ¢mera',
            error: error.message
        });
    }
});

// POST /api/permissions/camera/deny - Negar permissÃ£o de cÃ¢mera
router.post('/permissions/camera/deny', async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'UsuÃ¡rio nÃ£o autenticado'
            });
        }

        const { requestId } = req.body;

        console.log(`[CAMERA-PERMISSION] UsuÃ¡rio ${userId} negou permissÃ£o de cÃ¢mera`);

        // Atualizar status de permissÃ£o do usuÃ¡rio
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
                message: 'PermissÃ£o de cÃ¢mera negada'
            }
        });

    } catch (error: any) {
        console.error('[CAMERA-PERMISSION] Erro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao negar permissÃ£o de cÃ¢mera',
            error: error.message
        });
    }
});

// GET /api/permissions/camera/status - Verificar status da permissÃ£o de cÃ¢mera
router.get('/permissions/camera/status', async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'UsuÃ¡rio nÃ£o autenticado'
            });
        }

        const user = await findUserByAnyId(User, userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'UsuÃ¡rio nÃ£o encontrado'
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
                message: `Status da permissÃ£o: ${user.cameraAccessEnabled ? 'Concedida' : (user.cameraAccessDeniedAt ? 'Negada' : 'Pendente')}`
            }
        });

    } catch (error: any) {
        console.error('[CAMERA-PERMISSION] Erro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao verificar status da permissÃ£o',
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
        console.log('[LIVE-START] User ID extraÃ­do do token:', userId);

        if (!userId) {
            console.log('[LIVE-START] Erro: UsuÃ¡rio nÃ£o autenticado');
            return res.status(401).json({ 
                success: false,
                message: 'UsuÃ¡rio nÃ£o autenticado' 
            });
        }

        // Buscar dados do usuÃ¡rio
        console.log('[LIVE-START] Buscando usuÃ¡rio com ID:', userId);
        const user = await findUserByAnyId(User, userId);
        console.log('[LIVE-START] UsuÃ¡rio encontrado:', user ? 'SIM' : 'NÃƒO');

        if (!user) {
            console.log('[LIVE-START] Erro: UsuÃ¡rio nÃ£o encontrado');
            return res.status(404).json({ 
                success: false,
                message: 'UsuÃ¡rio nÃ£o encontrado' 
            });
        }

        // Dados da live - ValidaÃ§Ã£o do payload
        console.log('[LIVE-START] Validando payload...');
        
        const { name, title, description, category = 'popular' } = req.body;
        
        // Aceitar tanto 'name' quanto 'title' - priorizar 'title' se ambos existirem
        const liveTitle = title || name;
        
                
        console.log('[LIVE-START] Payload validado com sucesso');

        // Gerar IDs Ãºnicos
        const streamId = `stream_${userId}`;
        const liveId = uuidv4();

        // ConfiguraÃ§Ãµes SRS
        const srsHost = process.env.SRS_HOST || '72.60.249.175';
        const srsPort = process.env.SRS_PORT || '1935';
        const srsApp = process.env.SRS_APP || 'live';
        const vhost = process.env.SRS_VHOST || '__defaultVhost__';

        // URLs dinÃ¢micas
        const pushUrl = `rtmp://${srsHost}:${srsPort}/${srsApp}/${streamId}`;
        const webrtcUrl = `webrtc://${srsHost}:8000/${srsApp}/${streamId}`;
        const BACKEND_URL = process.env.BACKEND_URL || 'https://api.livego.store';
        const httpFlvUrl = `${BACKEND_URL}/api/video/http/live/${streamId}.flv`;
        const hlsUrl = `${BACKEND_URL}/api/video/http/live/${streamId}.m3u8`;

        // Dados da stream â€” registro provisÃ³rio (isLive false atÃ© SRS on_publish)
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

        // Upsert: atualiza se jÃ¡ existir, cria se nÃ£o existir
        const newStream = await Streamer.findOneAndUpdate(
            { hostId: userId },
            { $set: streamerData },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Atualizar status do usuÃ¡rio (isLive sÃ³ serÃ¡ true quando SRS chamar on_publish)
        await User.findOneAndUpdate(
            { id: userId },
            { $set: { 
                isLive: true,
                isOnline: true,
                currentStreamId: streamId,
                lastSeen: new Date().toISOString()
            } }
        );

        // Atualizar status online na coleÃ§Ã£o userstatuses

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



        console.log(`[STREAM-START] Stream ${streamId} iniciada para usuÃ¡rio ${userId}`);



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

                message: 'UsuÃ¡rio nÃ£o autenticado' 

            });

        }



        const { id } = req.params;



        // Buscar stream

        const stream = await Streamer.findOne({ id });

        if (!stream) {

            return res.status(404).json({ 

                success: false, 

                message: 'Stream nÃ£o encontrado' 

            });

        }



        // Verificar se stream estÃ¡ ativa

        if (!stream.isLive || stream.streamStatus !== 'active') {

            return res.status(400).json({ 

                success: false, 

                message: 'Stream nÃ£o estÃ¡ ativa' 

            });

        }



        // Buscar dados do espectador

        const viewer = await User.findOne({ id: userId });

        if (!viewer) {

            return res.status(404).json({ 

                success: false, 

                message: 'UsuÃ¡rio nÃ£o encontrado' 

            });

        }



        // Incrementar viewers (simples, poderia melhorar com Redis)

        await Streamer.findOneAndUpdate(

            { id },

            { $inc: { viewers: 1 } }

        );



        console.log(`[STREAM-JOIN] UsuÃ¡rio ${userId} entrou na live ${id}`);



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



// POST /api/streams/:id/publish-token - Obter token para publicaÃ§Ã£o WebRTC

router.post('/streams/:id/publish-token', async (req, res) => {

    try {

        console.log('[STREAM-PUBLISH-TOKEN] Gerando token de publicaÃ§Ã£o...');

        

        const userId = getUserIdFromToken(req);

        if (!userId) {

            return res.status(401).json({ 

                success: false, 

                message: 'UsuÃ¡rio nÃ£o autenticado' 

            });

        }



        const { id } = req.params;



        // Buscar stream

        const stream = await Streamer.findOne({ id, hostId: userId });

        if (!stream) {

            return res.status(404).json({ 

                success: false, 

                message: 'Stream nÃ£o encontrado' 

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



        // ConfiguraÃ§Ãµes SRS para WebRTC

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

            console.log('[STREAM-END] ERRO: UsuÃ¡rio nÃ£o autenticado');

            return res.status(401).json({ 

                success: false, 

                message: 'UsuÃ¡rio nÃ£o autenticado' 

            });

        }

        

        // Buscar stream - primeiro tentar com hostId, depois sÃ³ com ID

        let stream = await Streamer.findOne({ id, hostId: userId });

        

        if (!stream) {

            stream = await Streamer.findOne({ id });

            if (stream) {

                console.log('[STREAM-END] Stream encontrada por ID, hostId:', stream.hostId);

                

                // Verificar se pertence ao usuÃ¡rio (verificaÃ§Ã£o adicional)

                if (stream.hostId !== userId) {

                    console.log('[STREAM-END] ERRO: Stream pertence a outro usuÃ¡rio');

                    return res.status(403).json({ 

                        success: false, 

                        message: 'Stream nÃ£o pertence a este usuÃ¡rio' 

                    });

                }

            }

        }

        

        if (!stream) {

            console.log('[STREAM-END] ERRO: Stream nÃ£o encontrada');

            return res.status(404).json({ 

                success: false, 

                message: 'Stream nÃ£o encontrada' 

            });

        }



        // Finalizar stream

        stream.isLive = false;

        stream.streamStatus = 'ended';

        stream.endTime = new Date();

        stream.endedAt = new Date();

        stream.endedBy = userId;

        await stream.save();



        // Atualizar usuÃ¡rio

        await User.findOneAndUpdate(

            { id: userId },

            { $set: { 

                isLive: false, 

                currentStreamId: null

            } }

        );



        console.log(`[STREAM-END] Stream ${id} finalizada para usuÃ¡rio ${userId}`);



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



// GET /api/lives/:id - Obter detalhes de uma live especÃ­fica});



// POST /api/streams - Criar uma nova stream (draft)
router.post('/streams', async (req, res) => {
    try {
        const { name, title, country, category = 'popular' } = req.body;
        const hostId = getUserIdFromToken(req);

        if (!hostId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const user = await User.findOne({ id: hostId });
        if (!user) {
            return res.status(404).json({ success: false, error: 'Host not found' });
        }

        const streamId = hostId;
        const streamTitle = name || title || `Live de ${user.name}`;

        const stream = await Streamer.findOneAndUpdate(
            { hostId },
            { 
                $set: {
                    id: streamId,
                    hostId,
                    name: user.name,
                    avatar: user.avatarUrl || '',
                    title: streamTitle,
                    category,
                    isLive: true,
                    streamStatus: 'active',
                    startTime: new Date(),
                    viewers: 0,
                    country: country || user.country || 'BR'
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        await User.findOneAndUpdate({ id: hostId }, { isLive: true, currentStreamId: streamId });

        res.json({ success: true, stream });
    } catch (error: any) {
        console.error('[STREAMS-POST] Erro:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/streams - Listar streams (rota principal para frontend)
router.get('/streams', async (req, res) => {
    try {
        console.log('[API-STREAMS] Listando streams...');

        // ParÃ¢metros de query
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



        // Usar mapper de proteÃ§Ã£o

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



// POST /end-session - Encerrar sessÃ£o (compatibilidade)

router.post('/end-session', async (req, res) => {

    try {

        console.log('[END-SESSION] Encerrando sessÃ£o...');

        

        const userId = getUserIdFromToken(req);

        if (!userId) {

            return res.status(401).json({ 

                success: false, 

                message: 'UsuÃ¡rio nÃ£o autenticado' 

            });

        }



        // Encerrar todas as streams do usuÃ¡rio

        const result = await Streamer.updateMany(
            { hostId: userId, isLive: true },
            { $set: {
                isLive: false,
                streamStatus: 'ended',
                endTime: new Date()
            } }
        );



        // Atualizar usuÃ¡rio

        await User.findOneAndUpdate(

            { id: userId },

            { $set: { 

                isLive: false, 

                currentStreamId: null 

            } }
        );



        console.log(`[END-SESSION] SessÃ£o encerrada para usuÃ¡rio ${userId}. Streams afetadas: ${result.modifiedCount}`);



        res.json({

            success: true,

            message: 'SessÃ£o encerrada com sucesso',

            streamsEnded: result.modifiedCount

        });



    } catch (error: any) {

        console.error('[END-SESSION] Erro:', error);

        res.status(500).json({ 

            success: false, 

            message: 'Erro interno ao encerrar sessÃ£o',

            error: error instanceof Error ? error.message : String(error) 

        });

    }

});



// DELETE /rtc/v1/stop - Parar WebRTC com cleanup completo

router.delete('/rtc/v1/stop', async (req, res) => {

    try {

        console.log('[RTC-STOP] Parando sessÃ£o WebRTC...');

        

        const userId = getUserIdFromToken(req);

        if (!userId) {

            return res.status(401).json({ 

                success: false, 

                message: 'UsuÃ¡rio nÃ£o autenticado' 

            });

        }



        const { streamId, sessionId } = req.body;



        if (!streamId) {

            return res.status(400).json({ 

                success: false, 

                message: 'streamId Ã© obrigatÃ³rio' 

            });

        }



        console.log(`[RTC-STOP] Procurando stream: ${streamId} para usuÃ¡rio: ${userId}`);



        // Buscar stream (fallback se hostId nÃ£o bater)

        let stream = await Streamer.findOne({ id: streamId, hostId: userId });

        if (!stream) {

            console.log('[RTC-STOP] Stream nÃ£o encontrada com hostId, tentando sÃ³ com ID...');

            stream = await Streamer.findOne({ id: streamId });

        }



        if (!stream) {

            return res.status(404).json({ 

                success: false, 

                message: 'Stream nÃ£o encontrada' 

            });

        }



    

        // Finalizar stream no banco

        stream.isLive = false;

        stream.streamStatus = 'ended';

        stream.endTime = new Date();

        stream.endedAt = new Date();

        stream.endedBy = userId;

        await stream.save();



        // TODO: Implementar cache invalidaÃ§Ã£o quando ActiveStreamService for criado

        console.log(`[STREAM END] Cache limpo para usuÃ¡rio ${userId} (TODO: implementar ActiveStreamService)`);

        // Atualizar usuÃ¡rio - MANTER currentStreamId para reconexÃ£o
        await User.findOneAndUpdate(
            { id: userId },
            { $set: { 
                isLive: false, 
                // MANTER currentStreamId para permitir reconexÃ£o
                // currentStreamId: null, 
                lastSeen: new Date().toISOString()
            } }
        );



        console.log(`[RTC-STOP] Status final: isLive=${stream.isLive}, streamStatus=${stream.streamStatus}`);



        res.json({

            success: true,

            message: 'SessÃ£o WebRTC encerrada com sucesso',

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



// --- ENDPOINTS PARA ASSOCIAÃ‡ÃƒO STREAMKEY-USUÃRIO ---



/**

 * Endpoint para associar streamKey com usuÃ¡rio

 * POST /live/stream-association

 */

router.post('/stream-association', async (req, res) => {

    try {

        const userId = getUserIdFromToken(req);

        if (!userId) {

            return res.status(401).json({

                success: false,

                message: 'Token invÃ¡lido'

            });

        }



        const { streamKey, title } = req.body;



        if (!streamKey) {

            return res.status(400).json({

                success: false,

                message: 'streamKey Ã© obrigatÃ³rio'

            });

        }



        // Buscar usuÃ¡rio

        const user = await User.findOne({ id: userId });

        if (!user) {

            return res.status(404).json({

                success: false,

                message: 'UsuÃ¡rio nÃ£o encontrado'

            });

        }



        // ValidaÃ§Ã£o de streamKey Ãºnico e sanitizaÃ§Ã£o

        const sanitizedStreamKey = streamKey.trim().replace(/[^a-zA-Z0-9_]/g, '');

        

        if (!sanitizedStreamKey || sanitizedStreamKey.length < 3) {

            return res.status(400).json({

                success: false,

                message: 'streamKey invÃ¡lido - mÃ­nimo 3 caracteres alfanumÃ©ricos'

            });

        }



        // Verificar se streamKey jÃ¡ existe

        const existingAssociation = await StreamKeyAssociation.findOne({ streamKey: sanitizedStreamKey });

        if (existingAssociation) {

            return res.status(400).json({

                success: false,

                message: 'streamKey jÃ¡ estÃ¡ em uso'

            });

        }



        // Criar associaÃ§Ã£o

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

            message: 'AssociaÃ§Ã£o criada com sucesso',

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

            message: 'Erro interno ao criar associaÃ§Ã£o',

            error: error.message

        });

    }

});



/**

 * Endpoint para consultar informaÃ§Ãµes do stream por streamKey

// ============================================
// SRS Live Routes â€” IntegraÃ§Ã£o com SRS conforme documentaÃ§Ã£o oficial
// Fluxo: App â†’ Backend â†’ SRS
// Backend controla o SRS, nÃ£o transmite vÃ­deo
// ============================================

/**
 * POST /api/streams
 * 
 * Inicia uma nova live usando SRS WebRTC
 * Gera streamId e retorna streamUrl para o app conectar ao SRS
 * 
 * Backend NÃƒO envia vÃ­deo, sÃ³ organiza dados
 */
router.post('/start', async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const { name, tags = [], message = '', isPrivate = false, category = 'live' } = req.body;

    if (!userId) {
      return ResponseHelper.error(res, 'Unauthorized - Token invÃ¡lido', 401);
    }

    if (!name) {
      return ResponseHelper.error(res, 'name Ã© obrigatÃ³rio', 400);
    }

    // Gerar streamId Ãºnico
    const streamId = `live_${userId}_${Date.now()}`;

    // URLs via proxy backend (evita mixed content em produÃ§Ã£o)
    const BACKEND_URL = (process.env.BACKEND_URL || 'https://api.livego.store').replace(/\/+$/, '');
    const SRS_API_URL = process.env.SRS_API_URL || 'https://srs:1990';
    const backendHttp = `${BACKEND_URL}/api/video/http`;

    // Criar/Atualizar stream no banco (sem restriÃ§Ã£o de live ativa)
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

    console.log(`ðŸŽ¬ [SRS] Live iniciada: streamId=${streamId}, userId=${userId}`);
    console.log(`ðŸ“¡ [SRS] streamId: ${streamId}`);

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
    console.error('âŒ [SRS] Erro ao iniciar live:', error);
    ResponseHelper.error(res, error.message);
  }
});

/**
 * GET /api/live/:streamId
 * 
 * ObtÃ©m informaÃ§Ãµes de uma live
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
      return ResponseHelper.error(res, 'Live nÃ£o encontrada', 404);
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
    console.error('âŒ [SRS] Erro ao obter live:', error);
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
      return ResponseHelper.error(res, 'Unauthorized - Token invÃ¡lido', 401);
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
      return ResponseHelper.error(res, 'Live nÃ£o encontrada ou sem permissÃ£o', 404);
    }

    console.log(`ðŸ›‘ [SRS] Live finalizada: streamId=${streamId}, userId=${userId}`);

    ResponseHelper.success(res, { message: 'Live finalizada com sucesso' });

  } catch (error: any) {
    console.error('âŒ [SRS] Erro ao finalizar live:', error);
    ResponseHelper.error(res, error.message);
  }
});

router.get('/stream-info', async (req, res) => {

    try {

        const { streamKey } = req.query;



        if (!streamKey) {

            return res.status(400).json({

                success: false,

                message: 'streamKey Ã© obrigatÃ³rio'

            });

        }



        // Buscar associaÃ§Ã£o do streamKey

        const association = await StreamKeyAssociation.findOne({ streamKey, isActive: true });

        if (!association) {

            return res.status(404).json({

                success: false,

                message: 'streamKey nÃ£o encontrado ou inativo'

            });

        }



        // Buscar informaÃ§Ãµes adicionais do usuÃ¡rio

        const user = await User.findOne({ id: association.userId });

        if (!user) {

            return res.status(404).json({

                success: false,

                message: 'UsuÃ¡rio associado nÃ£o encontrado'

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

            message: 'Erro interno ao consultar informaÃ§Ãµes',

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

                message: 'Usu+írio n+úo autenticado' 

            });

        }



        // Buscar usu+írio para encontrar stream ativa

        const user = await findUserByAnyId(User, userId);

        if (!user) {

            return res.status(404).json({ 

                success: false,

                message: 'Usu+írio n+úo encontrado' 

            });

        }



        // Buscar stream ativa do usu+írio

        const activeStream = await Streamer.findOne({ 

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



        // Atualizar status do usu+írio + persistir atividade

        await User.findOneAndUpdate(

            { id: userId },

            {

                $set: {

                    isLive: false,

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
        const activeBattle = await Battle.findOne({
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

        console.log(`[LIVE-END] Live encerrada: ${activeStream.id} para usu+írio ${userId}`);

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



        console.log(`­ƒöì [DEBUG] API Route called - Category: ${category}, Country: ${country || 'none'}`);

        console.log(`­ƒöì [SECURITY] User-Agent: ${userAgent}, Referer: ${referer}`);

        

        // DETEC+ç+âO DE FERRAMENTAS DE GRAVA+ç+âO/SCRAPING

        const recordingIndicators = [

            'ffmpeg', 'vlc', 'obs', 'streamrecorder', 'youtube-dl', 'yt-dlp',

            'wget', 'curl', 'python-requests', 'node-fetch', 'postman',

            'insomnia', 'swagger', 'api-client', 'httpie', 'scrapy'

        ];

        

        const isRecordingAttempt = recordingIndicators.some(indicator => 

            userAgent.toLowerCase().includes(indicator.toLowerCase())

        );

        

        const isDirectApiAccess = !referer || (referer.includes('localhost') && userAgent.includes('curl'));

        

        // ­ƒÜ¿ BLOQUEAR ACESSO DE FERRAMENTAS DE GRAVA+ç+âO

        if (isRecordingAttempt || isDirectApiAccess) {

            console.log(`­ƒÜ¿ [RECORDING BLOCKED] Category: ${category}, User-Agent: ${userAgent}`);

            return res.json([]); // Retornar lista vazia

        }



        // Base filter para streams ativos e v+ílidas

        let baseFilter: any = {

            isLive: true,

            name: { $exists: true, $nin: ['', null] },

            hostId: { $exists: true, $nin: ['', null] },

            avatar: { $exists: true, $nin: ['', null] },

            // ­ƒÜÇ FILTRO RIGOROSO: apenas streams realmente ao vivo

            startTime: { $exists: true, $ne: null },

            streamStatus: 'active',

            // ­ƒÜÇ VERIFICAR SE O HOST EST+ü REALMENTE ONLINE

            viewers: { $exists: true, $gte: 0 },

            // ­ƒÜÇ VERIFICAR SE TEM DADOS DE TRANSMISS+âO

            rtmpIngestUrl: { $exists: true, $ne: null },

            playbackUrl: { $exists: true, $ne: null }

        };



        // Se for "global" ou "popular", retorna todas as lives ativas E v+ílidas

        if (category === 'global' || category === 'popular') {

            let filter = baseFilter;



            // Se houver filtro por pa+¡s, adicionar ao filter

            if (country && country !== 'ICON_GLOBE') {

                filter.country = country;

                console.log(`­ƒîì Filtering streams by country: ${country}`);

            }



            console.log(`­ƒöì [DEBUG] Final filter for global/popular:`, JSON.stringify(filter, null, 2));



            const streams = await Streamer.find(filter).sort({ viewers: -1 });

            console.log(`­ƒô¦ Found ${streams.length} streams for category: ${category}, country: ${country || 'all'}`);



            // Log country codes of returned streams for debugging

            if (streams.length > 0) {

                const countryCodes = streams.map(s => s.country || 'undefined').join(', ');

                console.log(`­ƒîì [DEBUG] Stream country codes: ${countryCodes}`);

            }



            // Transformar array de streams SRS para formato frontend usando mapper SRS

            const srsStreamsData = mapSrsStreamsArray(streams as any);

            // Aplicar prote+º+úo m+íxima aos dados transformados (converter para tipo compat+¡vel)

            const protectedStreams = mapStreamsToProtectedArrayFlexible(streams as any);

            

            return res.json(protectedStreams);

        }



        // Para categorias espec+¡ficas, filtra por tag ou categoria E valida dados

        let categoryFilter: any = {

            ...baseFilter,

            $or: [

                { category: category.toLowerCase() },

                { tags: { $in: [category.toLowerCase()] } }

            ]

        };



        // Se houver filtro por pa+¡s em categorias espec+¡ficas

        if (country && country !== 'ICON_GLOBE') {

            categoryFilter.country = country;

            console.log(`­ƒîì Filtering ${category} streams by country: ${country}`);

        }



        console.log(`­ƒöì [DEBUG] Final filter for category "${category}":`, JSON.stringify(categoryFilter, null, 2));



        const categoryStreams = await Streamer.find(categoryFilter).sort({ viewers: -1 });

        console.log(`­ƒô¦ Found ${categoryStreams.length} streams for category: ${category}, country: ${country || 'all'}`);



        // Log country codes of returned streams for debugging

        if (categoryStreams.length > 0) {

            const countryCodes = categoryStreams.map(s => s.country || 'undefined').join(', ');

            console.log(`­ƒîì [DEBUG] Category stream country codes: ${countryCodes}`);

        }



        // Retornar streams da categoria COM PROTECAO MAXIMA - SEM IDs REAIS usando mapper flex+¡vel

        const protectedCategoryStreams = mapStreamsToProtectedArrayFlexible(categoryStreams as any);

        

        res.json(protectedCategoryStreams);

    } catch (error: any) {

        console.error('Error fetching streams:', error);

        res.status(500).json({ error: error.message });

    }

});



// Rota para buscar streams por regi+úo

// API para listar lives ativas

// ===== ROUTE START =====
router.get('/streams/live', async (req, res) => {

    try {

        const userAgent = req.get('User-Agent') || '';

        const referer = req.get('Referer') || '';

        

        console.log(`­ƒöì [STREAMS LIVE] Buscando lives ativas`);

        console.log(`­ƒöì [SECURITY] User-Agent: ${userAgent}, Referer: ${referer}`);

        

        // DETEC+ç+âO DE FERRAMENTAS DE GRAVA+ç+âO/SCRAPING

        const recordingIndicators = [

            'ffmpeg', 'vlc', 'obs', 'streamrecorder', 'youtube-dl', 'yt-dlp',

            'wget', 'curl', 'python-requests', 'node-fetch', 'postman',

            'insomnia', 'swagger', 'api-client', 'httpie', 'scrapy'

        ];

        

        const isRecordingAttempt = recordingIndicators.some(indicator => 

            userAgent.toLowerCase().includes(indicator.toLowerCase())

        );

        

        const isDirectApiAccess = !referer || (referer.includes('localhost') && userAgent.includes('curl'));

        

        // ­ƒÜ¿ BLOQUEAR ACESSO DE FERRAMENTAS DE GRAVA+ç+âO

        if (isRecordingAttempt || isDirectApiAccess) {

            console.log(`­ƒÜ¿ [RECORDING BLOCKED] Streams live, User-Agent: ${userAgent}`);

            return res.json([]); // Retornar lista vazia

        }



        // Otimizado: Buscar streams ativas com populate para evitar N+1 consultas

        const activeStreams = await Streamer.find({

            isLive: true,

            streamStatus: 'active',

            name: { $exists: true, $nin: ['', null] },

            hostId: { $exists: true, $nin: ['', null] }

        })

        .populate('hostId', 'id name avatarUrl level country isOnline')

        // Enriquecer streams com dados dos hosts usando mapper especializado

        const streamsWithHostData = enrichStreamsWithHostData(activeStreams as any, {

            name: 'Usu+írio',

            avatar: '',

            level: 1,

            country: 'XX',

            isOnline: false

        });

        console.log(`Ô£à [STREAMS LIVE] Encontradas ${activeStreams.length} lives ativas`);



        res.json({

            success: true,

            streams: streamsWithHostData,

            count: activeStreams.length

        });

    } catch (error: any) {

        console.error('ÔØî [STREAMS LIVE] Erro ao buscar lives ativas:', error);

        res.status(500).json({ error: error.message });

    }

});



// API para criar transmiss+úo real

// ===== ROUTE START =====
router.put('/streams/:id', async (req, res) => {

    try {

        const { id } = req.params;

        const updateData = req.body;

        

        // Verificar se stream existe

        const existingStream = await Streamer.findOne({ id });

        if (!existingStream) {

            return res.status(404).json({ error: 'Stream not found' });

        }

        

        // Atualizar stream

        const stream = await Streamer.findOneAndUpdate(

            { id }, 

            updateData, 

            { new: true, runValidators: true }

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

    const stream = await Streamer.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });

    res.json({ success: true, stream });

});

// GET /api/streams/:id/urls - Obter configura+º+Áes de URLs de um stream

// ===== ROUTE START =====
router.get('/streams/:id/urls', async (req: express.Request, res: express.Response) => {
    try {
        const userId = getUserIdFromToken(req);
        const { id: streamId } = req.params;

        // Verificar se a stream pertence ao usu+írio
        const stream = await Streamer.findOne({ id: streamId, hostId: userId });
        
        if (!stream) {
            return ResponseHelper.error(res, 'Stream n+úo encontrada ou n+úo pertence ao usu+írio', 404);
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

// POST /api/streams/:id/urls - Salvar configura+º+Áes de URLs RTMP/SRT

// ===== ROUTE START =====
router.post('/streams/:id/urls', async (req: express.Request, res: express.Response) => {
    try {
        const userId = getUserIdFromToken(req);
        const { id: streamId } = req.params;
        const { rtmpIngestUrl, srtIngestUrl, playbackUrl, streamKey } = req.body;

        // Verificar se a stream pertence ao usu+írio
        const stream = await Streamer.findOne({ id: streamId, hostId: userId });
        
        if (!stream) {
            return ResponseHelper.error(res, 'Stream n+úo encontrada ou n+úo pertence ao usu+írio', 404);
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
            { new: true }
        );

        console.log(`­ƒöù [URLS] Configura+º+Áes atualizadas para stream ${streamId} pelo usu+írio ${userId}`);

        ResponseHelper.success(res, {
            success: true,
            stream: updatedStream,
            message: 'Configura+º+Áes de URLs salvas com sucesso'
        });

    } catch (error) {
        console.error('ÔØî [URLS] Erro ao salvar configura+º+Áes:', error);
        ResponseHelper.error(res, 'Falha ao salvar configura+º+Áes de URLs', 500);
    }
});

// ===== ROUTE START =====
router.post('/streams/:id/save', async (req, res) => {

    try {

        const stream = await Streamer.findOneAndUpdate(

            { id: req.params.id },

            req.body,

            { new: true }

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

            { new: true }

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

// Fun+º+úo para limpar usu+írios inativos (marcar como offline)

const cleanupInactiveUsers = async () => {

    try {

        const models = await import('../models');

        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);



        // Buscar streams ativas para n+úo remover usu+írios que est+úo em streams

        const activeStreams = await models.Streamer.find({ isLive: true });

        const activeStreamIds = activeStreams.map(stream => stream.id);



        // Marcar como offline apenas usu+írios que:

        // 1. N+úo t+¬m lastSeen recente E n+úo est+úo em nenhuma stream ativa

        // 2. OU t+¬m lastSeen antigo E n+úo est+úo em nenhuma stream ativa

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

            console.log(`­ƒº¦ Limpeza de usu+írios inativos: ${result.modifiedCount} usu+írios marcados como offline`);

        }

    } catch (error) {

        console.error('ÔØî Erro na limpeza de usu+írios inativos:', error);

    }

};



// REMOVIDO: Cleanup autom+ítico de usu+írios inativos
// setInterval(cleanupInactiveUsers, 5 * 60 * 1000);
// console.log('­ƒöº Cleanup autom+ítico ativado');



// Rota para buscar usu+írios online em uma stream espec+¡fica

// ===== ROUTE START =====
router.get('/streams/:id/online-users', async (req, res) => {

    try {

        const streamId = req.params.id;



        // Buscar usu+írios marcados como online nesta stream no banco de dados

        const onlineUsersInStream = await User.find({

            isOnline: true,

            currentStreamId: streamId,

            name: { $exists: true, $nin: ['', null] }, // Apenas usu+írios com nome v+ílido

            id: { $exists: true, $nin: ['', null] } // Apenas usu+írios com ID v+ílido

        }).select('id name avatarUrl identification level activeFrameId frameExpiration');



        console.log(`­ƒöì [ONLINE USERS] Usu+írios encontrados na stream ${streamId}:`, onlineUsersInStream.map(u => ({

            id: u.id,

            name: u.name,

            avatarUrl: u.avatarUrl,

            hasAvatar: !!u.avatarUrl

        })));



        // Se n+úo encontrar usu+írios online, buscar todos os usu+írios que enviaram presentes nesta live

        if (onlineUsersInStream.length === 0) {

            console.log(`­ƒöì [ONLINE USERS] Nenhum usu+írio online encontrado, buscando usu+írios que enviaram presentes...`);

            

            // Importar GiftTransaction apenas quando necess+írio

            const { GiftTransaction } = await import('../models');

            

            // Buscar usu+írios que enviaram presentes nesta live

            const giftSenders = await GiftTransaction.aggregate([

                { $match: { streamId: streamId } },

                { $group: { _id: '$fromUserId', totalValue: { $sum: '$totalValue' } } },

                { $sort: { totalValue: -1 } }

            ]);

            

            console.log(`­ƒÄü [ONLINE USERS] Remetentes de presentes encontrados:`, giftSenders);

            

            // Buscar dados completos desses usu+írios

            const senderIds = giftSenders.map((s: { _id: string }) => s._id);

            if (senderIds.length > 0) {

                const senderUsers = await User.find({

                    id: { $in: senderIds },

                    name: { $exists: true, $nin: ['', null] }

                }).select('id name avatarUrl identification level activeFrameId frameExpiration');

                

                // Combinar dados dos usu+írios com valores reais de presentes enviados nesta live

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

                

                console.log(`­ƒÄ» [ONLINE USERS] Resultado final (presentes):`, usersWithGiftData);

                return res.json(usersWithGiftData);

            }

        }



        // Buscar transacoes de presentes desta live para calcular valores enviados APENAS nesta live

        const { GiftTransaction } = await import('../models');

        const liveGiftTransactions = await GiftTransaction.find({

            streamId: streamId

        }).select('fromUserId totalValue');



        // Agrupar valores por usu+írio para esta live espec+¡fica

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



        // Se ainda n+úo encontrar nada, buscar o host da stream como fallback

        if (usersWithValue.length === 0) {

            console.log(`­ƒöì [ONLINE USERS] Nenhum usu+írio encontrado, buscando host como fallback...`);

            

            const stream = await Streamer.findOne({ id: streamId });

            if (stream && stream.hostId) {

                const host = await User.findOne({ id: stream.hostId }).select('id name avatarUrl identification level activeFrameId frameExpiration');

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

                    console.log(`­ƒÄ» [ONLINE USERS] Host encontrado como fallback:`, hostData);

                    return res.json([hostData]);

                }

            }

        }



        console.log(`­ƒÄ» [DEBUG] Resultado final:`, usersWithValue);

        return res.json(usersWithValue);

    } catch (error: any) {

        console.error('ÔØî [ONLINE USERS] Erro:', error);

        return res.status(500).json({ error: error.message });

    }

});

// Rota para atualizar status online do usu+írio

// API para usu+írio entrar na live

// ===== ROUTE START =====
router.get('/streams/:streamId/join', async (req, res) => {
    try {
        const userId = await getUserIdFromToken(req);
        const streamId = req.params.streamId;

        console.log(`­ƒæñ [STREAM JOIN GET] Usu+írio ${userId} entrando na stream ${streamId}`);

        if (!userId || !streamId) {
            return res.status(400).json({ success: false, error: 'UserId e StreamId s+úo obrigat+¦rios' });
        }

        // Verificar se stream existe
        const streamer = await Streamer.findOne({ id: streamId });
        if (!streamer) {
            return res.status(404).json({ success: false, error: 'Stream n+úo encontrada' });
        }

        // Verificar se usu+írio est+í bloqueado
        const block = await Block.findOne({ 
            blockerId: streamer.hostId, 
            blockedId: userId 
        });
        if (block) {
            return res.status(403).json({ success: false, error: 'Usu+írio bloqueado pelo host' });
        }

        // Atualizar status do usu+írio
        const user = await User.findOneAndUpdate(
            { id: userId },
            {
                isOnline: true,
                currentStreamId: streamId,
                lastSeen: new Date().toISOString()
            },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ success: false, error: 'Usu+írio n+úo encontrado' });
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

        console.log(`Ô£à [STREAM JOIN GET] Usu+írio ${userId} entrou na stream ${streamId}`);

        res.json({
            success: true,
            message: 'Usu+írio entrou na stream com sucesso',
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
        console.error('ÔØî [STREAM JOIN GET] Erro:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ­ƒöº API DE SALDO DA LIVE - Retorna saldo em tempo real

// ===== ROUTE START =====
router.get('/streams/:id/balance', async (req, res) => {

    try {

        const streamId = req.params.id;

        console.log(`­ƒÆ¦ [BALANCE] Buscando saldo da live: ${streamId}`);

        

        // Buscar streamer pelo ID

        const streamer = await Streamer.findOne({ id: streamId });

        

        if (!streamer) {

            console.log(`ÔØî Streamer not found: ${streamId}`);

            return res.status(404).json({ error: 'Streamer not found' });

        }



        // ­ƒöº USAR DIAMONDS DO STREAM (valor correto para o contador)

        const currentBalance = streamer.diamonds || 0;

        

        console.log(`Ô£à [BALANCE] Saldo da live ${streamId}: ${currentBalance} diamantes`);

        

        // Retornar saldo atualizado

        res.json({

            streamId: streamId,

            streamerName: streamer.name,

            diamonds: currentBalance,

            lastUpdated: streamer.updatedAt || new Date().toISOString(),

            isLive: streamer.isLive

        });

        

    } catch (error: any) {

        console.error('ÔØî [BALANCE] Erro ao buscar saldo da live:', error);

        res.status(500).json({ error: error.message });

    }

});



// API para usu+írio sair da live

// ===== ROUTE START =====
router.post('/streams/:streamId/leave', async (req, res) => {

    try {

        const { userId } = req.body;

        const streamId = req.params.streamId;



        console.log(`­ƒæñ [STREAM LEAVE] Usu+írio ${userId} saindo da stream ${streamId}`);



        if (!userId || !streamId) {

            return res.status(400).json({ success: false, error: 'UserId e StreamId s+úo obrigat+¦rios' });

        }



        // Verificar se o usu+írio existe

        const user = await User.findOne({ id: userId });

        if (!user) {

            return res.status(404).json({ success: false, error: 'Usu+írio n+úo encontrado' });

        }



        // Verificar se usu+írio est+í realmente na stream

        if (!user.isOnline || user.currentStreamId !== streamId) {

            console.log(`ÔÜá´©Å [STREAM LEAVE] Usu+írio ${userId} n+úo est+í na stream ${streamId}`);

            return res.json({ success: true, message: 'Usu+írio n+úo est+í na stream' });

        }



        // Verificar se usu+írio +® host de alguma stream ativa

        const activeHostStreams = await Streamer.find({

            hostId: userId,

            isLive: true,

            id: { $ne: streamId }

        });



        // Se n+úo for host de nenhuma outra stream, marcar como offline

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



        // ­ƒöº MELHOR PR+üTICA: Decrementar viewers com $inc ( MongoDB garante n+úo ficar negativo com min: 0 )

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



        console.log(`Ô£à [STREAM LEAVE] Usu+írio ${userId} saiu da stream ${streamId}`);



        res.json({

            success: true,

            user: {

                id: userId,

                isOnline: activeHostStreams && activeHostStreams.length > 0,

                currentStreamId: null

            },

            stream: {

                id: streamId,

                viewers: Math.max(0, 0) // ­ƒöº MELHOR PR+üTICA: MongoDB j+í controlou o decremento

            }

        });

    } catch (error: any) {

        console.error('ÔØî [STREAM LEAVE] Erro:', error);

        res.status(500).json({ success: false, error: error.message });

    }

});



// Handler #1 removido ÔÇö duplicata body-based. Usar JWT-based handler abaixo (linha ~7067).



// Rota para quando usu+írio entra na stream - LEGACY

// ===== ROUTE START =====
router.post('/streams/:id/end-session', async (req, res) => {

    try {

        const { session } = req.body;

        const streamId = req.params.id;



        console.log(`­ƒö¦ Encerrando live ${streamId} e salvando no hist+¦rico`);



        // 1. Buscar a stream antes de atualizar

        const stream = await Streamer.findOne({ id: streamId });



        if (!stream) {

            console.warn(`ÔÜá´©Å Stream ${streamId} n+úo encontrada, mas continuando para limpar estado do usu+írio`);

            

            // Mesmo que a stream n+úo exista, limpar o estado do usu+írio

            const userId = getUserIdFromToken(req);

            if (userId) {

                await User.findOneAndUpdate(

                    { id: userId },

                    {

                        isLive: false,

                        currentStreamId: null,

                        lastSeen: new Date().toISOString()

                    }

                );

                console.log(`Ô£à Estado do usu+írio ${userId} limpo mesmo sem stream encontrada`);

            }

            

            return res.json({ success: true, message: 'Stream n+úo encontrada mas estado limpo' });

        }



        // 2. Calcular duracao

        const endTime = Date.now();

        const durationMs = endTime - (session?.startTime || endTime);

        const totalSeconds = Math.floor(durationMs / 1000);

        const hours = Math.floor(totalSeconds / 3600);

        const minutes = Math.floor((totalSeconds % 3600) / 60);

        const seconds = totalSeconds % 60;

        const durationStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;



        // 3. Salvar no hist+¦rico

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

                peakViewers: session?.peakViewers || stream.viewers || 0,

                totalCoins: session?.coins || 0,

                totalFollowers: session?.followers || 0,

                totalMembers: session?.members || 0,

                totalFans: session?.fans || 0,

                category: stream.category,

                tags: stream.tags || [],

                country: stream.country

            };



            await StreamHistory.create(historyEntry);

            console.log(`­ƒÆ¥ Hist+¦rico salvo para stream ${streamId}`);

        } catch (historyError: any) {

            console.warn(`ÔÜá´©Å Erro ao salvar hist+¦rico (mas continuando): ${historyError.message}`);

            // Continuar mesmo se o hist+¦rico falhar

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

                { new: true }

            );

            if (!updatedStream) {

                console.warn(`ÔÜá´©Å Stream ${streamId} n+úo encontrada para atualizar`);

            }

        } catch (updateError: any) {

            console.warn(`ÔÜá´©Å Erro ao atualizar stream (mas continuando): ${updateError.message}`);

        }



        // 5. Atualizar status do host

        let updatedUser;

        try {

            const User = await import('../models').then(m => m.User);

            updatedUser = await User.findOneAndUpdate(

                { id: stream.hostId },

                { isLive: false },

                { new: true }

            );

            if (!updatedUser) {

                console.warn(`ÔÜá´©Å Usu+írio ${stream.hostId} n+úo encontrado para atualizar`);

            }

        } catch (userError: any) {

            console.warn(`ÔÜá´©Å Erro ao atualizar usu+írio (mas continuando): ${userError.message}`);

        }



        // 6. Remover todos os usu+írios online desta stream

        try {

            const User = await import('../models').then(m => m.User);

            await User.updateMany(

                { currentStreamId: streamId },

                {

                    currentStreamId: null,

                    lastSeen: new Date().toISOString()

                }

            );

            console.log(`Ô£à Usu+írios removidos da stream ${streamId}`);

        } catch (removeError: any) {

            console.warn(`ÔÜá´©Å Erro ao remover usu+írios da stream (mas continuando): ${removeError.message}`);

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

                message: 'Esta transmiss+úo foi encerrada',

                timestamp: new Date().toISOString()

            });



            console.log(`­ƒôó Notifica+º+úo WebSocket enviada: stream ${streamId} encerrada`);

        }



        console.log(`Ô£à Live ${streamId} encerrada e hist+¦rico salvo com sucesso`);



        res.json({

            success: true,

            user: updatedUser || {},

            stream: {

                id: streamId,

                isLive: false,

                endTime: new Date(endTime).toISOString()

            },

            history: historyEntry

        });



    } catch (error: any) {

        console.error('ÔØî Erro ao encerrar sess+úo da live:', error);

        res.status(500).json({ success: false, error: error.message });

    }

});



// API espec+¡fica para remover cards de lives

// ===== ROUTE START =====
router.delete('/cards/:streamId', async (req, res) => {

    try {

        const { streamId } = req.params;

        const { userId } = req.query;



        console.log(`­ƒùæ´©Å Removendo card da live ${streamId} pelo usu+írio ${userId}`);



        // Validar userId

        if (!userId) {

            console.warn(`ÔÜá´©Å userId n+úo fornecido para remover card ${streamId}`);

            return res.status(400).json({ success: false, error: 'User ID required' });

        }



        // 1. Buscar a stream

        const stream = await Streamer.findOne({ id: streamId });



        if (!stream) {

            console.warn(`ÔÜá´©Å Stream ${streamId} n+úo encontrada`);

            return res.status(404).json({ success: false, error: 'Stream not found' });

        }



        // 2. Verificar se o usu+írio +® o dono da stream

        if (stream.hostId !== userId) {

            console.warn(`ÔÜá´©Å Usu+írio ${userId} n+úo +® dono da stream ${streamId} (dono: ${stream.hostId})`);

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



            console.log(`­ƒôó Notifica+º+úo WebSocket enviada: card ${streamId} removido`);

        }



        console.log(`Ô£à Card da live ${streamId} removido com sucesso`);



        res.json({ success: true });



    } catch (error: any) {

        console.error('ÔØî Erro ao remover card:', error);

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

        const stream = await Streamer.findOne({ id: req.params.id });

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

            // Quando a pessoa manda presente pra si mesma, fazemos as duas atualiza+º+Áes (- e +) EM UMA +ÜNICA chamada no banco.

            // O erro dos diamantes bugados acontecia porque o sender.save() e o receiver.save() sobrescreviam um ao outro.

            updatedSender = await U.findOneAndUpdate(

                { id: fromUserId },

                { $inc: { diamonds: -totalValue, enviados: totalValue, receptores: totalValue, earnings: totalValue } },

                { new: true }

            );

            updatedReceiver = updatedSender;

            console.log(`­ƒÆ¦ [LIVE GIFT] ${updatedSender?.name} enviou ${totalValue} diamantes para si mesmo (duas m+®tricas do mesmo evento)`);

        } else {

            // Se for para outra pessoa, atualiza cada um separado e corretamente

            updatedSender = await U.findOneAndUpdate(

                { id: fromUserId },

                { $inc: { diamonds: -totalValue, enviados: totalValue } },

                { new: true }

            );

            

            if (stream.hostId) {

                updatedReceiver = await U.findOneAndUpdate(

                    { id: stream.hostId },

                    { $inc: { receptores: totalValue, earnings: totalValue } },

                    { new: true }

                );

                console.log(`­ƒÆ¦ [LIVE GIFT] ${updatedSender?.name} enviou ${totalValue} diamantes para ${updatedReceiver?.name}`);

            }

        }

        

        if (updatedReceiver) {

            console.log(`­ƒôè [LIVE GIFT] ${updatedReceiver.name} - Receptores: ${updatedReceiver.receptores}, Earnings: ${updatedReceiver.earnings}`);

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

            console.log(`­ƒôí [WEBSOCKET] Earnings atualizados em tempo real para ${updatedReceiver.name}: +${totalValue} diamantes (total earnings: ${updatedReceiver.earnings}, receptores: ${updatedReceiver.receptores})`);

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

            console.log(`­ƒôí [WEBSOCKET] Diamonds atualizados em tempo real para ${updatedSender.name}: ${updatedSender.diamonds} (enviados: ${updatedSender.enviados})`);

        }



        // Acumular diamantes na stream (n+úo converter para BRL ainda)

        await Streamer.findOneAndUpdate(

            { id: req.params.id },

            {

                $inc: { diamonds: totalValue }

            }

        );



        // Emitir atualiza+º+úo para a sala de transmiss+úo com os 'receptores' reais

        if (io && updatedReceiver) {

            io.emit('live_coins_updated', {

                streamId: req.params.id,

                coins: totalValue,

                totalCoins: updatedReceiver.receptores || 0,

                timestamp: new Date().toISOString(),

                fromUser: updatedSender?.name || 'Unknown',

                giftName: giftName

            });

            console.log(`­ƒôí [WEBSOCKET] live_coins_updated emitido para a sala ${req.params.id} com totalCoins: ${updatedReceiver.receptores}`);

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

            giftIcon: gift.icon || '­ƒÄü',

            giftPrice: price,

            quantity: amount || 1,

            totalValue,

            createdAt: new Date().toISOString()

        }]);



        console.log(`­ƒÆÄ Gift sent: ${giftName} x${amount} from ${updatedSender?.name || 'Unknown'} to stream ${req.params.id} - ${totalValue} diamonds accumulated`);



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

// REMOVIDO: Endpoint de simula+º+úo que estava causando usu+írio falso online

// REMOVIDO: Rotas legadas WebRTC (publish/play/stop) ÔÇö agora usando WHIP (browser) e RTMP (Android) direto para SRS



// PUT /api/streams/:id/quality - Atualizar qualidade do stream

// ===== ROUTE START =====
router.put('/streams/:id/quality', async (req, res) => {

    try {

        const { id: streamId } = req.params;

        const { quality, userId } = req.body;



        console.log(`­ƒÄÑ [STREAM_QUALITY] Stream: ${streamId}, Quality: ${quality}, User: ${userId}`);



        // 1. Validar se o stream existe

        const streamer = await Streamer.findOne({ id: streamId });

        if (!streamer) {

            console.log(`ÔØî [STREAM_QUALITY] Stream n+úo encontrado: ${streamId}`);

            return res.status(404).json({

                success: false,

                error: 'Stream n+úo encontrado'

            });

        }



        // 2. Validar se o usu+írio +® o host do stream

        if (streamer.hostId !== userId) {

            console.log(`ÔØî [STREAM_QUALITY] Usu+írio n+úo +® host: ${userId} != ${streamer.hostId}`);

            return res.status(403).json({

                success: false,

                error: 'Apenas o host pode alterar a qualidade'

            });

        }



        // 3. Validar se a qualidade +® v+ílida

        const validQualities = ['360p', '480p', '720p', '1080p'];

        if (!validQualities.includes(quality)) {

            console.log(`ÔØî [STREAM_QUALITY] Qualidade inv+ílida: ${quality}`);

            return res.status(400).json({

                success: false,

                error: 'Qualidade inv+ílida'

            });

        }



        // 4. Atualizar qualidade no banco de dados

        await Streamer.updateOne(

            { id: streamId },

            { quality: quality }

        );



        console.log(`Ô£à [STREAM_QUALITY] Qualidade atualizada: ${quality}`);



        // 5. Enviar evento WebSocket para atualizar frontend

        const io = req.app.get('io');

        if (io) {

            io.emit(`stream_${streamId}_quality_updated`, {

                quality,

                streamId,

                userId

            });

            console.log(`­ƒôí [STREAM_QUALITY] Evento WebSocket emitido para stream_${streamId}`);

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

        console.error('ÔØî [STREAM_QUALITY] Erro:', error);

        res.status(500).json({

            success: false,

            error: 'Erro ao atualizar qualidade do stream'

        });

    }

});



// API STARK - Iniciar live (padr+úo Buscast)

// ===== ROUTE START =====
router.post('/stark/live/start', async (req, res) => {

    try {

        const { userId, title, name, category = 'general' } = req.body;

        // Aceitar tanto 'name' quanto 'title' - priorizar 'title' se ambos existirem
        const liveTitle = title || name;

        console.log(`[STARK] Iniciando live - User: ${userId}, Title: ${liveTitle}`);



        // Valida+º+Áes b+ísicas

        if (!userId || !liveTitle || liveTitle.trim() === '') {

            return res.json({

                code: 0,

                msg: 'userId e title/name s+úo obrigat+¦rios'

            });

        }



        // Buscar usu+írio para verificar exist+¬ncia

        const user = await User.findOne({ id: userId });

        if (!user) {

            return res.json({

                code: 0,

                msg: 'Usu+írio n+úo encontrado'

            });

        }



        // Gerar dados reais da live

        const liveId = uuidv4(); // UUID +¦nico

        const streamId = `stream_${userId}_${uuidv4().substring(0, 8)}`; // streamId +¦nico

        const srsHost = process.env.SRS_HOST || 'srs';
        const srsRtmp = `rtmp://${srsHost}:1935/live`;
        const backendApi = 'https://api.livego.store/api/video/http';

        const rtmpUrl = `${srsRtmp}/${streamId}`;
        const playbackUrl = `${backendApi}/live/${streamId}.flv`;



        // Criar nova transmiss+úo

        const newLive = await Streamer.create({

            id: liveId,

            hostId: userId,

            name: user.name,

            avatar: user.avatarUrl || '',

            title: title,

            category: category.toLowerCase(),

            streamId: streamId,

            streamKey: `sk_live_${streamId}`,

            rtmpIngestUrl: rtmpUrl,

            playbackUrl: playbackUrl,

            hlsUrl: `${backendApi}/live/${streamId}.m3u8`,

            isLive: true,

            streamStatus: 'created',

            startTime: new Date().toISOString(),

            viewers: 0,

            country: user.country || 'br',

            tags: [category.toLowerCase(), 'live'],

            quality: 'HD',

            giftsEnabled: true,

            chatEnabled: true

        });



        // Atualizar status do usu+írio

        await User.findOneAndUpdate(

            { id: userId },

            {

                isLive: true,

                currentStreamId: liveId,

                lastSeen: new Date().toISOString()

            }

        );



        console.log(`[STARK] Live criada - liveId: ${liveId}, streamId: ${streamId}`);



        // Retornar no formato exato do Buscast

        res.json({

            code: 1,

            result: {

                liveId: liveId.toString(),

                streamId: streamId,

                pushUrl: rtmpUrl

            },

            msg: "OK"

        });



    } catch (error: any) {

        console.error('[STARK] Erro ao criar live:', error);

        res.json({

            code: 0,

            msg: 'Erro interno ao criar live'

        });

    }

});



// Endpoint /api/streams/start - Cria registro provis+¦rio (isLive: false)
// Frontend chama antes de capturar m+¡dia para obter streamKey e URLs

// ===== ROUTE START =====
router.post('/streams/start', async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized', status: 'unauthorized' });
        }

        const { title, name, category = 'general' } = req.body;
        const liveTitle = title || name || 'Ao Vivo';

        const user = await User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ error: 'Usu+írio n+úo encontrado', status: 'user_not_found' });
        }

        // Gerar streamKey +¦nica
        const streamKey = `live_${userId}_${Date.now()}`;
        const liveId = uuidv4();

        const srsHost = process.env.SRS_HOST || 'srs';
        const srsRtmp = `rtmp://${srsHost}:1935/live`;
        const backendApi = 'https://api.livego.store/api/video/http';

        // Criar registro provis+¦rio ÔÇö isLive: false at+® SRS on_publish
        const stream = await Streamer.create({
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

        console.log(`[STREAMS START] Stream provis+¦rio criado: ${streamKey} para usu+írio ${userId}`);

        res.json({
            success: true,
            streamKey: streamKey,
            rtmpUrl: `${srsRtmp}/${streamKey}`,
            hlsUrl: `${backendApi}/live/${streamKey}.m3u8`,
            flvUrl: `${backendApi}/live/${streamKey}.flv`,
            status: 'preparing'
        });

    } catch (error: any) {
        console.error('[STREAMS START] Erro ao criar stream provis+¦rio:', error);
        res.status(500).json({
            error: 'Erro interno ao criar stream',
            status: 'error',
            details: error.message
        });
    }
});

// Endpoint /api/lives/start - Porteiro oficial da transmiss+úo
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
            return res.status(400).json({ error: 'streamId +® obrigat+¦rio', status: 'invalid_request' });
        }

        const user = await User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ error: 'Usu+írio n+úo encontrado', status: 'user_not_found' });
        }

        // Buscar stream existente por streamKey ou criar provis+¦rio
        let stream = await Streamer.findOne({ streamKey: streamId });
        if (!stream) {
            stream = await Streamer.findOne({ id: streamId });
        }

        const srsHost = process.env.SRS_HOST || 'srs';
        const srsRtmp = `rtmp://${srsHost}:1935/live`;
        const backendApi = 'https://api.livego.store/api/video/http';
        const now = new Date();

        if (!stream) {
            // Criar registro provis+¦rio
            const liveId = uuidv4();
            stream = await Streamer.create({
                id: liveId,
                hostId: userId,
                name: user.name,
                avatar: user.avatarUrl || '',
                title: user.name,
                streamKey: streamId,
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

        

        console.log(`­ƒöì [DEBUG] Getting live details for streamer: ${id}`);

        console.log(`­ƒöì [SECURITY] User-Agent: ${userAgent}, Referer: ${referer}`);

        

        // DETEC+ç+âO DE GRAVA+ç+âO - Verificar sinais de ferramentas de grava+º+úo

        const recordingIndicators = [

            'ffmpeg', 'vlc', 'obs', 'streamrecorder', 'youtube-dl', 'yt-dlp',

            'wget', 'curl', 'python-requests', 'node-fetch', 'postman',

            'insomnia', 'swagger', 'api-client', 'httpie'

        ];

        

        const isRecordingAttempt = recordingIndicators.some(indicator => 

            userAgent.toLowerCase().includes(indicator.toLowerCase())

        );

        

        // Verificar se +® acesso direto +á API (sem referer do app)

        const isDirectApiAccess = !referer || (referer.includes('localhost') && userAgent.includes('curl'));

        

        // Usar ID real diretamente (sem mapeamento)

        const streamer = await Streamer.findOne({ id });

        

        if (!streamer) {

            console.log(`ÔØî Streamer not found: ${id}`);

            return res.status(404).json({ error: 'Streamer not found' });

        }



        // Transformar streamer para formato protegido usando mapper flex+¡vel

        const protectedStream = mapStreamToProtectedFlexible(streamer as any);

        res.json(protectedStream);

    } catch (error: any) {

        console.error('ÔØî Error getting live details:', error);

        res.status(500).json({ error: 'Internal server error' });

    }

});

// ===== ROUTE START =====
router.post('/lives/:id/end', async (req, res) => {

    try {

        // Usar ID real diretamente

        const realId = req.params.id;

        const userId = getUserIdFromToken(req);



        console.log(`[STREAM-END] Encerrando stream: ${realId} por usu+írio: ${userId}`);



        // Atualizar status para 'ended' no banco

        await Streamer.findOneAndUpdate(

            { id: realId },

            {

                isLive: false,

                streamStatus: 'ended',

                endTime: new Date()

            }

        );



        // Atualizar status do usu+írio

        await User.findOneAndUpdate(

            { id: userId },

            {

                isLive: false,

                currentStreamId: null,

                lastSeen: new Date()

            }

        );



        return successResponse(res, 'Stream encerrada com sucesso');

        

    } catch (error) {

        console.error('[STREAM-END] Erro ao encerrar stream:', error);

        return internalServerErrorResponse(res, 'Erro ao encerrar stream', error);

    }

});



// GET /api/live/nearby - Streams pr+¦ximas por localiza+º+úo

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



        // Buscar streams ativas pr+¦ximas usando geoLocation do host

        const nearbyStreams = await Streamer.find({

            isLive: true,

            streamStatus: 'active',

            name: { $exists: true, $nin: ['', null] },

            hostId: { $exists: true, $ne: null }

        })

            .populate('hostId', 'geoLocation name avatarUrl')

            .limit(parseInt(limit as string));



        // Filtrar streams que t+¬m host com localiza+º+úo pr+¦xima

        const validStreams = nearbyStreams.filter(stream => stream.hostId);



        console.log(` [NEARBY STREAMS] ${validStreams.length} streams encontradas pr+¦ximas a (${lat}, ${lng})`);



        // Retornar streams COM PROTE+ç+âO DE DADOS SENS+ìVEIS usando mapper flex+¡vel

        const protectedActiveStreams = mapStreamsToProtectedArrayFlexible(validStreams as any);

        

        res.json(protectedActiveStreams);

    } catch (error: any) {

        console.error('Error fetching nearby streams:', error);

        res.status(500).json({ error: error.message });

    }

});



// GET /api/live/following - Streams de usu+írios que o usu+írio segue

// ===== ROUTE START =====
router.get('/live/following', async (req, res) => {

    try {

        const userId = req.query.userId as string;



        if (!userId) {

            return res.status(400).json({ error: 'User ID is required' });

        }



        // Buscar usu+írio e seus seguidos

        const User = await import('../models').then(m => m.User);

        const user = await User.findOne({ id: userId });



        if (!user) {

            return res.status(404).json({ error: 'User not found' });

        }



        // Buscar IDs dos usu+írios que segue

        const followingIds = user.followingList || [];



        if (followingIds.length === 0) {

            return res.json([]);

        }



        // Buscar streams ativas dos usu+írios que segue

        const followingStreams = await Streamer.find({

            isLive: true,

            streamStatus: 'active',

            hostId: { $in: followingIds },

            name: { $exists: true, $nin: ['', null] }

        })

            .sort({ viewers: -1 });



        console.log(`­ƒæÑ [FOLLOWING STREAMS] ${followingStreams.length} streams de usu+írios seguidos por ${userId}`);



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



        console.log(`­ƒåò [NEW STREAMS] ${newStreams.length} streams mais recentes`);



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

        const stream = await Streamer.findOne({ id: streamId });

        if (!stream) {

            return res.status(404).json({ error: 'Stream not found' });

        }



        // Verificar se j+í deu like

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

        const updatedStream = await Streamer.findOne({ id: streamId });

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

        const updatedStream = await Streamer.findOne({ id: streamId });

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



// POST /api/streams/:streamId/end - Encerrar stream espec+¡fica por ID

// ===== ROUTE START =====
router.post('/streams/:streamId/end', async (req: express.Request, res: express.Response) => {

    try {

        const userId = getUserIdFromToken(req);

        const { streamId } = req.params;

        

        if (!userId) {

            return res.status(401).json({ 

                success: false, 

                message: 'Usu+írio n+úo autenticado' 

            });

        }



        console.log(`[STREAM-END] Tentando encerrar stream: ${streamId} pelo usu+írio: ${userId}`);



        // Buscar stream espec+¡fica

        const stream = await Streamer.findOne({ id: streamId });

        

        if (!stream) {

            return res.status(404).json({ 

                success: false, 

                message: 'Stream n+úo encontrada' 

            });

        }



        // Verificar se o usu+írio +® o dono da stream ou admin

        const user = await findUserByAnyId(User, userId);

        const isAdmin = user?.level !== undefined && user.level >= 10; // Admin level 10+

        const isOwner = stream.hostId.toString() === userId;



        if (!isOwner && !isAdmin) {

            return res.status(403).json({ 

                success: false, 

                message: 'Apenas o dono da stream ou administrador pode encerr+í-la' 

            });

        }



        // Verificar se stream est+í ativa

        if (!stream.isLive) {

            return res.status(400).json({ 

                success: false, 

                message: 'Stream j+í est+í encerrada' 

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



        // Atualizar status do usu+írio se n+úo tiver outras streams ativas

        const otherActiveStreams = await Streamer.find({

            hostId: stream.hostId,

            isLive: true,

            id: { $ne: streamId }

        });



        if (otherActiveStreams.length === 0) {

            await User.findOneAndUpdate(

                { _id: stream.hostId },

                {

                    isLive: false,

                    currentStreamId: null,

                    lastSeen: new Date()

                }

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



// POST /api/streams/end-all - Encerrar todas as streams do usu+írio

// ===== ROUTE START =====
router.post('/streams/end-all', async (req: express.Request, res: express.Response) => {

    try {

        const userId = getUserIdFromToken(req);

        

        if (!userId) {

            return res.status(401).json({ 

                success: false, 

                message: 'Usu+írio n+úo autenticado' 

            });

        }



        console.log(`[STREAM-END-ALL] Encerrando todas as streams do usu+írio: ${userId}`);



        // Buscar todas as streams ativas do usu+írio

        const activeStreams = await Streamer.find({

            hostId: userId,

            isLive: true

        });



        if (activeStreams.length === 0) {

            return res.status(400).json({ 

                success: false, 

                message: 'Nenhuma stream ativa encontrada para este usu+írio' 

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



        // Atualizar status do usu+írio

        await User.findOneAndUpdate(

            { id: userId },

            {

                isLive: false,

                currentStreamId: null,

                lastSeen: new Date()

            }

        );



        console.log(`[STREAM-END-ALL] ${activeStreams.length} streams encerradas para usu+írio: ${userId}`);



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

                message: 'Usu+írio n+úo autenticado' 

            });

        }



        // Buscar stream espec+¡fica

        const stream = await Streamer.findOne({ id: streamId });

        

        if (!stream) {

            return res.status(404).json({ 

                success: false, 

                message: 'Stream n+úo encontrada' 

            });

        }



        // Verificar se o usu+írio +® o dono da stream

        if (stream.hostId.toString() !== userId) {

            return res.status(403).json({ 

                success: false, 

                message: 'Apenas o dono da stream pode atualizar heartbeat' 

            });

        }



        // Verificar se stream est+í ativa

        if (!stream.isLive) {

            return res.status(400).json({ 

                success: false, 

                message: 'Stream n+úo est+í ativa' 

            });

        }



        // Atualizar heartbeat e viewer count (se fornecido)

        const updateData: any = {

            lastHeartbeat: new Date(),

            streamStatus: 'active' // Garantir status ativo com heartbeat

        };



        // Se viewer count for enviado, atualizar tamb+®m

        if (req.body.viewers !== undefined && typeof req.body.viewers === 'number') {

            updateData.viewers = Math.max(0, req.body.viewers); // Garantir n+¦mero n+úo negativo

        }



        // Se bandwidth for enviado, atualizar tamb+®m (campo n+úo existe no modelo, removido por enquanto)

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

            // bandwidth removido - campo n+úo existe no modelo

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



// === ROTAS DE ADMINISTRA+ç+âO ===



// POST /api/admin/streams/:streamId/force-end - For+ºar encerramento (admin)

// ===== ROUTE START =====
router.post('/admin/streams/:streamId/force-end', async (req: express.Request, res: express.Response) => {

    try {

        const userId = getUserIdFromToken(req);

        const { streamId } = req.params;

        const { reason } = req.body; // Motivo do encerramento

        

        if (!userId) {

            return res.status(401).json({ 

                success: false, 

                message: 'Usu+írio n+úo autenticado' 

            });

        }



        // Verificar se +® admin

        const user = await findUserByAnyId(User, userId);

        if (!user || user.level === undefined || user.level < 10) {

            return res.status(403).json({ 

                success: false, 

                message: 'Acesso negado. Apenas administradores podem for+ºar encerramento' 

            });

        }



        console.log(`[ADMIN-FORCE-END] Admin ${userId} for+ºando encerramento da stream: ${streamId}`);



        // Buscar stream

        const stream = await Streamer.findOne({ id: streamId });

        

        if (!stream) {

            return res.status(404).json({ 

                success: false, 

                message: 'Stream n+úo encontrada' 

            });

        }



        // For+ºar encerramento

        await Streamer.findOneAndUpdate(

            { id: streamId },

            {

                isLive: false,

                streamStatus: 'ended',

                endTime: new Date(),

                endedBy: 'admin_force',

                endedByAdmin: userId,

                endReason: reason || 'Encerramento for+ºado por administrador',

                endedAt: new Date()

            }

        );



        // Atualizar status do usu+írio se n+úo tiver outras streams ativas

        const otherActiveStreams = await Streamer.find({

            hostId: stream.hostId,

            isLive: true,

            id: { $ne: streamId }

        });



        if (otherActiveStreams.length === 0) {

            await User.findOneAndUpdate(

                { _id: stream.hostId },

                {

                    isLive: false,

                    currentStreamId: null,

                    lastSeen: new Date()

                }

            );

        }



        console.log(`[ADMIN-FORCE-END] Stream ${streamId} encerrada for+ºadamente pelo admin ${userId}`);



        res.json({

            success: true,

            message: 'Stream encerrada for+ºadamente com sucesso',

            streamId: streamId,

            endedBy: 'admin_force',

            endedByAdmin: userId,

            endReason: reason || 'Encerramento for+ºado por administrador',

            endedAt: new Date().toISOString()

        });



    } catch (error: any) {

        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

        console.error('[ADMIN-FORCE-END] Erro ao for+ºar encerramento:', error);

        res.status(500).json({ 

            success: false, 

            message: 'Erro interno ao for+ºar encerramento',

            error: errorMessage

        });

    }

});



// GET /api/admin/streams/zombie-stats - Estat+¡sticas de streams zumbis

// ===== ROUTE START =====
router.get('/admin/streams/zombie-stats', async (req: express.Request, res: express.Response) => {

    try {

        const userId = getUserIdFromToken(req);

        

        if (!userId) {

            return res.status(401).json({ 

                success: false, 

                message: 'Usu+írio n+úo autenticado' 

            });

        }



        // Verificar se +® admin

        const user = await findUserByAnyId(User, userId);

        if (!user || user.level === undefined || user.level < 10) {

            return res.status(403).json({ 

                success: false, 

                message: 'Acesso negado. Apenas administradores podem ver estat+¡sticas' 

            });

        }



        // Servi+ºo de limpeza de streams zumbis removido

        res.json({

            success: true,

            message: 'Servi+ºo de limpeza de streams zumbis foi desativado',

            stats: { active: 0, zombie: 0, cleaned: 0 }

        });



    } catch (error: any) {

        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

        console.error('[ADMIN-ZOMBIE-STATS] Erro ao obter estat+¡sticas:', error);

        res.status(500).json({ 

            success: false, 

            message: 'Erro interno ao obter estat+¡sticas',

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

                message: 'Usu+írio n+úo autenticado' 

            });

        }



        // Verificar se +® admin

        const user = await findUserByAnyId(User, userId);

        if (!user || user.level === undefined || user.level < 10) {

            return res.status(403).json({ 

                success: false, 

                message: 'Acesso negado. Apenas administradores podem executar limpeza' 

            });

        }



        console.log(`[ADMIN-CLEANUP] Admin ${userId} tentando executar limpeza manual de streams zumbis`);



        // Servi+ºo de limpeza de streams zumbis foi removido

        res.json({

            success: true,

            message: 'Servi+ºo de limpeza de streams zumbis foi desativado',

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



// POST /api/streams/prepare - Preparar live (cria registro mas n+úo inicia transmiss+úo)

// ===== ROUTE START =====
router.post('/streams/prepare', async (req, res) => {

    try {

        console.log('[STREAM-PREPARE] Preparando nova live...');

        

        const userId = getUserIdFromToken(req);

        if (!userId) {

            return res.status(401).json({ 

                success: false, 

                message: 'Usu+írio n+úo autenticado' 

            });

        }



        const { name, title, category = 'general', description, tags = [] } = req.body;

        // Aceitar tanto 'name' quanto 'title' - priorizar 'title' se ambos existirem
        const liveTitle = title || name;

        // Valida+º+Áes b+ísicas

        if (!liveTitle || liveTitle.trim() === '') {

            return res.status(400).json({ 

                success: false, 

                message: 'T+¡tulo da live +® obrigat+¦rio (use "name" ou "title")' 

            });

        }



        // Buscar usu+írio

        const user = await User.findOne({ id: userId });

        if (!user) {

            return res.status(404).json({ 

                success: false, 

                message: 'Usu+írio n+úo encontrado' 

            });

        }



        // Gerar IDs para a live

        const streamId = `stream_${userId}_${Date.now()}`;

        const streamKey = `live_${userId}_${Date.now()}`;



        // Configura+º+Áes SRS

        const srsHost = process.env.SRS_HOST || '72.60.249.175';

        const srsRtmpUrl = process.env.SRS_RTMP_URL || `rtmp://${srsHost}:1935/live`;

        const backendApi = (() => {
            const bu = process.env.BACKEND_URL || 'https://api.livego.store';
            return `${bu.replace(/\/+$/, '')}/api/video/http`;
        })();

        const srsHttpUrl = process.env.SRS_HTTP_URL || `${backendApi}/live`;



        // Criar stream com status "preparing"

        const newStream = await Streamer.create({

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



        console.log(`[STREAM-PREPARE] Live preparada: ${streamId} para usu+írio ${userId}`);



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



// POST /api/streams/:id/start - Iniciar transmiss+úo (marcar como ativa)

// ===== ROUTE START =====
router.post('/streams/:id/start', async (req, res) => {

    try {

        console.log('[STREAM-START] Iniciando transmiss+úo...');

        

        const userId = getUserIdFromToken(req);

        if (!userId) {

            return res.status(401).json({ 

                success: false, 

                message: 'Usu+írio n+úo autenticado' 

            });

        }



        const { id } = req.params;



        // Buscar stream

        const stream = await Streamer.findOne({ id, hostId: userId });

        if (!stream) {

            return res.status(404).json({ 

                success: false, 

                message: 'Stream n+úo encontrado' 

            });

        }



        // Verificar se j+í est+í ativa

        if (stream.isLive && stream.streamStatus === 'active') {

            return res.status(409).json({ 

                success: false, 

                message: 'Stream j+í est+í ativa' 

            });

        }



        // Atualizar para ativa

        stream.isLive = true;

        stream.streamStatus = 'active';

        stream.startTime = new Date();

        await stream.save();



        // Atualizar usu+írio

        await User.findOneAndUpdate(

            { id: userId },

            { 

                isLive: true,

                isOnline: true,

                currentStreamId: id,

                lastSeen: new Date().toISOString()

            }

        );



        // Atualizar status online na cole+º+úo userstatuses

        const { UserStatus } = await import('../models');

        await UserStatus.findOneAndUpdate(

            { userId: userId },

            { 

                isOnline: true,

                lastSeen: new Date(),

                updatedAt: new Date()

            },

            { upsert: true, new: true }

        );



        console.log(`[STREAM-START] Stream ${id} iniciada para usu+írio ${userId}`);



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



export default router;
