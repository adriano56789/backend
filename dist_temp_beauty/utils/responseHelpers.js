"use strict";
/**
 * Helpers para padronizar respostas de erro e sucesso
 *
 * Este arquivo centraliza o formato de respostas para garantir
 * consistência em toda a aplicação.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logResponse = exports.logRequest = exports.isServerError = exports.globalErrorHandler = exports.asyncErrorHandler = exports.srsErrorResponse = exports.srsSuccessResponse = exports.srsResponse = exports.internalServerErrorResponse = exports.conflictResponse = exports.forbiddenResponse = exports.unauthorizedResponse = exports.notFoundResponse = exports.validationErrorResponse = exports.errorResponse = exports.successResponse = void 0;
/**
 * Resposta de sucesso padrão
 */
const successResponse = (res, message = 'Operação realizada com sucesso', data, statusCode = 200) => {
    const response = {
        success: true,
        message,
        data
    };
    return res.status(statusCode).json(response);
};
exports.successResponse = successResponse;
/**
 * Resposta de erro padrão
 */
const errorResponse = (res, message, statusCode = 400, errors) => {
    const response = {
        success: false,
        message,
        errors
    };
    return res.status(statusCode).json(response);
};
exports.errorResponse = errorResponse;
/**
 * Resposta de erro de validação
 */
const validationErrorResponse = (res, errors) => {
    return (0, exports.errorResponse)(res, 'Dados inválidos', 400, errors);
};
exports.validationErrorResponse = validationErrorResponse;
/**
 * Resposta de não encontrado
 */
const notFoundResponse = (res, message = 'Recurso não encontrado') => {
    return (0, exports.errorResponse)(res, message, 404);
};
exports.notFoundResponse = notFoundResponse;
/**
 * Resposta de não autorizado
 */
const unauthorizedResponse = (res, message = 'Não autorizado') => {
    return (0, exports.errorResponse)(res, message, 401);
};
exports.unauthorizedResponse = unauthorizedResponse;
/**
 * Resposta de acesso proibido
 */
const forbiddenResponse = (res, message = 'Acesso proibido') => {
    return (0, exports.errorResponse)(res, message, 403);
};
exports.forbiddenResponse = forbiddenResponse;
/**
 * Resposta de conflito
 */
const conflictResponse = (res, message = 'Conflito de dados') => {
    return (0, exports.errorResponse)(res, message, 409);
};
exports.conflictResponse = conflictResponse;
/**
 * Resposta de erro interno do servidor
 */
const internalServerErrorResponse = (res, message = 'Erro interno do servidor', error) => {
    console.error('[INTERNAL_SERVER_ERROR]:', error);
    return (0, exports.errorResponse)(res, message, 500);
};
exports.internalServerErrorResponse = internalServerErrorResponse;
/**
 * Resposta no formato SRS (para callbacks)
 */
const srsResponse = (res, code, msg, data) => {
    const response = { code, msg, data };
    return res.json(response);
};
exports.srsResponse = srsResponse;
/**
 * Resposta de sucesso SRS
 */
const srsSuccessResponse = (res, msg = 'OK', data) => {
    return (0, exports.srsResponse)(res, 0, msg, data);
};
exports.srsSuccessResponse = srsSuccessResponse;
/**
 * Resposta de erro SRS
 */
const srsErrorResponse = (res, code, msg) => {
    return (0, exports.srsResponse)(res, code, msg);
};
exports.srsErrorResponse = srsErrorResponse;
/**
 * Wrapper para tratamento de erros assíncronos
 */
const asyncErrorHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncErrorHandler = asyncErrorHandler;
/**
 * Middleware de tratamento de erros global
 */
const globalErrorHandler = (error, req, res, next) => {
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
        return (0, exports.validationErrorResponse)(res, error.issues || []);
    }
    // Erros de duplicação do MongoDB
    if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return (0, exports.conflictResponse)(res, `Registro duplicado: ${field}`);
    }
    // Erros de validação do Mongoose
    if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map((err) => ({
            field: err.path,
            message: err.message
        }));
        return (0, exports.validationErrorResponse)(res, errors);
    }
    // Erro padrão
    return (0, exports.internalServerErrorResponse)(res, error.message, error);
};
exports.globalErrorHandler = globalErrorHandler;
/**
 * Verificar se é erro de servidor (5xx)
 */
const isServerError = (statusCode) => {
    return statusCode >= 500 && statusCode < 600;
};
exports.isServerError = isServerError;
/**
 * Log de requisição para debugging
 */
const logRequest = (req, message) => {
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
    }
    else {
        console.log('[REQUEST]:', JSON.stringify(logData, null, 2));
    }
};
exports.logRequest = logRequest;
/**
 * Log de resposta para debugging
 */
const logResponse = (req, statusCode, data, message) => {
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
exports.logResponse = logResponse;
