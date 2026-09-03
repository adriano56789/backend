import express from 'express';
import { Order, User, EstornoRequest, PurchaseRecord } from '../models';
import { protect, AuthRequest } from '../middleware/auth';
import { paymentRateLimit } from '../middleware/rateLimit';
import { applyEstornoHolds, processEstornoDecision, CHARGEBACK_HOLD_DAYS } from '../services/chargebackService';

// Fallback de extração: PurchaseRecord.id tem o formato `purchase_<orderId>_<timestamp>`.
function configExtractOrder(purchaseId: string): string | null {
    const idx = purchaseId.lastIndexOf('_');
    if (purchaseId.startsWith('purchase_') && idx > 'purchase_'.length) {
        const orderId = purchaseId.slice('purchase_'.length, idx);
        if (orderId.startsWith('ord_')) return orderId;
    }
    return null;
}

export const ESTORNO_REASON_CODES: Record<string, string> = {
    unauthorized_transaction: 'Transação não autorizada (cartão clonado / terceiro)',
    card_fraud: 'Fraude de cartão',
    goods_not_received: 'Não recebi os diamantes que paguei',
    service_not_received: 'Serviço não prestado conforme o combinado',
    duplicate_charge: 'Cobrança duplicada',
    other: 'Outro motivo (descreva abaixo)',
};

const router = express.Router();

/** Lista de motivos (causa) para solicitar estorno */
router.get('/reasons', (_req, res) => res.json({ success: true, reasons: ESTORNO_REASON_CODES, holdDays: CHARGEBACK_HOLD_DAYS }));

/**
 * Comprador solicita ESTORNO de uma compra de diamantes.
 * POST /api/estorno/request
 * body: { orderId, reasonCode, reasonDetail? }
 *
 * Ao solicitar, o valor correspondente fica BLOQUEADO na carteira da host
 * por até 7 dias enquanto o banco confirma com a plataforma.
 */
router.post('/request', protect, paymentRateLimit, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Não autenticado' });

        const { orderId, purchaseId, reasonCode, reasonDetail } = req.body || {};

        let resolvedOrderId = orderId;
        if (!resolvedOrderId && purchaseId) {
            const pr = await PurchaseRecord.findOne({ id: purchaseId });
            resolvedOrderId = pr?.metadata?.orderId || (configExtractOrder(purchaseId));
        }
        if (!resolvedOrderId || !reasonCode) {
            return res.status(400).json({ error: 'orderId (ou purchaseId) e reasonCode são obrigatórios' });
        }
        if (!ESTORNO_REASON_CODES[reasonCode]) {
            return res.status(400).json({ error: 'Motivo inválido', allowed: Object.keys(ESTORNO_REASON_CODES) });
        }

        const order = await Order.findOne({ id: resolvedOrderId });
        if (!order) return res.status(404).json({ error: 'Compra não encontrada' });
        if (order.userId !== userId) return res.status(403).json({ error: 'Esta compra não pertence ao seu usuário' });
        if (order.status !== 'paid') {
            return res.status(400).json({ error: 'Só é possível solicitar estorno de compras confirmadas/pagas' });
        }

        // Evitar estorno duplicado em andamento
        const existing = await EstornoRequest.findOne({
            targetId: resolvedOrderId,
            status: { $in: ['requested', 'pending_review'] },
        });
        if (existing) {
            return res.json({
                success: true,
                message: 'Já existe um estorno em análise para esta compra',
                estorno: existing,
                holdDays: CHARGEBACK_HOLD_DAYS,
            });
        }

        const requestedByName = (await User.findOne({ id: userId }).select('name'))?.name || '';

        // 1. Criar o registro do estorno
        const estorno = await EstornoRequest.create({
            id: `est_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            requestedById: userId,
            requestedByName,
            targetType: 'order',
            targetId: order.id,
            targetDescription: `Compra de ${order.diamonds} diamantes (R$${order.amount})`,
            reasonCode,
            reasonDetail: reasonDetail || '',
            amountCoins: order.diamonds,
            amountBRL: order.amount,
            status: 'pending_review',
            underReviewUntil: new Date(Date.now() + CHARGEBACK_HOLD_DAYS * 24 * 60 * 60 * 1000),
        });

        // 2. Bloquear o valor correspondente na carteira da(s) host(s) por 7 dias
        const held = await applyEstornoHolds(order.id, order.diamonds).catch((e: any) => {
            console.warn('[ESTORNO] Falha ao aplicar hold:', e?.message);
            return 0;
        });

        res.json({
            success: true,
            estorno,
            held,
            holdDays: CHARGEBACK_HOLD_DAYS,
            note: 'Valor bloqueado na carteira da host por até 7 dias enquanto o banco confirma.',
        });
    } catch (error: any) {
        console.error('[ESTORNO REQUEST ERROR]', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Admin/Plataforma decide o estorno.
 * POST /api/estorno/review
 * body: { estornoId, fraudConfirmed: boolean, reviewNote?, hostProvedLie?: boolean, evidence? }
 *  - fraudConfirmed=true          -> FRAUDE REAL: debita da host / cobra dos ganhos futuros, valor à plataforma.
 *  - fraudConfirmed=false         -> NÃO é fraude: libera, sempre sem devolução.
 *  - fraudConfirmed=false + hostProvedLie=true -> a host comprovou que o usuário MENTIU:
 *    o sistema BANE a conta do solicitante PERMANENTEMENTE, de forma automática.
 */
router.post('/review', async (req: express.Request, res: express.Response) => {
    try {
        const { estornoId, fraudConfirmed, reviewNote, hostProvedLie, userScam, evidence } = req.body || {};
        if (!estornoId) return res.status(400).json({ error: 'estornoId é obrigatório' });
        if (typeof fraudConfirmed !== 'boolean') {
            return res.status(400).json({ error: 'fraudConfirmed (boolean) é obrigatório' });
        }

        const provedLie = !!(hostProvedLie ?? userScam);

        const reviewedBy = (req.headers['admin-user-id'] as string) || 'system';
        const result = await processEstornoDecision({
            estornoRequestId: estornoId,
            fraudConfirmed,
            reviewNote,
            reviewedBy,
            hostProvedLie: !fraudConfirmed ? provedLie : undefined,
            banContext: {
                ip: req.ip || (req as any).connection?.remoteAddress || '',
                deviceFingerprint: (req.headers['x-device-fingerprint'] as string) || '',
            },
            banEvidence: evidence || { hostProvedLie: provedLie, timestamp: new Date() },
        });

        res.json({
            success: true,
            decided: fraudConfirmed ? 'refunded' : 'rejected',
            bannedUser: !!result.bannedUserId,
            message: fraudConfirmed
                ? 'Fraude comprovada. Valor debitado da host (ou programado para cobrança dos ganhos futuros) e à disposição da plataforma para estornar ao banco.'
                : (result.bannedUserId
                    ? 'Não é fraude e a host comprovou a mentira: conta do solicitante banida PERMANENTEMENTE, valor liberado, sem devolução.'
                    : 'Não é fraude. Valor liberado na carteira da host, sem devolução.'),
            ...result,
        });
    } catch (error: any) {
        console.error('[ESTORNO REVIEW ERROR]', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Status do estorno de uma compra (para o comprador acompanhar).
 * GET /api/estorno/status/:orderId
 */
router.get('/status/:orderId', async (req: express.Request, res: express.Response) => {
    try {
        const estorno = await EstornoRequest.findOne({ targetId: req.params.orderId })
            .sort({ createdAt: -1 })
            .lean();
        res.json({ success: true, estorno });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;