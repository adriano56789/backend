"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpClient = exports.HttpError = void 0;
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const headers = {
                ...this.defaultHeaders,
                ...options?.headers,
            };
            const fetchOptions = {
                method,
                headers,
                signal: controller.signal,
            };
            if (body !== undefined && method !== 'GET') {
                fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
            }
            const response = await fetch(url, fetchOptions);
            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                throw new HttpError(`HTTP ${response.status}: ${response.statusText}`, response.status, errorText);
            }
            const text = await response.text();
            if (!text)
                return null;
            return JSON.parse(text);
        }
        finally {
            clearTimeout(timeoutId);
        }
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
    /**
     * requestRaw() — retorna a resposta HTTP bruta sem parsear JSON.
     * Necessário para proxies SDP (WHIP/WHEP), ICE trickle, etc.
     * Retorna status, headers, e body como string.
     */
    async requestRaw(method, path, body, options) {
        const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
        const timeout = options?.timeout ?? this.defaultTimeout;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const headers = {
                ...this.defaultHeaders,
                ...options?.headers,
            };
            const fetchOptions = {
                method,
                headers,
                signal: controller.signal,
            };
            if (body !== undefined && method !== 'GET') {
                fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
            }
            const response = await fetch(url, fetchOptions);
            const bodyText = await response.text();
            return {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                headers: response.headers,
                bodyText,
            };
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    /**
     * requestBuffer() — retorna resposta binária como ArrayBuffer,
     * com status/ok/headers para verificação.
     * Necessário para proxy HLS/TS/flv.
     */
    async requestBuffer(method, path, body, options) {
        const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
        const timeout = options?.timeout ?? this.defaultTimeout;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const headers = {
                ...this.defaultHeaders,
                ...options?.headers,
            };
            const fetchOptions = {
                method,
                headers,
                signal: controller.signal,
            };
            if (body !== undefined && method !== 'GET') {
                fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
            }
            const response = await fetch(url, fetchOptions);
            const buffer = await response.arrayBuffer();
            return {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                headers: response.headers,
                buffer,
            };
        }
        finally {
            clearTimeout(timeoutId);
        }
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
