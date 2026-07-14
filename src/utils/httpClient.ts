import http from 'http';
import https from 'https';
import { URL } from 'url';

export interface HttpClientOptions {
  baseUrl?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

function httpRequest(
  method: string,
  urlStr: string,
  headers: Record<string, string>,
  body?: any,
  timeout?: number,
  responseType: 'text' | 'buffer' = 'text'
): Promise<{
  status: number;
  statusText: string;
  headers: Record<string, string>;
  bodyText: string;
  buffer: Buffer | null;
}> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlStr);
    const mod = parsedUrl.protocol === 'https:' ? https : http;
    const timeoutMs = timeout || 15000;

    const postData = body !== undefined && method !== 'GET'
      ? (typeof body === 'string' ? body : JSON.stringify(body))
      : undefined;

    const options: http.RequestOptions = {
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
      const chunks: Buffer[] = [];

      res.on('data', (chunk: Buffer) => chunks.push(chunk));

      res.on('end', () => {
        const rawHeaders: Record<string, string> = {};
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
  private baseUrl: string;
  private defaultTimeout: number;
  private defaultHeaders: Record<string, string>;

  constructor(options: HttpClientOptions = {}) {
    this.baseUrl = options.baseUrl || '';
    this.defaultTimeout = options.timeout || 15000;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any,
    options?: RequestOptions
  ): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const timeout = options?.timeout ?? this.defaultTimeout;
    const headers = { ...this.defaultHeaders, ...options?.headers };

    const res = await httpRequest(method, url, headers, body, timeout);

    if (res.status < 200 || res.status >= 300) {
      throw new HttpError(
        `HTTP ${res.status}: ${res.statusText}`,
        res.status,
        res.bodyText
      );
    }

    if (!res.bodyText) return null as T;
    return JSON.parse(res.bodyText) as T;
  }

  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  async post<T>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  async put<T>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }

  async patch<T>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, body, options);
  }

  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  async requestRaw(
    method: string,
    path: string,
    body?: any,
    options?: RequestOptions
  ): Promise<{
    status: number;
    statusText: string;
    ok: boolean;
    headers: Record<string, string>;
    bodyText: string;
  }> {
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

  async requestBuffer(
    method: string,
    path: string,
    body?: any,
    options?: RequestOptions
  ): Promise<{
    status: number;
    statusText: string;
    ok: boolean;
    headers: Record<string, string>;
    buffer: ArrayBuffer;
  }> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const timeout = options?.timeout ?? this.defaultTimeout;
    const headers = { ...this.defaultHeaders, ...options?.headers };

    const res = await httpRequest(method, url, headers, body, timeout, 'buffer');

    return {
      status: res.status,
      statusText: res.statusText,
      ok: res.status >= 200 && res.status < 300,
      headers: res.headers,
      buffer: res.buffer ? res.buffer.buffer as ArrayBuffer : new ArrayBuffer(0),
    };
  }
}

export class HttpError extends Error {
  status: number;
  responseBody: string;

  constructor(message: string, status: number, responseBody: string = '') {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

export const httpClient = new HttpClient();
