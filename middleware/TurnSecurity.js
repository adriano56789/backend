"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTurnCredentials = exports.turnSecurityMiddleware = void 0;
const env_1 = require("../config/env");
/**
 * Middleware para proteger credenciais TURN em produção
 * Evita uso não autorizado do servidor TURN
 * Usa as mesmas origens configuradas no CORS_ORIGIN do env.ts
 */
const turnSecurityMiddleware = (req, res, next) => {
    // Usar origens configuradas no ENV em vez de hardcoded
    const corsOrigins = env_1.ENV.CORS_ORIGIN.split(',').map(o => o.trim());
    const allowedOrigins = [
        ...corsOrigins,
        'http://localhost:3000',
        'https://localhost:3000',
        'https://72.60.249.175:3000',
        'https://livego.store',
        'https://api.livego.store',
        'https://www.livego.store',
    ];
    const origin = req.headers.origin;
    const userAgent = req.headers['user-agent'];
    // Validação de origem (se presente - mobile apps não enviam origin)
    if (origin && !allowedOrigins.includes(origin)) {
        // Verificar se é uma origem localhost (genérica)
        const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
        if (!isLocalhost) {
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
exports.turnSecurityMiddleware = turnSecurityMiddleware;
/**
 * Middleware para validar credenciais TURN dinâmicas
 */
const validateTurnCredentials = (req, res, next) => {
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
exports.validateTurnCredentials = validateTurnCredentials;
