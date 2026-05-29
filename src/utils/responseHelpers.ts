/**
 * Helpers para padronizar respostas de erro e sucesso
 * 
 * Este arquivo centraliza o formato de respostas para garantir
 * consistência em toda a aplicação.
 */

import { Response } from 'express';

// Tipos de resposta padrão
export interface StandardResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
    errors?: Array<{
        field: string;
        message: string;
    }>;
}

export interface SrsResponse {
    code: number;
    msg: string;
    data?: any;
}

/**
 * Resposta de sucesso padrão
 */
export const successResponse = <T = any>(
    res: Response, 
    message: string = 'Operação realizada com sucesso',
    data?: T,
    statusCode: number = 200
): Response => {
    const response: StandardResponse<T> = {
        success: true,
        message,
        data
    };
    
    return res.status(statusCode).json(response);
};

/**
 * Resposta de erro padrão
 */
export const errorResponse = (
    res: Response,
    message: string,
    statusCode: number = 400,
    errors?: Array<{ field: string; message: string }>
): Response => {
    const response: StandardResponse = {
        success: false,
        message,
        errors
    };
    
    return res.status(statusCode).json(response);
};

/**
 * Resposta de erro de validação
 */
export const validationErrorResponse = (
    res: Response,
    errors: Array<{ field: string; message: string }>
): Response => {
    return errorResponse(
        res,
        'Dados inválidos',
        400,
        errors
    );
};

/**
 * Resposta de não encontrado
 */
export const notFoundResponse = (
    res: Response,
    message: string = 'Recurso não encontrado'
): Response => {
    return errorResponse(res, message, 404);
};

/**
 * Resposta de não autorizado
 */
export const unauthorizedResponse = (
    res: Response,
    message: string = 'Não autorizado'
): Response => {
    return errorResponse(res, message, 401);
};

/**
 * Resposta de acesso proibido
 */
export const forbiddenResponse = (
    res: Response,
    message: string = 'Acesso proibido'
): Response => {
    return errorResponse(res, message, 403);
};

/**
 * Resposta de conflito
 */
export const conflictResponse = (
    res: Response,
    message: string = 'Conflito de dados'
): Response => {
    return errorResponse(res, message, 409);
};

/**
 * Resposta de erro interno do servidor
 */
export const internalServerErrorResponse = (
    res: Response,
    message: string = 'Erro interno do servidor',
    error?: any
): Response => {
    console.error('[INTERNAL_SERVER_ERROR]:', error);
    
    return errorResponse(res, message, 500);
};

/**
 * Resposta no formato SRS (para callbacks)
 */
export const srsResponse = (
    res: Response,
    code: number,
    msg: string,
    data?: any
): Response => {
    const response: SrsResponse = { code, msg, data };
    return res.json(response);
};

/**
 * Resposta de sucesso SRS
 */
export const srsSuccessResponse = (
    res: Response,
    msg: string = 'OK',
    data?: any
): Response => {
    return srsResponse(res, 0, msg, data);
};

/**
 * Resposta de erro SRS
 */
export const srsErrorResponse = (
    res: Response,
    code: number,
    msg: string
): Response => {
    return srsResponse(res, code, msg);
};

/**
 * Wrapper para tratamento de erros assíncronos
 */
export const asyncErrorHandler = (
    fn: (req: any, res: any, next: any) => Promise<any>
) => {
    return (req: any, res: any, next: any) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Middleware de tratamento de erros global
 */
export const globalErrorHandler = (
    error: any,
    req: any,
    res: Response,
    next: any
): Response | void => {
    console.error('[GLOBAL_ERROR]:', {
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        body: req.body,
        query: req.query,
        params: req.params
    });

    // Erros de validação do Zod
    if (error.name === 'ZodError') {
        return validationErrorResponse(res, error.issues || []);
    }

    // Erros de duplicação do MongoDB
    if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return conflictResponse(res, `Registro duplicado: ${field}`);
    }

    // Erros de validação do Mongoose
    if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map((err: any) => ({
            field: err.path,
            message: err.message
        }));
        return validationErrorResponse(res, errors);
    }

    // Erro padrão
    return internalServerErrorResponse(res, error.message, error);
};


/**
 * Verificar se é erro de servidor (5xx)
 */
export const isServerError = (statusCode: number): boolean => {
    return statusCode >= 500 && statusCode < 600;
};

/**
 * Log de requisição para debugging
 */
export const logRequest = (
    req: any,
    message?: string
): void => {
    const logData = {
        method: req.method,
        url: req.url,
        params: req.params,
        query: req.query,
        body: req.body,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        timestamp: new Date().toISOString()
    };

    if (message) {
        console.log(`[${message}]:`, JSON.stringify(logData, null, 2));
    } else {
        console.log('[REQUEST]:', JSON.stringify(logData, null, 2));
    }
};

/**
 * Log de resposta para debugging
 */
export const logResponse = (
    req: any,
    statusCode: number,
    data?: any,
    message?: string
): void => {
    const logData = {
        method: req.method,
        url: req.url,
        statusCode,
        message,
        data: data ? JSON.stringify(data).substring(0, 500) + '...' : undefined,
        timestamp: new Date().toISOString()
    };

    console.log('[RESPONSE]:', JSON.stringify(logData, null, 2));
};
