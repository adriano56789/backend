"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const models_1 = require("../models");
const router = express_1.default.Router();
// GET /api/manual-transmissao - Buscar manual completo
router.get('/manual-transmissao', async (req, res) => {
    try {
        console.log('🔍 [MANUAL_API] Requisição recebida para /manual-transmissao');
        console.log('📋 [MANUAL_API] Headers:', req.headers);
        console.log('🌐 [MANUAL_API] IP:', req.ip);
        // Persistir atividade de acesso ao manual (se userId estiver disponível)
        const userId = req.headers['user-id'] || req.query.userId;
        if (userId) {
            await models_1.User.findOneAndUpdate({ id: userId }, {
                $push: { recentActivities: { $each: [{
                                action: 'manual_accessed',
                                resource: 'documentation',
                                timestamp: new Date(),
                                endpoint: '/api/manual-transmissao'
                            }], $slice: -50 } }
            }).catch(console.error);
        }
        // Buscar manual mais recente
        const manual = await models_1.ManualTransmissao.findOne({}).sort({ createdAt: -1 });
        if (!manual) {
            console.log('❌ [MANUAL_API] Nenhum manual encontrado');
            return res.status(404).json({
                error: 'Manual não encontrado',
                message: 'Nenhum manual de transmissão está disponível no momento.'
            });
        }
        console.log('✅ [MANUAL_API] Manual encontrado:', manual.titulo);
        console.log('📚 [MANUAL_API] Seções:', manual.secoes.length);
        // Estrutura de resposta esperada pelo frontend
        const responseData = {
            success: true,
            data: {
                titulo: manual.titulo,
                secoes: manual.secoes
            }
        };
        console.log('📤 [MANUAL_API] Enviando manual com', manual.secoes.length, 'seções');
        res.json(responseData);
    }
    catch (error) {
        console.error('❌ [MANUAL_API] Erro ao buscar manual:', error);
        res.status(500).json({
            error: error.message,
            message: 'Erro interno ao buscar manual de transmissão'
        });
    }
});
exports.default = router;
