export interface HttpClientOptions {
  baseUrl?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const headers: Record<string, string> = {
        ...this.defaultHeaders,
        ...options?.headers,
      };

      const fetchOptions: RequestInit = {
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
        throw new HttpError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorText
        );
      }

      const text = await response.text();
      if (!text) return null as T;
      return JSON.parse(text) as T;
    } finally {
      clearTimeout(timeoutId);
    }
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
