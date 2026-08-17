import express from 'express';
import { COMMANDS, COMMAND_TRIGGERS, getStatus, setConfig, emitWebhook, retryEvent, signPayload } from '../services/WebhookBroadcasterService';

const router = express.Router();

router.get('/commands', (req, res) => {
  const commands = COMMANDS || {};
  res.json({
    success: true,
    count: Object.keys(commands).length,
    commands: Object.keys(commands).map(name => ({
      name,
      description: commands[name],
      trigger: COMMAND_TRIGGERS[name] || '',
    })),
  });
});

router.get('/status', (req, res) => {
  res.json(getStatus());
});

router.post('/config', (req, res) => {
  try {
    const body = req.body || {};
    const updated = setConfig(body);
    res.json({ success: true, config: updated });
  }
  catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/test', (req, res) => {
  try {
    const body = req.body || {};
    const command = body.command || 'LiveGo.CallbackAfterCreateRoom';
    const payload = body.payload || {
      RoomId: 'webhook_test',
      HostId: 'system',
      Test: true,
      EventTime: Date.now(),
    };
    emitWebhook(command, payload);
    res.json({ success: true, message: `Evento ${command} enviado para a fila`, command });
  }
  catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/retry/:eventId', (req, res) => {
  try {
    const result = retryEvent(req.params.eventId);
    if (!result.success) {
      return res.status(404).json({ success: false, error: (result as any).error });
    }
    res.json({ success: true, eventId: result.eventId });
  }
  catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/receiver', (req, res) => {
  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  const signature = req.headers['x-livego-signature'] || '';
  const expected = signPayload ? signPayload(body) : '';
  if (expected && signature && signature !== expected) {
    return res.status(403).json({ ActionStatus: 'FAIL', ErrorCode: 403, ErrorInfo: 'Invalid signature' });
  }
  res.json({ ActionStatus: 'OK', ErrorCode: 0, ErrorInfo: '', CallbackCommand: req.headers['x-livego-event'] || '' });
});

export default router;
