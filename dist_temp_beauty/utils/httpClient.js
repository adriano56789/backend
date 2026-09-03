"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpClient = exports.HttpError = void 0;
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const url_1 = require("url");
function httpRequest(method, urlStr, headers, body, timeout, responseType = 'text') {
    return new Promise((resolve, reject) => {
        const parsedUrl = new url_1.URL(urlStr);
        const mod = parsedUrl.protocol === 'https:' ? https_1.default : http_1.default;
        const timeoutMs = timeout || 15000;
        const postData = body !== undefined && method !== 'GET'
            ? (typeof body === 'string' ? body : JSON.stringify(body))
            : undefined;
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method,
            headers: {
                ...headers,
                ...(postData !== undefined ? { 'Content-Length': Buffer.byteLength(postData).toString() } : {}),
            },
            timeout: timeoutMs,
        };
        const req = mod.request(options, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const rawHeaders = {};
                if (res.headers) {
                    for (const [k, v] of Object.entries(res.headers)) {
                        rawHeaders[k] = Array.isArray(v) ? v.join(', ') : (v || '');
                    }
                }
                const fullBuffer = Buffer.concat(chunks);
                resolve({
                    status: res.statusCode || 0,
                    statusText: res.statusMessage || '',
                    headers: rawHeaders,
                    bodyText: fullBuffer.toString('utf-8'),
                    buffer: responseType === 'buffer' ? fullBuffer : null,
                });
            });
        });
        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request timeout after ${timeoutMs}ms`));
        });
        req.on('error', (err) => {
            reject(err);
        });
        if (postData !== undefined) {
            req.write(postData);
        }
        req.end();
    });
}
class HttpClient {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || '';
        this.defaultTimeout = options.timeout || 15000;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            ...options.headers,
        };
    }
    async request(method, path, body, options) {
        const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
        const timeout = options?.timeout ?? this.defaultTimeout;
        const headers = { ...this.defaultHeaders, ...options?.headers };
        const res = await httpRequest(method, url, headers, body, timeout);
        if (res.status < 200 || res.status >= 300) {
            throw new HttpError(`HTTP ${res.status}: ${res.statusText}`, res.status, res.bodyText);
        }
        if (!res.bodyText)
            return null;
        return JSON.parse(res.bodyText);
    }
    async get(path, options) {
        return this.request('GET', path, undefined, options);
    }
    async post(path, body, options) {
        return this.request('POST', path, body, options);
    }
    async put(path, body, options) {
        return this.request('PUT', path, body, options);
    }
    async patch(path, body, options) {
        return this.request('PATCH', path, body, options);
    }
    async delete(path, options) {
        return this.request('DELETE', path, undefined, options);
    }
    async requestRaw(method, path, body, options) {
        const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
        const timeout = options?.timeout ?? this.defaultTimeout;
        const headers = { ...this.defaultHeaders, ...options?.headers };
        const res = await httpRequest(method, url, headers, body, timeout);
        return {
            status: res.status,
            statusText: res.statusText,
            ok: res.status >= 200 && res.status < 300,
            headers: res.headers,
            bodyText: res.bodyText,
        };
    }
    async requestBuffer(method, path, body, options) {
        const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
        const timeout = options?.timeout ?? this.defaultTimeout;
        const headers = { ...this.defaultHeaders, ...options?.headers };
        const res = await httpRequest(method, url, headers, body, timeout, 'buffer');
        return {
            status: res.status,
            statusText: res.statusText,
            ok: res.status >= 200 && res.status < 300,
            headers: res.headers,
            buffer: res.buffer ? res.buffer.buffer : new ArrayBuffer(0),
        };
    }
}
class HttpError extends Error {
    constructor(message, status, responseBody = '') {
        super(message);
        this.name = 'HttpError';
        this.status = status;
        this.responseBody = responseBody;
    }
}
exports.HttpError = HttpError;
exports.httpClient = new HttpClient();
