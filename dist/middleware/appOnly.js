"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAppHeader = requireAppHeader;
const env_1 = require("../config/env");
const APP_SECRET = env_1.ENV.APP_SECRET_HEADER_KEY.trim();
const HEADER_NAME = 'x-acesso-exclusivo-app';
const COOKIE_NAME = 'X-Exclusivo-App';
function requireAppHeader(req, res, next) {
    // 1. Verifica header (enviado por loadUrl no WebView)
    const headerValue = req.headers[HEADER_NAME];
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
