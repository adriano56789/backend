// Script para gerar tokens de teste para o LiveKit DataChannel Test
// Uso: node generate-test-tokens.js <streamId>
// Saída: JSON com tokens para 2 participantes

const { AccessToken } = require('livekit-server-sdk');

const streamId = process.argv[2] || 'test-stream-' + Date.now();
const roomName = `live_${streamId}`;
const apiKey = 'dfd8670dd9bc2f158eb5da850fcb47778f19fc9c88ed8f76f2d1d34cd0d29c66';
const apiSecret = '8529e52ace6e923af0a1b72dffe29fc59372faa96b302c398c9142e197f7636d';
const lkUrl = 'wss://sfu.livego.store';

// Token para Usuário A (espectador) - canPublishData: true
const tokenA = new AccessToken(apiKey, apiSecret, {
  identity: 'test-viewer-' + Date.now(),
  ttl: '6h',
});
tokenA.addGrant({
  roomJoin: true,
  room: roomName,
  canPublish: false,
  canPublishData: true,
  canSubscribe: true,
});

// Token para Usuário B (host) - canPublishData: true
const tokenB = new AccessToken(apiKey, apiSecret, {
  identity: 'test-host-' + Date.now(),
  ttl: '6h',
});
tokenB.addGrant({
  roomJoin: true,
  room: roomName,
  canPublish: false,
  canPublishData: true,
  canSubscribe: true,
});

const result = {
  streamId,
  roomName,
  serverUrl: lkUrl,
  userA: {
    token: tokenA.toJwt(),
  },
  userB: {
    token: tokenB.toJwt(),
  },
};

console.log(JSON.stringify(result, null, 2));
