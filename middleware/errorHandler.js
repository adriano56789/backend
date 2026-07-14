"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSuccessResponse = exports.sendErrorResponse = exports.asyncHandler = exports.errorHandler = void 0;
/**
 * Middleware global para padronizar respostas de erro
 * Garante que todas as APIs retornem status 200 com formato consistente
 */
const errorHandler = (err, req, res, next) => {
    console.error('[Global Error Handler]', {
        error: err.message || err,
        stack: err.stack,
        url: req.url,
        method: req.method,
        body: req.body,
        query: req.query
    });
    // Sempre retornar status 200 com formato padrão
    res.json({
        success: false,
        error: err.message || 'Internal server error',
        data: null
    });
};
exports.errorHandler = errorHandler;
/**
 * Wrapper para async routes - captura erros e padroniza resposta
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
/**
 * Função utilitária para respostas de erro padronizadas
 */
const sendErrorResponse = (res, message, data = null) => {
    console.error('[API Error]', { message, data });
    res.json({
        success: false,
        error: message,
        data
    });
};
exports.sendErrorResponse = sendErrorResponse;
/**
 * Função utilitária para respostas de sucesso padronizadas
 */
const sendSuccessResponse = (res, data, message) => {
    res.json({
        success: true,
        data,
        message
    });
};
exports.sendSuccessResponse = sendSuccessResponse;
