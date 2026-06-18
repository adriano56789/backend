import { Request, Response, NextFunction } from 'express';

function sanitizeValue(value: any, path: string = '', visited?: WeakSet<object>): any {
    if (value === null || value === undefined) {
        return '';
    }

    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value;

    if (value instanceof Date) return value;
    if (value instanceof RegExp) return value;
    if (Buffer.isBuffer(value)) return value;

    if (typeof value === 'object') {
        if (visited?.has(value)) return '[Circular]';
        if (!visited) visited = new WeakSet();
        visited.add(value);
    }

    if (typeof value?.toJSON === 'function') {
        return sanitizeValue(value.toJSON(), path, visited);
    }

    if (Array.isArray(value)) {
        const arr = value as any[];
        if (arr.length === 0) return arr;
        return arr.map((item, i) => sanitizeValue(item, `${path}[${i}]`, visited));
    }

    if (typeof value === 'object') {
        const keys = Object.keys(value);
        if (keys.length === 0) return value;
        const sanitized: Record<string, any> = {};
        for (const key of keys) {
            sanitized[key] = sanitizeValue(value[key], `${path}.${key}`, visited);
        }
        return sanitized;
    }

    return value;
}

let nullFieldLogBuffer: Array<{ method: string; endpoint: string; path: string; type: string; timestamp: Date }> = [];
let nullLogTimer: NodeJS.Timeout | null = null;

function flushNullLog() {
    if (nullFieldLogBuffer.length === 0) return;
    const batch = nullFieldLogBuffer.splice(0);
    import('../models/index').then(({ EmptyApiLog }) => {
        const docs = batch.map(item => new EmptyApiLog({
            method: item.method,
            endpoint: item.endpoint + ' (null field)',
            query: '',
            requestBody: '',
            responseSummary: `${item.type} em ${item.path}`,
            statusCode: 200,
            userId: '',
            userAgent: '',
            referer: '',
            ip: '',
        }));
        EmptyApiLog.insertMany(docs).catch(() => {});
    }).catch(() => {});
}

function queueNullLog(method: string, endpoint: string, fieldPath: string, type: string) {
    nullFieldLogBuffer.push({ method, endpoint, path: fieldPath, type, timestamp: new Date() });
    if (!nullLogTimer) {
        nullLogTimer = setTimeout(() => {
            nullLogTimer = null;
            flushNullLog();
        }, 2000);
    }
}

function detectNulls(value: any, path: string, method: string, endpoint: string, visited?: WeakSet<object>): void {
    if (value === null || value === undefined) {
        queueNullLog(method, endpoint, path, typeof value === 'undefined' ? 'undefined' : 'null');
        return;
    }

    if (typeof value === 'object') {
        if (visited?.has(value)) return;
        if (!visited) visited = new WeakSet();
        visited.add(value);

        if (Buffer.isBuffer(value) || value instanceof Date || value instanceof RegExp) return;

        if (Array.isArray(value)) {
            value.forEach((item, i) => detectNulls(item, `${path}[${i}]`, method, endpoint, visited));
        } else {
            for (const key of Object.keys(value)) {
                detectNulls(value[key], `${path}.${key}`, method, endpoint, visited);
            }
        }
    }
}

function isEmptyResponse(body: any): boolean {
    if (body === null || body === undefined) return true;
    if (Array.isArray(body)) return body.length === 0;
    if (typeof body === 'object') {
        if (body instanceof Buffer) return body.length === 0;
        let str: string;
        try {
            str = JSON.stringify(body);
        } catch {
            return false;
        }
        if (str === '{}' || str === '[]') return true;
        if (body.data && Array.isArray(body.data.streams) && body.data.streams.length === 0) return true;
        if (body.data && Array.isArray(body.data) && body.data.length === 0) return true;
        if (body.streams && Array.isArray(body.streams) && body.streams.length === 0) return true;
        if (body.success === true && body.streams && Array.isArray(body.streams) && body.streams.length === 0) return true;
        if (body.total === 0) return true;
        if (body.count === 0) return true;
    }
    return false;
}

function extractSummary(body: any): string {
    if (!body) return 'null/undefined';
    if (typeof body === 'string') return body.slice(0, 200);
    try {
        const str = JSON.stringify(body).slice(0, 300);
        return str;
    } catch {
        return String(body).slice(0, 200);
    }
}

export const emptyResponseTracker = (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = function (body?: any) {
        try {
            if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
                detectNulls(body, '$', req.method, req.path);
                const sanitized = sanitizeValue(body);
                if (isEmptyResponse(sanitized)) {
                    logEmptyResponse(req, res.statusCode, sanitized).catch(() => {});
                }
                return originalJson(sanitized);
            }
            if (isEmptyResponse(body)) {
                logEmptyResponse(req, res.statusCode, body).catch(() => {});
            }
        } catch {
            // Fallback seguro: envia resposta original sem processamento
        }
        return originalJson(body);
    } as typeof res.json;

    next();
};

async function logEmptyResponse(req: Request, statusCode: number, body: any) {
    try {
        if (req.path.startsWith('/api/debug/') || req.path.startsWith('/api/health')) return;
        if (req.path.startsWith('/uploads/')) return;

        const { EmptyApiLog } = await import('../models/index');

        let userId = '';
        if ((req as any).user?.id) userId = (req as any).user.id;
        if ((req as any).userId) userId = (req as any).userId;

        const log = new EmptyApiLog({
            method: req.method,
            endpoint: req.path,
            query: JSON.stringify(req.query),
            requestBody: req.method !== 'GET' ? JSON.stringify(req.body).slice(0, 500) : '',
            responseSummary: extractSummary(body),
            statusCode,
            userId,
            userAgent: (req.headers['user-agent'] || '').slice(0, 200),
            referer: (req.headers['referer'] || '').slice(0, 200),
            ip: (req.ip || req.socket?.remoteAddress || '').slice(0, 50),
        });

        await log.save();

        if (process.env.NODE_ENV !== 'production') {
            console.log(`[EMPTY-API] ${req.method} ${req.path} -> ${statusCode} (empty response)`);
        }
    } catch (err) {
        // Silencioso
    }
}
