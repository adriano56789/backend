import { spawn, ChildProcess } from 'child_process';
import { registerFfmpegProcess } from '../server';

const SRS_RTMP_URL = process.env.SRS_RTMP_URL || 'rtmp://127.0.0.1/live';
const MAX_CONCURRENT_FFMPEG = parseInt(process.env.MAX_CONCURRENT_FFMPEG || '3', 10);

let activeMixers = 0;

/**
 * Inicia processo FFmpeg para compor duas streams lado a lado (MCU fallback).
 * Útil para HLS/FLV/recording — viewers WebRTC usam SFU puro (WHEP múltiplo).
 *
 * Layout: hstack (960x860 = 2x 480x860) + amix
 * Parâmetros low-delay para evitar A/V desync.
 * Preset ultrafast + zerolatency para mínima carga de CPU.
 */
export function startBattleMixer(
  battleId: string,
  streamKeyA: string,
  streamKeyB: string
): ChildProcess | null {
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

  const mixProcess = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
  activeMixers++;

  registerFfmpegProcess(mixProcess);

  mixProcess.stderr?.on('data', (data: Buffer) => {
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

export function stopMixer(proc: ChildProcess | null) {
  if (!proc || proc.killed) return;
  try {
    proc.kill('SIGTERM');
    console.log('[MCU] Mixer finalizado via SIGTERM');
  } catch (_) {}
}

export function getActiveMixerCount(): number {
  return activeMixers;
}
