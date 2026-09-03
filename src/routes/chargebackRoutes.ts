import express from 'express';
import { processChargeback } from '../services/chargebackService';
import { getWithdrawable } from '../services/riskEngine';
import { User } from '../models';

const router = express.Router();

/**
 * Admin: estornar por FRAUDE COMPROVADA.
 * POST /api/fraud/chargeback  { orderId, reason? }
 *
 * Somente chargeback por fraude comprovada é aceito (arrependimento NÃO).
 * Autenticação administrativa via header `admin-user-id` (padrão dos demais
 * endpoints de gestão de fraude).
 */
router.post('/chargeback', async (req: express.Request, res: express.Response) => {
    try {
        const { orderId, reason } = req.body || {};
        if (!orderId) {
            return res.status(400).json({ error: 'orderId é obrigatório' });
        }

        const byUser = (req.headers['admin-user-id'] as string) || 'system';
        const result = await processChargeback({ orderId, reason, byUser });

        res.json({ success: true, ...result });
    } catch (error: any) {
        console.error('[CHARGEBACK ERROR]', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Consulta o saldo sacável (após retenções e débitos) de um usuário.
 * GET /api/fraud/chargeback/withdrawable/:userId
 */
router.get('/chargeback/withdrawable/:userId', async (req: express.Request, res: express.Response) => {
    try {
        const info = await getWithdrawable(req.params.userId);
        const user = await User.findOne({ id: req.params.userId }).select('id name earnings');
        res.json({ success: true, user, ...info });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
