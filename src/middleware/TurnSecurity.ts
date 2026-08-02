import { Request, Response, NextFunction } from 'express';
import { ENV } from '../config/env';

/**
 * Lista de domínios confiáveis (extraídos do CORS_ORIGIN + padrões conhecidos)
 * Usa pattern matching em vez de match exato para aceitar subdomínios e variações.
 */
function buildTrustedDomains(): string[] {
  const corsOrigins = (ENV.CORS_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean);
  const domains = [
    // Extrair domínios das origens configuradas (ex: "https://livego.store" → "livego.store")
    ...corsOrigins.map(o => {
      try { return new URL(o).hostname; } catch { return o; }
    }),
    // Domínios padrão de produção
    'livego.store',
    'www.livego.store',
    'api.livego.store',
    // Localhost para desenvolvimento
    'localhost',
    '127.0.0.1',
  ];
  // Deduplicar
  return [...new Set(domains)];
}

/**
 * Verifica se a origin está em um domínio confiável.
 * Aceita qualquer subdomínio de um domínio confiável.
 */
function isTrustedOrigin(origin: string, trustedDomains: string[]): boolean {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return trustedDomains.some(domain => {
      // Match exato
      if (hostname === domain.toLowerCase()) return true;
      // Match de subdomínio (ex: app.livego.store → livego.store)
      if (hostname.endsWith('.' + domain.toLowerCase())) return true;
      return false;
    });
  } catch {
    return false;
  }
}

/**
 * Middleware para proteger credenciais TURN em produção
 * Evita uso não autorizado do servidor TURN
 * Usa pattern matching de domínios em vez de comparação exata de origins.
 */
export const turnSecurityMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const trustedDomains = buildTrustedDomains();
    const origin = req.headers.origin;
    const userAgent = req.headers['user-agent'];

    // Validação de origem (se presente)
    // Mobile apps (WebView, React Native, etc.) podem não enviar origin
    if (origin) {
        if (!isTrustedOrigin(origin, trustedDomains)) {
            console.warn(`[TURN-SECURITY] Origin não permitido: ${origin}`);
            return res.status(403).json({
                success: false,
                message: 'Origem não permitida',
            });
        }
    }

    // Validação básica de User-Agent para bots conhecidos
    const suspiciousAgents = [
        'curl',
        'wget',
        'python-requests',
        'postman',
        'go-http-client',
    ];

    if (userAgent && suspiciousAgents.some(agent => userAgent.toLowerCase().includes(agent))) {
        console.warn(`[TURN-SECURITY] User-Agent suspeito: ${userAgent}`);
        return res.status(403).json({
            success: false,
            message: 'Acesso não permitido',
        });
    }

    // Log de acesso para auditoria
    console.log(`[TURN-SECURITY] Acesso permitido - Origin: ${origin || 'N/A'}, IP: ${req.ip}`);

    next();
};

/**
 * Middleware para validar credenciais TURN dinâmicas
 */
export const validateTurnCredentials = (req: Request, res: Response, next: NextFunction) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: 'Credenciais TURN são obrigatórias',
        });
    }

    if (password.length < 16) {
        return res.status(400).json({
            success: false,
            message: 'Senha TURN muito curta (mínimo 16 caracteres)',
        });
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecialChars = /[!@#$%^&*]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChars) {
        return res.status(400).json({
            success: false,
            message: 'Senha TURN deve conter letras maiúsculas, minúsculas, números e caracteres especiais',
        });
    }

    console.log(`[TURN-SECURITY] Credenciais validadas para usuário: ${username}`);

    next();
};
