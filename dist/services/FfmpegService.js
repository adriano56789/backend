"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFfmpegProcess = registerFfmpegProcess;
exports.killAllFfmpegProcesses = killAllFfmpegProcesses;
exports.getFfmpegProcesses = getFfmpegProcesses;
exports.startBattleMixer = startBattleMixer;
exports.stopMixer = stopMixer;
exports.getActiveMixerCount = getActiveMixerCount;
exports.startStreamTranscode = startStreamTranscode;
exports.stopStreamTranscode = stopStreamTranscode;
const child_process_1 = require("child_process");
const axios_1 = __importDefault(require("axios"));
const SRS_RTMP_URL = process.env.SRS_RTMP_URL || 'rtmp://127.0.0.1/live';
const MAX_CONCURRENT_FFMPEG = parseInt(process.env.MAX_CONCURRENT_FFMPEG || '3', 10);
const FFMPEG_DOCKER_API = process.env.FFMPEG_DOCKER_API || 'http://localhost:5000';
const USE_DOCKER_FFMPEG = process.env.USE_DOCKER_FFMPEG === 'true';
let activeMixers = 0;
const activeTranscoders = new Map();
// FFmpeg orphan process killer
let ffmpegProcesses = [];
function registerFfmpegProcess(proc) {
    ffmpegProcesses.push(proc);
    proc.on('exit', () => {
        ffmpegProcesses = ffmpegProcesses.filter(p => p !== proc);
    });
}
function killAllFfmpegProcesses() {
    ffmpegProcesses.forEach(p => { try {
        p.kill('SIGTERM');
    }
    catch { } });
    ffmpegProcesses = [];
}
function getFfmpegProcesses() {
    return ffmpegProcesses;
}
async function dockerApiCall(method, path, body) {
    try {
        const res = await (0, axios_1.default)({
            method: method,
            url: `${FFMPEG_DOCKER_API}${path}`,
            data: body,
            timeout: 5000,
        });
        return res.data;
    }
    catch (err) {
        console.warn(`[FFMPEG-DOCKER] API call failed (${method} ${path}): ${err.message}`);
        return null;
    }
}
async function startDockerTranscode(streamKey, options) {
    console.log(`[FFMPEG-DOCKER] 📡 Chamando API do container FFmpeg: POST /transcode/start streamKey=${streamKey}`);
    const result = await dockerApiCall('POST', '/transcode/start', { streamKey, options });
    if (result?.success) {
        console.log(`[FFMPEG-DOCKER] ✅ FFmpeg Docker iniciou transcoding para ${streamKey}. PID=${result.job?.pid}`);
    }
    else {
        console.warn(`[FFMPEG-DOCKER] ❌ FFmpeg Docker não iniciou: ${result?.error || 'sem resposta'}`);
    }
    return result?.success === true;
}
async function stopDockerTranscode(streamKey) {
    console.log(`[FFMPEG-DOCKER] 📡 Chamando API do container FFmpeg: POST /transcode/stop streamKey=${streamKey}`);
    const result = await dockerApiCall('POST', '/transcode/stop', { streamKey });
    if (result?.success) {
        console.log(`[FFMPEG-DOCKER] ✅ FFmpeg Docker parou transcoding para ${streamKey}`);
    }
    return result?.success === true;
}
/**
 * Inicia processo FFmpeg para compor duas streams lado a lado (MCU fallback).
 * Útil para HLS/FLV/recording — viewers WebRTC usam SFU puro (WHEP múltiplo).
 *
 * Layout: hstack (960x860 = 2x 480x860) + amix
 * Parâmetros low-delay para evitar A/V desync.
 * Preset ultrafast + zerolatency para mínima carga de CPU.
 */
