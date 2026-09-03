"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const WebhookBroadcasterService_1 = require("../services/WebhookBroadcasterService");
const router = express_1.default.Router();
router.get('/commands', (req, res) => {
    const commands = WebhookBroadcasterService_1.COMMANDS || {};
    res.json({
        success: true,
        count: Object.keys(commands).length,
        commands: Object.keys(commands).map(name => ({
            name,
            description: commands[name],
            trigger: WebhookBroadcasterService_1.COMMAND_TRIGGERS[name] || '',
        })),
    });
});
router.get('/status', (req, res) => {
    res.json((0, WebhookBroadcasterService_1.getStatus)());
});
router.post('/config', (req, res) => {
    try {
        const body = req.body || {};
        const updated = (0, WebhookBroadcasterService_1.setConfig)(body);
        res.json({ success: true, config: updated });
    }
    catch (error) {
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
        (0, WebhookBroadcasterService_1.emitWebhook)(command, payload);
        res.json({ success: true, message: `Evento ${command} enviado para a fila`, command });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/retry/:eventId', (req, res) => {
    try {
        const result = (0, WebhookBroadcasterService_1.retryEvent)(req.params.eventId);
        if (!result.success) {
            return res.status(404).json({ success: false, error: result.error });
        }
        res.json({ success: true, eventId: result.eventId });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/receiver', (req, res) => {
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    const signature = req.headers['x-livego-signature'] || '';
    const expected = WebhookBroadcasterService_1.signPayload ? (0, WebhookBroadcasterService_1.signPayload)(body) : '';
    if (expected && signature && signature !== expected) {
        return res.status(403).json({ ActionStatus: 'FAIL', ErrorCode: 403, ErrorInfo: 'Invalid signature' });
    }
    res.json({ ActionStatus: 'OK', ErrorCode: 0, ErrorInfo: '', CallbackCommand: req.headers['x-livego-event'] || '' });
});
exports.default = router;
