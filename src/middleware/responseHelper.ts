import { Response } from 'express';

/**
 * Helper para padronizar respostas JSON
 * 
 * Padrão de sucesso:
 * { "code": 0, "data": {} }
 * 
 * Padrão de erro:
 * { "code": 1, "error": "mensagem" }
 */

export class ResponseHelper {
  /**
   * Resposta de sucesso
   */
  static success(res: Response, data: any = {}) {
    return res.json({
      code: 0,
      data
    });
  }

  /**
   * Resposta de erro
   */
  static error(res: Response, message: string, statusCode: number = 500) {
    return res.status(statusCode).json({
      code: 1,
      error: message
    });
  }

  /**
   * Resposta de erro com código customizado
   */
  static errorWithCode(res: Response, code: number, message: string, statusCode: number = 500) {
    return res.status(statusCode).json({
      code,
      error: message
    });
  }
}
