"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyResponseTracker = void 0;
function sanitizeValue(value, path = '', visited) {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'string')
        return value;
    if (typeof value === 'number')
        return value;
    if (typeof value === 'boolean')
        return value;
    if (value instanceof Date)
        return value;
    if (value instanceof RegExp)
        return value;
    if (Buffer.isBuffer(value))
        return value;
    if (typeof value === 'object') {
        if (visited?.has(value))
            return '[Circular]';
        if (!visited)
            visited = new WeakSet();
        visited.add(value);
    }
    if (typeof value?.toJSON === 'function') {
        return sanitizeValue(value.toJSON(), path, visited);
    }
    if (Array.isArray(value)) {
        const arr = value;
        if (arr.length === 0)
            return arr;
        return arr.map((item, i) => sanitizeValue(item, `${path}[${i}]`, visited));
    }
    if (typeof value === 'object') {
        const keys = Object.keys(value);
        if (keys.length === 0)
            return value;
        const sanitized = {};
        for (const key of keys) {
            sanitized[key] = sanitizeValue(value[key], `${path}.${key}`, visited);
        }
        return sanitized;
    }
    return value;
}
let nullFieldLogBuffer = [];
let nullLogTimer = null;
function flushNullLog() {
    if (nullFieldLogBuffer.length === 0)
        return;
    const batch = nullFieldLogBuffer.splice(0);
    Promise.resolve().then(() => __importStar(require('../models/index'))).then(({ EmptyApiLog }) => {
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
        EmptyApiLog.insertMany(docs).catch(() => { });
    }).catch(() => { });
}
function queueNullLog(method, endpoint, fieldPath, type) {
    nullFieldLogBuffer.push({ method, endpoint, path: fieldPath, type, timestamp: new Date() });
    if (!nullLogTimer) {
        nullLogTimer = setTimeout(() => {
            nullLogTimer = null;
            flushNullLog();
        }, 2000);
    }
}
function detectNulls(value, path, method, endpoint, visited) {
    if (value === null || value === undefined) {
        queueNullLog(method, endpoint, path, typeof value === 'undefined' ? 'undefined' : 'null');
        return;
    }
    if (typeof value === 'object') {
        if (visited?.has(value))
            return;
        if (!visited)
            visited = new WeakSet();
        visited.add(value);
        if (Buffer.isBuffer(value) || value instanceof Date || value instanceof RegExp)
            return;
        if (Array.isArray(value)) {
            value.forEach((item, i) => detectNulls(item, `${path}[${i}]`, method, endpoint, visited));
        }
        else {
            for (const key of Object.keys(value)) {
                detectNulls(value[key], `${path}.${key}`, method, endpoint, visited);
            }
        }
    }
}
function isEmptyResponse(body) {
    if (body === null || body === undefined)
        return true;
    if (Array.isArray(body))
        return body.length === 0;
    if (typeof body === 'object') {
        if (body instanceof Buffer)
            return body.length === 0;
        let str;
        try {
            str = JSON.stringify(body);
        }
        catch {
            return false;
        }
        if (str === '{}' || str === '[]')
            return true;
        if (body.data && Array.isArray(body.data.streams) && body.data.streams.length === 0)
            return true;
        if (body.data && Array.isArray(body.data) && body.data.length === 0)
            return true;
        if (body.streams && Array.isArray(body.streams) && body.streams.length === 0)
            return true;
        if (body.success === true && body.streams && Array.isArray(body.streams) && body.streams.length === 0)
            return true;
        if (body.total === 0)
            return true;
        if (body.count === 0)
            return true;
    }
    return false;
}
function extractSummary(body) {
    if (!body)
        return 'null/undefined';
    if (typeof body === 'string')
        return body.slice(0, 200);
    try {
        const str = JSON.stringify(body).slice(0, 300);
        return str;
    }
    catch {
        return String(body).slice(0, 200);
    }
}
const emptyResponseTracker = (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (body) {
        try {
            if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
                detectNulls(body, '$', req.method, req.path);
                const sanitized = sanitizeValue(body);
                if (isEmptyResponse(sanitized)) {
                    logEmptyResponse(req, res.statusCode, sanitized).catch(() => { });
                }
                return originalJson(sanitized);
            }
            if (isEmptyResponse(body)) {
                logEmptyResponse(req, res.statusCode, body).catch(() => { });
            }
        }
        catch {
            // Fallback seguro: envia resposta original sem processamento
        }
        return originalJson(body);
    };
    next();
};
exports.emptyResponseTracker = emptyResponseTracker;
async function logEmptyResponse(req, statusCode, body) {
    try {
        if (req.path.startsWith('/api/debug/') || req.path.startsWith('/api/health'))
            return;
        if (req.path.startsWith('/uploads/'))
            return;
        const { EmptyApiLog } = await Promise.resolve().then(() => __importStar(require('../models/index')));
        let userId = '';
        if (req.user?.id)
            userId = req.user.id;
        if (req.userId)
            userId = req.userId;
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
    }
    catch (err) {
        // Silencioso
    }
}
