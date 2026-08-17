import http from 'http';
import https from 'https';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import url from 'url';

interface WebhookConfig {
  enabled: boolean;
  url: string;
  secret: string;
  maxRetries: number;
  timeoutMs: number;
}

interface BroadcastEvent {
  eventId: string;
  command: string;
  payload: Record<string, any>;
  timestamp: number;
  retries: number;
}

interface StatusMeta {
  delivered?: boolean;
  failed?: boolean;
  skipped?: boolean;
  retryInSec?: number;
  reason?: string;
  status?: number;
  attempt?: number;
  queued?: boolean;
  deduped?: boolean;
}

const DATA_DIR = process.env.LIVEGO_WEBHOOK_DATA_DIR || (process.platform === 'win32' ? path.resolve(process.cwd(), 'data/webhook') : '/app/backend/data');
const CONFIG_FILE = path.join(DATA_DIR, 'webhook-config.json');
const LOG_FILE = path.join(DATA_DIR, 'webhook-log.jsonl');

let _config: WebhookConfig = {
  enabled: process.env.LIVEGO_WEBHOOK_ENABLED !== 'false',
  url: process.env.LIVEGO_WEBHOOK_URL || '',
  secret: process.env.LIVEGO_WEBHOOK_SECRET || '',
  maxRetries: 3,
  timeoutMs: 10000,
};

const recentEvents: Array<StatusMeta & { eventId: string; command: string; timestamp: number }> = [];
const failedEvents = new Map<string, BroadcastEvent>();

// 🔁 DEDUPE: garante que cada evento real dispare UMA única vez por ação.
// A chave é derivada do comando + IDs reais; eventos repetidos dentro da
// janela (ex.: end da live chamado por 2 endpoints diferentes no mesmo toque)
// são descartados silenciosamente.
const DEDUPE_WINDOW_MS = 2500;
const dedupeMap = new Map<string, number>();

function dedupeKey(command: string, payload: Record<string, any>): string | null {
  const p = payload || {};
  if ((command === 'LiveGo.CallbackAfterCreateRoom' || command === 'LiveGo.CallbackAfterDestroyRoom') && p.RoomId) {
    return `${command}|${p.RoomId}`;
  }
  if ((command === 'LiveGo.CallbackAfterCreateBattle' || command === 'LiveGo.CallbackAfterStartBattle' || command === 'LiveGo.CallbackAfterEndBattle') && p.BattleId) {
    return `${command}|${p.BattleId}`;
  }
  if (command === 'LiveGo.CallbackAfterMemberStatusChange' && p.RoomId && p.UserId) {
    return `${command}|${p.RoomId}|${p.UserId}|${p.Action || ''}`;
  }
  if ((command === 'LiveGo.CallbackAfterFollow' || command === 'LiveGo.CallbackAfterUnfollow') && p.FollowerId && p.FollowedId) {
    return `${command}|${p.FollowerId}|${p.FollowedId}`;
  }
  return null;
}

function isDuplicated(command: string, payload: Record<string, any>): boolean {
  const key = dedupeKey(command, payload);
  if (!key) return false;
  const now = Date.now();
  const last = dedupeMap.get(key);
  if (last && now - last < DEDUPE_WINDOW_MS) return true;
  dedupeMap.set(key, now);
  if (dedupeMap.size > 500) {
    for (const [k, t] of dedupeMap) {
      if (now - t > DEDUPE_WINDOW_MS) dedupeMap.delete(k);
    }
  }
  return false;
}

function ensureDataDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); }
  catch (e: any) { console.warn('[WEBHOOK] falha ao criar data dir:', e.message); }
}

function persistConfig() {
  ensureDataDir();
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(_config, null, 2)); }
  catch (e: any) { console.warn('[WEBHOOK] falha ao persistir config:', e.message); }
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      Object.assign(_config, saved);
    }
  }
  catch (e: any) { console.warn('[WEBHOOK] falha ao ler config salva:', e.message); }
}

export function setConfig(partial: Partial<WebhookConfig>) {
  const allowed: Array<keyof WebhookConfig> = ['enabled', 'url', 'secret', 'maxRetries', 'timeoutMs'];
  for (const k of allowed) {
    if ((partial as any)[k] !== undefined) (_config as any)[k] = (partial as any)[k];
  }
  persistConfig();
  return getConfig();
}

export function getConfig() {
  return {
    enabled: !!_config.enabled,
    url: _config.url || '',
    secretSet: !!_config.secret,
    maxRetries: _config.maxRetries,
    timeoutMs: _config.timeoutMs,
  };
}