function startBattleMixer(battleId, streamKeyA, streamKeyB) {
    if (activeMixers >= MAX_CONCURRENT_FFMPEG) {
        console.warn(`[MCU] Limite de ${MAX_CONCURRENT_FFMPEG} mixers simultâneos atingido. Ignorando battle ${battleId}.`);
        return null;
    }
    const inputA = `${SRS_RTMP_URL}/${streamKeyA}`;
    const inputB = `${SRS_RTMP_URL}/${streamKeyB}`;
    const outputKey = `battle_${battleId}_mix`;
    const outputUrl = `${SRS_RTMP_URL}/${outputKey}`;
    const args = [
        '-fflags', 'nobuffer+genpts',
        '-use_wallclock_as_timestamps', '1',
        '-flags', 'low_delay',
        '-i', inputA,
        '-i', inputB,
        '-filter_complex',
        '[0:v]scale=480:860,setpts=PTS-STARTPTS[v0];' +
            '[1:v]scale=480:860,setpts=PTS-STARTPTS[v1];' +
            '[v0][v1]hstack=inputs=2[v_mixed];' +
            '[0:a][1:a]amix=inputs=2:duration=longest[a_mixed]',
        '-map', '[v_mixed]',
        '-map', '[a_mixed]',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-maxrate', '1800k',
        '-bufsize', '3600k',
        '-g', '30',
        '-c:a', 'aac',
        '-b:a', '96k',
        '-f', 'flv',
        outputUrl
    ];
    console.log(`[MCU] Iniciando mixer battle ${battleId}: ${streamKeyA} + ${streamKeyB} → ${outputKey}`);
    const mixProcess = (0, child_process_1.spawn)('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    activeMixers++;
    registerFfmpegProcess(mixProcess);
    mixProcess.stderr?.on('data', (data) => {
        const msg = data.toString();
        if (msg.includes('drop') || msg.includes('Error') || msg.includes('error')) {
            console.warn(`[MCU] battle ${battleId}: ${msg.trim()}`);
        }
    });
    mixProcess.on('close', (code) => {
        activeMixers = Math.max(0, activeMixers - 1);
        console.log(`[MCU] Mixer battle ${battleId} encerrado (código ${code})`);
    });
    mixProcess.on('error', (err) => {
        activeMixers = Math.max(0, activeMixers - 1);
        console.error(`[MCU] Erro no mixer battle ${battleId}:`, err.message);
    });
    return mixProcess;
}
function stopMixer(proc) {
    if (!proc || proc.killed)
        return;
    try {
        proc.kill('SIGTERM');
        console.log('[MCU] Mixer finalizado via SIGTERM');
    }
    catch (_) { }
}
function getActiveMixerCount() {
    return activeMixers;
}
/**
 * Inicia FFmpeg para transcodificar uma stream do SRS.
 * Lê o RTMP de entrada, re-encode e publica de volta para SRS.
 * Tenta usar o container Docker primeiro, depois fallback local.
 */
async function startStreamTranscode(streamKey, options) {
    if (activeTranscoders.has(streamKey)) {
        console.log(`[FFMPEG-TRANSCODE] ⏭️ Transcodificador já existe para ${streamKey}, ignorando`);
        return { success: true, source: 'already_running' };
    }
    console.log(`[FFMPEG-TRANSCODE] ➡️ Iniciando transcoding para streamKey=${streamKey}...`);
    // Tentar Docker primeiro
    if (USE_DOCKER_FFMPEG) {
        console.log(`[FFMPEG-TRANSCODE] 🐳 Tentando container Docker FFmpeg...`);
        const dockerOk = await startDockerTranscode(streamKey, options);
        if (dockerOk) {
            console.log(`[FFMPEG-TRANSCODE] ✅ Transcoding rodando no container Docker para ${streamKey}`);
            console.log(`[FFMPEG-TRANSCODE] 🔄 FFmpeg lê de rtmp://srs:1935/live/${streamKey} e re-publica como ${streamKey}_transcoded`);
            return { success: true, source: 'docker' };
        }
        console.warn(`[FFMPEG-TRANSCODE] ⚠️ Docker indisponível, tentando fallback local`);
    }
    // Fallback local
    const inputUrl = `${SRS_RTMP_URL}/${streamKey}`;
    const outputKey = `${streamKey}_transcoded`;
    const outputUrl = `${SRS_RTMP_URL}/${outputKey}`;
    const res = options?.resolution || '1280:720';
    const vbr = options?.videoBitrate || 2500;
    const abr = options?.audioBitrate || 128;
    const fps = options?.fps || 30;
    const args = [
        '-fflags', 'nobuffer',
        '-i', inputUrl,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-profile:v', 'main',
        '-s', res,
        '-b:v', `${vbr}k`,
        '-maxrate', `${Math.round(vbr * 1.2)}k`,
        '-bufsize', `${vbr * 2}k`,
        '-r', String(fps),
        '-g', String(fps * 2),
        '-c:a', 'aac',
        '-b:a', `${abr}k`,
        '-ar', '44100',
        '-f', 'flv',
        outputUrl,
    ];
    console.log(`[FFMPEG-TRANSCODE] Iniciando transcoding local ${streamKey} -> ${outputKey}`);
    const proc = (0, child_process_1.spawn)('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    activeTranscoders.set(streamKey, proc);
    registerFfmpegProcess(proc);
    proc.stderr?.on('data', (data) => {
        const msg = data.toString();
        if (msg.includes('Error') || msg.includes('error')) {
            console.warn(`[FFMPEG-TRANSCODE] ${streamKey}: ${msg.trim()}`);
        }
    });
    proc.on('close', (code) => {
        activeTranscoders.delete(streamKey);
        console.log(`[FFMPEG-TRANSCODE] Transcodificador ${streamKey} encerrado (código ${code})`);
    });
    proc.on('error', (err) => {
        activeTranscoders.delete(streamKey);
        console.error(`[FFMPEG-TRANSCODE] Erro no transcodificador ${streamKey}:`, err.message);
    });
    return { success: true, source: 'local' };
}
async function stopStreamTranscode(streamKey) {
    console.log(`[FFMPEG-TRANSCODE] ➡️ Parando transcoding para streamKey=${streamKey}...`);
    // Tentar Docker primeiro
    if (USE_DOCKER_FFMPEG) {
        console.log(`[FFMPEG-TRANSCODE] 🐳 Tentando parar no container Docker...`);
        const dockerOk = await stopDockerTranscode(streamKey);
        if (dockerOk) {
            console.log(`[FFMPEG-TRANSCODE] ✅ Transcoding parado no container Docker para ${streamKey}`);
            return { success: true, source: 'docker' };
        }
    }
    // Fallback local
    const proc = activeTranscoders.get(streamKey);
    if (proc && !proc.killed) {
        try {
            proc.kill('SIGTERM');
            console.log(`[FFMPEG-TRANSCODE] Transcodificador local ${streamKey} finalizado`);
        }
        catch { }
    }
    activeTranscoders.delete(streamKey);
    return { success: true, source: 'local' };
}
