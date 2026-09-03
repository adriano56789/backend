"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookRateLimit = exports.paymentRateLimit = void 0;
exports.rateLimit = rateLimit;
const store = new Map();
const CLEANUP_INTERVAL = 60000;
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
        if (now > entry.resetAt)
            store.delete(key);
    }
}, CLEANUP_INTERVAL);
function rateLimit(options) {
    const { windowMs, max } = options;
    const message = options.message || 'Muitas requisições. Tente novamente mais tarde.';
    return (req, res, next) => {
        const key = `${req.ip}:${req.path}`;
        const now = Date.now();
        const entry = store.get(key);
        if (!entry || now > entry.resetAt) {
            store.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }
        entry.count++;
        if (entry.count > max) {
            res.status(429).json({ error: message });
            return;
        }
        next();
    };
}
exports.paymentRateLimit = rateLimit({
    windowMs: 60000,
    max: 10,
    message: 'Muitas tentativas de pagamento. Aguarde 1 minuto.'
});
exports.webhookRateLimit = rateLimit({
    windowMs: 1000,
    max: 5,
    message: 'Muitas notificações de webhook em curto intervalo.'
});
