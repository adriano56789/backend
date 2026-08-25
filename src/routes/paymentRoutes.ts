import express from 'express';
import payoneerService from '../services/payoneerService';

const router = express.Router();

// ═══ MERCADO PAGO REMOVIDO — LiveGo usa SOMENTE Payoneer ═══
// Este módulo mantinha webhooks/status das compras via Mercado Pago.
// Com a remoção, todas as rotas respondem com estado de transição,
// preservando os contratos de API para o próximo provedor de depósitos.

const paymentsUnavailable = (_req: express.Request, res: express.Response) =>
    res.status(503).json({
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
            configured: payoneerService.isConfigured(),
            environment: payoneerService.getEnvironment(),
            currencies: ['BRL', 'USD', 'EUR'],
            role: 'withdrawals_only',
            note: 'Depósitos serão habilitados quando o novo provedor for definido.',
        },
    });
});

export default router;
