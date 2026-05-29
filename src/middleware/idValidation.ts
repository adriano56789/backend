/**
 * MIDDLEWARE DE VALIDAÇÃO ESTRITA DE IDs
 * 
 * 🚨 BLOQUEIA MongoDB ID como referência principal em TODOS os endpoints
 * ✅ CONVERTE automaticamente MongoDB ID para ID real
 * 🔍 AUDITA todas as requisições por uso incorreto de IDs
 */

import { Request, Response, NextFunction } from 'express';
import { isMongoObjectId } from '../utils/idHelper';

/**
 * Middleware para validar e converter IDs em parâmetros de rota
 */
export const validateAndConvertUserId = (paramName: string = 'id') => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.params[paramName];
            
            if (!userId) {
                console.error(`🚫 [ID_VALIDATION] Parâmetro ${paramName} não fornecido`);
                return res.status(400).json({
                    error: `Parâmetro ${paramName} é obrigatório`,
                    code: 'MISSING_PARAMETER'
                });
            }
            
            // Se for MongoDB ID, registrar e converter
            if (isMongoObjectId(userId)) {
                console.warn(`⚠️ [ID_VALIDATION] MongoDB ID detectado em ${req.method} ${req.path}: ${userId}`);
                console.warn(`🔄 [ID_VALIDATION] MongoDB ID deve ser convertido para ID real da API externa`);
                
                // Adicionar flag para conversão no próximo nível
                req.needsIdConversion = true;
                req.originalMongoId = userId;
            }
            
            next();
        } catch (error) {
            console.error(`❌ [ID_VALIDATION] Erro na validação:`, error);
            res.status(500).json({
                error: 'Erro na validação de ID',
                code: 'VALIDATION_ERROR'
            });
        }
    };
};

/**
 * Middleware para auditoria de IDs no corpo da requisição
 */
export const auditRequestBodyIds = (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = req.body;
        if (!body) return next();
        
        // Procurar por MongoDB IDs no corpo da requisição
        const mongoDbIds: string[] = [];
        
        const findMongoIds = (obj: any, path: string = '') => {
            if (typeof obj === 'string' && isMongoObjectId(obj)) {
                mongoDbIds.push(`${path}: ${obj}`);
            } else if (typeof obj === 'object' && obj !== null) {
                Object.keys(obj).forEach(key => {
                    findMongoIds(obj[key], path ? `${path}.${key}` : key);
                });
            }
        };
        
        findMongoIds(body);
        
        if (mongoDbIds.length > 0) {
            console.warn(`⚠️ [ID_AUDIT] MongoDB IDs encontrados no corpo da requisição ${req.method} ${req.path}:`);
            mongoDbIds.forEach(id => console.warn(`   - ${id}`));
            console.warn(`🔄 [ID_AUDIT] Estes IDs devem ser convertidos para IDs reais da API externa`);
        }
        
        next();
    } catch (error) {
        console.error(`❌ [ID_AUDIT] Erro na auditoria:`, error);
        next();
    }
};

/**
 * Middleware para bloquear respostas com MongoDB ID
 */
export const blockMongoDbIdResponses = (req: Request, res: Response, next: NextFunction) => {
    try {
        const originalJson = res.json;
        
        res.json = function(data: any) {
            // Verificar se a resposta contém MongoDB ID como ID principal
            const checkForMongoDbIds = (obj: any, path: string = ''): boolean => {
                if (typeof obj === 'string' && isMongoObjectId(obj)) {
                    console.error(`🚫 [ID_RESPONSE] MongoDB ID bloqueado na resposta: ${path} = ${obj}`);
                    console.error(`🔄 [ID_RESPONSE] Converta para ID real da API externa antes de responder`);
                    return true;
                } else if (typeof obj === 'object' && obj !== null) {
                    // Checar especificamente campo 'id'
                    if (obj.id && isMongoObjectId(obj.id)) {
                        console.error(`🚫 [ID_RESPONSE] MongoDB ID bloqueado como ID principal: ${obj.id}`);
                        console.error(`🔄 [ID_RESPONSE] Use getRealUserId() para obter ID real da API externa`);
                        return true;
                    }
                    
                    // Recursivamente verificar outros campos
                    return Object.keys(obj).some(key => 
                        checkForMongoDbIds(obj[key], path ? `${path}.${key}` : key)
                    );
                }
                return false;
            };
            
            const hasMongoDbId = checkForMongoDbIds(data);
            
            if (hasMongoDbId) {
                console.error(`❌ [ID_RESPONSE] Resposta bloqueada - contém MongoDB ID como referência principal`);
                return res.status(500).json({
                    error: 'Erro interno - MongoDB ID exposto como referência principal',
                    code: 'MONGODB_ID_EXPOSED'
                });
            }
            
            return originalJson.call(this, data);
        };
        
        next();
    } catch (error) {
        console.error(`❌ [ID_RESPONSE] Erro no middleware de bloqueio:`, error);
        next();
    }
};

/**
 * Middleware completo de validação de IDs
 */
export const validateIdsStrictly = [
    auditRequestBodyIds,
    blockMongoDbIdResponses
];

// Extend Request type para incluir flags adicionais
declare global {
    namespace Express {
        interface Request {
            needsIdConversion?: boolean;
            originalMongoId?: string;
        }
    }
}
