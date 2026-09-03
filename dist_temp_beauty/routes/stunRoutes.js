"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
function getStunServersConfig() {
    const stunUrl = process.env.STUN_URL || 'stun:livego.store:3478';
    return [
        { urls: [stunUrl], region: 'custom' },
    ];
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
exports.default = router;
