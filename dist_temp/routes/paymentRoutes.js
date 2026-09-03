"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const payoneerService_1 = __importDefault(require("../services/payoneerService"));
const router = express_1.default.Router();
// ═══ MERCADO PAGO REMOVIDO — LiveGo usa SOMENTE Payoneer ═══
// Este módulo mantinha webhooks/status das compras via Mercado Pago.
// Com a remoção, todas as rotas respondem com estado de transição,
// preservando os contratos de API para o próximo provedor de depósitos.
const paymentsUnavailable = (_req, res) => res.status(503).json({
    error: 'Pagamentos em transição',
    details: 'O Mercado Pago foi desativado. Depósitos retornarão em breve com o novo provedor.',
    provider: 'payoneer',
    provider_role: 'withdrawals_only',
    withdrawals_endpoint: '/api/payoneer/withdraw',
});
router.post('/webhook/purchase', paymentsUnavailable);
router.get('/pix/status/:orderId', paymentsUnavailable);
router.get('/status/:paymentId', paymentsUnavailable);
router.post('/refund/:paymentId', paymentsUnavailable);
// Configuração atual do provedor de pagamentos
router.get('/config', async (_req, res) => {
    res.json({
        mercadoPago: { removed: true },
        payoneer: {
            active: true,
            configured: payoneerService_1.default.isConfigured(),
            environment: payoneerService_1.default.getEnvironment(),
            currencies: ['BRL', 'USD', 'EUR'],
            role: 'withdrawals_only',
            note: 'Depósitos serão habilitados quando o novo provedor for definido.',
        },
    });
});
exports.default = router;
