import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 60000;
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
        if (now > entry.resetAt) store.delete(key);
    }
}, CLEANUP_INTERVAL);

export function rateLimit(options: { windowMs: number; max: number; message?: string }) {
    const { windowMs, max } = options;
    const message = options.message || 'Muitas requisições. Tente novamente mais tarde.';

    return (req: Request, res: Response, next: NextFunction) => {
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

export const paymentRateLimit = rateLimit({
    windowMs: 60000,
    max: 10,
    message: 'Muitas tentativas de pagamento. Aguarde 1 minuto.'
});

export const webhookRateLimit = rateLimit({
    windowMs: 1000,
    max: 5,
    message: 'Muitas notificações de webhook em curto intervalo.'
});
