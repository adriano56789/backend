import { Request, Response, NextFunction } from 'express';
import { ENV } from '../config/env';

const APP_SECRET = ENV.APP_SECRET_HEADER_KEY.trim();
const HEADER_NAME = 'x-acesso-exclusivo-app';
const COOKIE_NAME = 'X-Exclusivo-App';

export function requireAppHeader(req: Request, res: Response, next: NextFunction): void {
  // 1. Verifica header (enviado por loadUrl no WebView)
  const headerValue = req.headers[HEADER_NAME] as string | undefined;
  if (headerValue && headerValue.trim() === APP_SECRET) {
    return next();
  }

  // 2. Verifica cookie (setado via CookieManager para persistir em XHR/fetch)
  const cookieValue = req.cookies?.[COOKIE_NAME];
  if (cookieValue && cookieValue.trim() === APP_SECRET) {
    return next();
  }

  console.warn(`[APP-ONLY] Acesso bloqueado: ${req.method} ${req.path} from ${req.ip}`);
  res.status(403).json({
    success: false,
    error: 'Transmissão ao vivo disponível apenas no aplicativo LiveGo.',
    code: 'APP_ONLY',
  });
}
