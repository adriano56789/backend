import { Request, Response, NextFunction } from 'express';

/**
 * Middleware para proteger credenciais TURN em produção
 * Evita uso não autorizado do servidor TURN
 */
export const turnSecurityMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Headers de segurança para TURN
    const allowedOrigins = [
        'https://72.60.249.175:3000',
        'http://localhost:3000',
        'https://localhost:3000'
    ];
    
    const origin = req.headers.origin;
    const userAgent = req.headers['user-agent'];
    
    // Validação de origem
    if (origin && !allowedOrigins.includes(origin)) {
        console.warn(`[TURN-SECURITY] Origin não permitido: ${origin}`);
        return res.status(403).json({
            success: false,
            message: 'Origem não permitida'
        });
    }
    
    // Rate limiting para TURN
    const turnRateLimit = {
        windowMs: 60 * 1000, // 1 minuto
        maxRequests: 10, // máximo 10 requisições por minuto
        message: 'Limite de requisições TURN excedido'
    };
    
    // Validação básica de User-Agent para bots
    const suspiciousAgents = [
        'curl',
        'wget',
        'python-requests',
        'postman'
    ];
    
    if (userAgent && suspiciousAgents.some(agent => userAgent.toLowerCase().includes(agent))) {
        console.warn(`[TURN-SECURITY] User-Agent suspeito: ${userAgent}`);
        return res.status(403).json({
            success: false,
            message: 'Acesso não permitido'
        });
    }
    
    // Log de acesso para auditoria
    console.log(`[TURN-SECURITY] Acesso permitido - Origin: ${origin}, IP: ${req.ip}`);
    
    next();
};

/**
 * Middleware para validar credenciais TURN dinâmicas
 */
export const validateTurnCredentials = (req: Request, res: Response, next: NextFunction) => {
    const { username, password } = req.body;
    
    // Validação de credenciais básicas
    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: 'Credenciais TURN são obrigatórias'
        });
    }
    
    // Validação de força da senha
    if (password.length < 16) {
        return res.status(400).json({
            success: false,
            message: 'Senha TURN muito curta (mínimo 16 caracteres)'
        });
    }
    
    // Validação de formato da senha
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecialChars = /[!@#$%^&*]/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChars) {
        return res.status(400).json({
            success: false,
            message: 'Senha TURN deve conter letras maiúsculas, minúsculas, números e caracteres especiais'
        });
    }
    
    console.log(`[TURN-SECURITY] Credenciais validadas para usuário: ${username}`);
    
    next();
};
