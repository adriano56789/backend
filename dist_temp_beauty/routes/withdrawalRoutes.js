"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const models_1 = require("../models");
const payoneerService_1 = __importDefault(require("../services/payoneerService"));
const router = express_1.default.Router();
// ═══ MERCADO PAGO REMOVIDO — saques agora são liquidados SOMENTE via Payoneer ═══
// Novo fluxo completo: POST /api/payoneer/withdraw (Pix BRL / conta USD / conta EUR)
const movedHandler = (_req, res) => res.status(410).json({
    gone: true,
    reason: 'Mercado Pago removido. Use o novo endpoint de saques Payoneer.',
    newEndpoint: '/api/payoneer/withdraw',
    methods: ['pix (BRL)', 'bank_usd', 'bank_eur', 'payoneer_account'],
});
router.post('/pix', movedHandler);
router.post('/bank', movedHandler);
// Status de um payout no Payoneer
router.get('/status/:transferId', async (req, res) => {
    try {
        if (!payoneerService_1.default.isConfigured()) {
            return res.status(200).json({
                success: true,
                status: 'queued',
                message: 'Payoneer ainda não conectado — saque na fila de processamento.',
            });
        }
        const payout = await payoneerService_1.default.getPayoutStatus(req.params.transferId);
        res.json({ success: true, transfer: payout });
    }
    catch (error) {
        console.error('[WITHDRAWAL STATUS ERROR]', error.message);
        res.status(502).json({ error: 'Erro ao consultar status no Payoneer' });
    }
});
// Histórico de saques do usuário (agnóstico de provedor)
router.get('/history/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 10, offset = 0 } = req.query;
        const withdrawals = await models_1.PurchaseRecord.find({
            userId: userId,
            type: 'withdrawal'
        })
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(offset));
        const total = await models_1.PurchaseRecord.countDocuments({
            userId: userId,
            type: 'withdrawal'
        });
        res.json({
            success: true,
            withdrawals,
            total,
            hasMore: (parseInt(offset) + withdrawals.length) < total
        });
    }
    catch (error) {
        console.error('[WITHDRAWAL HISTORY ERROR] Erro ao buscar histórico:', error);
        res.status(500).json({
            error: 'Erro ao buscar histórico',
            message: 'Não foi possível carregar o histórico de saques'
        });
    }
});
exports.default = router;