function buildEvent(command: string, payload: Record<string, any>): BroadcastEvent {
  return {
    eventId: `livego_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
    command,
    payload: payload || {},
    timestamp: Date.now(),
    retries: 0,
  };
}

export function signPayload(rawBody: string) {
  if (!_config.secret) return '';
  return crypto.createHmac('sha256', _config.secret).update(rawBody).digest('hex');
}

function recordLog(event: BroadcastEvent, meta: StatusMeta) {
  try {
    ensureDataDir();
    const line = JSON.stringify({ eventId: event.eventId, command: event.command, timestamp: event.timestamp, ...meta });
    fs.appendFileSync(LOG_FILE, line + '\n');
  }
  catch (e) { /* log nunca quebra o fluxo */ }
  recentEvents.unshift({ eventId: event.eventId, command: event.command, timestamp: event.timestamp, ...meta });
  if (recentEvents.length > 200) recentEvents.pop();
}

function handleFailure(event: BroadcastEvent, attempt: number, reason: string) {
  event.retries += 1;
  if (attempt >= _config.maxRetries) {
    recordLog(event, { delivered: false, failed: true, reason });
    failedEvents.set(event.eventId, { ...event, lastError: reason } as any);
    return;
  }
  recordLog(event, { delivered: false, retryInSec: attempt * 2, reason });
  setTimeout(() => deliver(event, attempt + 1), attempt * 2000);
}

function deliver(event: BroadcastEvent, attempt: number) {
  if (!_config.enabled || !_config.url) {
    recordLog(event, { skipped: true, reason: !_config.enabled ? 'disabled' : 'no-url' });
    return;
  }
  const u = url.parse(_config.url);
  const query = [
    `CallbackCommand=${encodeURIComponent(event.command)}`,
    `contenttype=json`,
    `EventTime=${event.timestamp}`,
  ];
  if (u.search) {
    for (const part of u.search.replace(/^\?/, '').split('&').filter(Boolean)) {
      if (!query.includes(part)) query.push(part);
    }
  }
  const target = url.format({
    protocol: u.protocol,
    auth: u.auth,
    hostname: u.hostname,
    port: u.port,
    pathname: u.pathname,
    search: '?' + query.join('&'),
  });
  const body = JSON.stringify({ EventTime: event.timestamp, EventInfo: event.payload });
  const mod = u.protocol === 'https:' ? https : http;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Content-Length': String(Buffer.byteLength(body)),
    'X-LiveGo-Event': event.command,
    'X-LiveGo-EventId': event.eventId,
  };
  if (_config.secret) headers['X-LiveGo-Signature'] = signPayload(body);
  const req = mod.request(target, { method: 'POST', headers, timeout: _config.timeoutMs }, (res) => {
    let data = '';
    res.on('data', (d) => { data += d.toString(); });
    res.on('end', () => {
      const statusCode = (res as any).statusCode || 0;
      if (statusCode >= 200 && statusCode < 300) {
        recordLog(event, { delivered: true, status: statusCode, attempt });
        failedEvents.delete(event.eventId);
      }
      else {
        handleFailure(event, attempt, `HTTP ${statusCode}: ${data.slice(0, 200)}`);
      }
    });
  });
  req.on('timeout', () => { req.destroy(new Error('timeout')); });
  req.on('error', (e) => { handleFailure(event, attempt, e.message); });
  req.end(body);
}

export function emitWebhook(command: string, payload?: Record<string, any>) {
  try {
    const event = buildEvent(command, payload || {});
    if (isDuplicated(command, event.payload)) {
      recordLog(event, { deduped: true, reason: 'evento duplicado descartado (janela de 2.5s)' });
      return;
    }
    recordLog(event, { queued: true });
    deliver(event, 1);
  }
  catch (e: any) {
    console.warn('[WEBHOOK] erro ao emitir evento:', e.message);
  }
}

export function retryEvent(eventId: string) {
  const ev = failedEvents.get(eventId);
  if (!ev) return { success: false, error: 'evento não encontrado nos falhos' };
  ev.retries = 0;
  deliver(ev, 1);
  return { success: true, eventId };
}

export function getStatus() {
  return {
    service: 'LiveGoWebhookBroadcaster',
    enabled: !!_config.enabled,
    config: getConfig(),
    commands: Object.keys(COMMANDS),
    recent: recentEvents.slice(0, 50),
    failed: Array.from(failedEvents.values()).slice(-50).map(e => ({
      eventId: e.eventId,
      command: e.command,
      timestamp: e.timestamp,
      lastError: (e as any).lastError,
    })),
  };
}

export const COMMANDS: Record<string, string> = {
  'LiveGo.CallbackAfterCreateRoom': 'Sala criada',
  'LiveGo.CallbackAfterDestroyRoom': 'Sala destruída',
  'LiveGo.CallbackAfterUpdateRoomInfo': 'Sala atualizada',
  'LiveGo.CallbackAfterSetMetadata': 'Metadado configurado',
  'LiveGo.CallbackAfterDelMetadata': 'Metadado excluído',
  'LiveGo.CallbackAfterCreateRoomReachingThreshold': 'Criação de sala atingiu 70% do limite',
  'LiveGo.CallbackAfterGift': 'Presente enviado',
  'LiveGo.CallbackAfterMemberStatusChange': 'Status de membro alterado',
  'LiveGo.CallbackAfterOwnerChange': 'Proprietário da sala alterado',
  'LiveGo.CallbackAfterAdminChange': 'Administrador da sala alterado',
  'LiveGo.CallbackAfterSeatListChange': 'Lista de assentos alterada',
  'LiveGo.CallbackAfterCreateBattle': 'Batalha criada',
  'LiveGo.CallbackAfterStartBattle': 'Batalha iniciada',
  'LiveGo.CallbackAfterEndBattle': 'Batalha terminada',
  'LiveGo.CallbackBeforeSendMessage': 'Antes do envio de mensagem',
  'LiveGo.CallbackAfterSendMessage': 'Após o envio de mensagem',
  'LiveGo.CallbackAfterFollow': 'Usuário seguido',
  'LiveGo.CallbackAfterUnfollow': 'Usuário deixou de ser seguido',
};

// 🔎 Registro de como cada evento é acionado no app (para validação real).
// 'NO_TRIGGER' indica evento sem fluxo real correspondente no app — não
// deve ser inventada uma implementação falsa para ele.
export const COMMAND_TRIGGERS: Record<string, string> = {
  'LiveGo.CallbackAfterCreateRoom': 'POST /api/streams (criar sala)',
  'LiveGo.CallbackAfterDestroyRoom': 'POST /api/live/end, /api/streams/:id/end, /api/streams/:id/end-session, /api/lives/:id/end, /api/streams/:streamId/end',
  'LiveGo.CallbackAfterUpdateRoomInfo': 'POST /api/streams/:id/save e /api/streams/:id/cover',
  'LiveGo.CallbackAfterSetMetadata': 'POST /api/streams/:id/save (campos não vazios)',
  'LiveGo.CallbackAfterDelMetadata': 'POST /api/streams/:id/save (campos vazios)',
  'LiveGo.CallbackAfterCreateRoomReachingThreshold': 'Join na sala com viewers >= 70% de maxViewers (requer maxViewers configurado)',
  'LiveGo.CallbackAfterGift': 'POST /api/streams/:id/gift e /api/gifts/send + /api/gifts/streams/:streamId/gift',
  'LiveGo.CallbackAfterMemberStatusChange': 'Socket join_stream (handleJoinStream) / disconnect / REST join/leave',
  'LiveGo.CallbackAfterOwnerChange': 'POST /api/streams/:id/transfer-owner',
  'LiveGo.CallbackAfterAdminChange': 'POST /api/live/role (status co-host)',
  'LiveGo.CallbackAfterSeatListChange': 'POST /api/live/role, /api/live/invite/respond, /api/live/co-host/exit, /api/live/battle/exit, /api/pk/invites/:id/respond',
  'LiveGo.CallbackAfterCreateBattle': 'POST /api/pk/start',
  'LiveGo.CallbackAfterStartBattle': 'POST /api/pk/start',
  'LiveGo.CallbackAfterEndBattle': 'POST /api/pk/end/:battleId, timer automático da PK, /api/live/battle/exit',
  'LiveGo.CallbackBeforeSendMessage': 'Socket send_live_message (pre-hook) / send_chat_message (pre-hook legado)',
  'LiveGo.CallbackAfterSendMessage': 'Socket send_live_message / send_chat_message + REST live-message',
  'LiveGo.CallbackAfterFollow': 'POST /api/users/:id/toggle-follow, socket follow_user, POST /api/followers',
  'LiveGo.CallbackAfterUnfollow': 'POST /api/users/:id/toggle-follow, socket unfollow_user, DELETE /api/followers/:id',
};

loadConfig();
