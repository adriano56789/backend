import express from 'express';
import { ENV } from '../config/env';

const router = express.Router();

interface StunServer {
  urls: string[];
  region: string;
}

const DEFAULT_STUN_SERVERS: StunServer[] = [
  { urls: ['stun:stun.l.google.com:19302'], region: 'global' },
  { urls: ['stun:stun1.l.google.com:19302'], region: 'global' },
  { urls: ['stun:stun2.l.google.com:19302'], region: 'global' },
  { urls: ['stun:stun3.l.google.com:19302'], region: 'global' },
  { urls: ['stun:stun4.l.google.com:19302'], region: 'global' },
];

function getStunServersConfig(): StunServer[] {
  const customStun = (process.env.STUN_URL);
  if (customStun) {
    return [
      ...DEFAULT_STUN_SERVERS,
      { urls: [customStun], region: 'custom' },
    ];
  }
  return DEFAULT_STUN_SERVERS;
}

// GET /api/stun/servers — Retorna lista de servidores STUN
router.get('/stun/servers', (_req, res) => {
  res.json({
    success: true,
    stunServers: getStunServersConfig(),
    timestamp: new Date().toISOString(),
  });
});

// POST /api/stun/discover — Descobrir IP público via STUN
router.post('/stun/discover', (req, res) => {
  const { stunUrl } = req.body;
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const ip = Array.isArray(clientIp) ? clientIp[0] : clientIp?.split(',')[0]?.trim() || 'unknown';

  res.json({
    success: true,
    ip,
    port: req.socket.remotePort || 0,
    stunServer: stunUrl || 'stun:stun.l.google.com:19302',
    natType: 'unknown', // Seria determinado por probing STUN real
    timestamp: new Date().toISOString(),
  });
});

export default router;
