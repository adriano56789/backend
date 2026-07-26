"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseHelper = void 0;
/**
 * Helper para padronizar respostas JSON
 *
 * Padrão de sucesso:
 * { "code": 0, "data": {} }
 *
 * Padrão de erro:
 * { "code": 1, "error": "mensagem" }
 */
class ResponseHelper {
    /**
     * Resposta de sucesso
     */
    static success(res, data = {}) {
        return res.json({
            code: 0,
            data
        });
    }
    /**
     * Resposta de erro
     */
    static error(res, message, statusCode = 500) {
        return res.status(statusCode).json({
            code: 1,
            error: message
        });
    }
    /**
     * Resposta de erro com código customizado
     */
    static errorWithCode(res, code, message, statusCode = 500) {
        return res.status(statusCode).json({
            code,
            error: message
        });
    }
}
exports.ResponseHelper = ResponseHelper;
