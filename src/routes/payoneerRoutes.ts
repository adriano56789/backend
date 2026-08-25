import express from 'express';
import { User, PurchaseAuditTrail } from '../models';
import { getIO } from '../socket';
import { protect, AuthRequest } from '../middleware/auth';
import { paymentRateLimit } from '../middleware/rateLimit';
import {
    isConfigured,
    getEnvironment,
    isPlatformConfigured,
    registerRecipient,
    createPayout,
    createPlatformFeePayout,
    getPayoutStatus,
    createDepositSession,
    buildQuote,
    LIVEGO_FEES,
} from '../services/payoneerService';
import { SUPPORTED_CURRENCIES, SupportedCurrency, CURRENCY_SYMBOLS } from '../services/currencyService';

const router = express.Router();

// Métodos de saque aceitos — todos liquidados via Payoneer
const PAYONEER_METHODS: Record<string, { label: string; currency: SupportedCurrency }> = {
    pix: { label: 'Pix (Brasil)', currency: 'BRL' },
    bank_usd: { label: 'Conta bancária internacional', currency: 'USD' },
    bank_eur: { label: 'Conta bancária local (Europa)', currency: 'EUR' },
    payoneer_account: { label: 'Conta Payoneer', currency: 'USD' },
};

/** Status do provedor + taxas transparentes para o criador */
router.get('/status', async (_req, res) => {
        res.json({
            provider: 'payoneer',
            configured: isConfigured(),
            environment: getEnvironment(),
            platform_account_configured: isPlatformConfigured(),
            currencies: SUPPORTED_CURRENCIES,
            methods: PAYONEER_METHODS,
            fees: {
                platform_pct: LIVEGO_FEES.PLATFORM_FEE_PCT * 100,
                payoneer_pct: LIVEGO_FEES.PAYONEER_PCT * 100,
                payoneer_fixed_brl: LIVEGO_FEES.PAYONEER_FIXED_BRL,
                min_diamonds: LIVEGO_FEES.MIN_DIAMONDS,
                note: 'Divisão automática no saque: 80% para o criador, 20% para a plataforma — ambos via Payoneer.',
            },
        });
});

/** Salvar método de saque do criador (Pix / conta USD / conta EUR / conta Payoneer) */
router.post('/method', protect, paymentRateLimit, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Não autenticado' });
        const { method, details } = req.body || {};

        if (!PAYONEER_METHODS[method]) {
            return res.status(400).json({ error: 'Método inválido', allowed: Object.keys(PAYONEER_METHODS) });
        }
        if (!details || typeof details !== 'object') {
            return res.status(400).json({ error: 'Detalhes do método obrigatórios' });
        }

        // Validações mínimas por método (dados que o Payoneer exigirá no payout)
        if (method === 'pix' && !details.pixKey) {
            return res.status(400).json({ error: 'Chave Pix obrigatória' });
        }
        if (method === 'bank_eur' && (!details.iban || !details.accountHolder)) {
            return res.status(400).json({ error: 'IBAN e titular são obrigatórios' });
        }
        if (method === 'bank_usd' && (!details.accountNumber || !details.routingNumber || !details.accountHolder)) {
            return res.status(400).json({ error: 'Conta, agência/ABA e titular são obrigatórios' });
        }
        if (method === 'payoneer_account' && !details.payoneerEmail) {
            return res.status(400).json({ error: 'E-mail da conta Payoneer obrigatório' });
        }

        const updated = await User.findOneAndUpdate(
            { id: userId },
            { $set: { withdrawal_method: { method, details } } },
            { new: true }
        ).select('id withdrawal_method');
        if (!updated) return res.status(404).json({ error: 'Usuário não encontrado' });

        // Quando as credenciais existirem, registra o beneficiário na Payoneer também
        let remoteRegistration: unknown = null;
        if (isConfigured()) {
            const user = await User.findOne({ id: userId }).select('name email');
            remoteRegistration = await registerRecipient({
                userId,
                name: user?.name || '',
                email: user?.email || '',
                payoutMethod: method.toUpperCase(),
                details,
            }).catch((e) => ({ error: e.message }));
        }

        console.log(`[PAYONEER] Método salvo: ${userId} → ${method}`);
        res.json({ success: true, withdrawal_method: updated.withdrawal_method, remoteRegistration });
    } catch (error: any) {
        console.error('[PAYONEER METHOD ERROR]', error.message);
        res.status(500).json({ error: 'Erro ao salvar método de saque' });
    }
});

/** Pré-visualização transparente: bruto → taxas → valor final na moeda escolhida */
router.get('/quote', protect, async (req: AuthRequest, res) => {
    try {
        const amount = parseInt(String(req.query.amount || ''), 10);
        const currency = String(req.query.currency || 'BRL').toUpperCase() as SupportedCurrency;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Quantidade de diamantes inválida' });
        }
        if (!SUPPORTED_CURRENCIES.includes(currency)) {
            return res.status(400).json({ error: `Moeda inválida. Use: ${SUPPORTED_CURRENCIES.join(', ')}` });
        }
        if (amount < LIVEGO_FEES.MIN_DIAMONDS) {
            return res.status(400).json({ error: `Saque mínimo: ${LIVEGO_FEES.MIN_DIAMONDS} diamantes` });
        }

        const quote = await buildQuote(amount, currency);
        res.json({ success: true, symbol: CURRENCY_SYMBOLS[currency], ...quote });
    } catch (error: any) {
        console.error('[PAYONEER QUOTE ERROR]', error.message);
        res.status(500).json({ error: 'Erro ao calcular valores do saque' });
    }
});

/**
 * DEPÓSITOS — toda compra do app (diamantes/presentes/assinaturas) entra
 * pelaqui: cria sessão de pagamento hospedada no Payoneer Checkout.
 * Enquanto as credenciais da empresa não estiverem no .env, responde em transição.
 */
router.post('/deposit/session', protect, paymentRateLimit, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Não autenticado' });

        const amountBRL = Number(req.body?.amountBRL);
        const diamonds = parseInt(String(req.body?.diamonds || ''), 10);
        if (!amountBRL || amountBRL <= 0 || !diamonds || diamonds <= 0) {
            return res.status(400).json({ error: 'amountBRL e diamonds são obrigatórios' });
        }

        const session = await createDepositSession({ userId, amountBRL, diamonds });
        res.json({ success: true, provider: 'payoneer', ...session });
    } catch (error: any) {
        console.error('[PAYONEER DEPOSIT ERROR]', error?.message);
        // Credenciais ausentes → transição; endpoint/parametria a ajustar → surfaced no log
        res.status(503).json({
            error: 'Depósitos em transição',
            details: 'As compras serão processadas pelo Payoneer assim que a conta da empresa for conectada.',
            provider: 'payoneer',
            withdrawals_available: true,
        });
    }
});

/** Solicitar saque — liquidado via Payoneer (Pix BRL / USD / EUR) */router.post('/withdraw', protect, paymentRateLimit, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Não autenticado' });
        const { amount, currency } = req.body || {};

        if (req.user?.id !== req.body?.userId && req.body?.userId && req.body.userId !== userId) {
            return res.status(403).json({ error: 'Acesso negado' });
        }
        const diamonds = parseInt(String(amount), 10);
        if (!diamonds || diamonds <= 0) {
            return res.status(400).json({ error: 'Valor inválido' });
        }
        if (diamonds < LIVEGO_FEES.MIN_DIAMONDS) {
            return res.status(400).json({ error: `Saque mínimo: ${LIVEGO_FEES.MIN_DIAMONDS} diamantes` });
        }

        const curr: SupportedCurrency = (String(currency || 'BRL').toUpperCase() as SupportedCurrency);
        if (!SUPPORTED_CURRENCIES.includes(curr)) {
            return res.status(400).json({ error: `Moeda inválida. Use: ${SUPPORTED_CURRENCIES.join(', ')}` });
        }

        const user = await User.findOne({ id: userId })
            .select('id earnings withdrawal_method name email country');
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

        // Débito atômico: só debita se o saldo for suficiente (evita condição de corrida)
        const debited = await User.findOneAndUpdate(
            { id: userId, earnings: { $gte: diamonds } },
            {
                $inc: { earnings: -diamonds },
                $set: { lastWithdrawalAt: new Date(), lastWithdrawalAmount: diamonds },
                $push: {
                    recentActivities: {
                        $each: [{
                            action: 'withdrawal',
                            resource: 'financial_operation',
                            timestamp: new Date(),
                            endpoint: '/api/payoneer/withdraw',
                        }],
                        $slice: -50,
                    },
                },
            },
            { returnDocument: 'after' }
        );
        if (!debited) {
            return res.status(400).json({
                error: 'Saldo insuficiente',
                details: `Saldo disponível: ${user.earnings} diamantes`,
            });
        }

        // Método precisa estar configurado e compatível com a moeda pedida
        const wm = user.withdrawal_method;
        const expectedMethod = Object.entries(PAYONEER_METHODS).find(([, v]) => v.currency === curr)?.[0];
        if (!wm || !wm.method) {
            await rollbackEarnings(userId, diamonds);
            return res.status(400).json({ error: 'Método de saque não configurado', details: 'Configure seu método de saque antes.' });
        }
        if (expectedMethod && wm.method !== expectedMethod) {
            await rollbackEarnings(userId, diamonds);
            return res.status(400).json({
                error: 'Método incompatível com a moeda',
                details: `Para ${curr}, configure o método "${PAYONEER_METHODS[expectedMethod]?.label}".`,
            });
        }

        // Pré-visualização idêntica à exibida antes da confirmação
        const quote = await buildQuote(diamonds, curr);
        if (quote.net_brl <= 0) {
            await rollbackEarnings(userId, diamonds);
            return res.status(400).json({
                error: 'Valor muito baixo',
                details: 'O valor solicitado não cobre as taxas do Payoneer. Solicite um saque maior.',
            });
        }
        const payoutRef = `livego_po_${userId}_${Date.now()}`;

        // ═══ DIVISÃO AUTOMÁTICA NO ATO DO SAQUE (Payoneer) ═══
        // 80% → conta Payoneer cadastrada PELO CRIADOR (na hora, automático)
        // 20% → conta Payoneer DO DONO da plataforma (na hora, automático)
        let payout: { payoutId: string; status: string } | null = null;
        let platformPayout: { payoutId: string; status: string } | null = null;
        let platformError: string | null = null;
        let status: string = 'queued';
        let statusNote = '';

        if (isConfigured()) {
            // ── Perna 1: 80% do streamer para a conta DELE ──
            try {
                payout = await createPayout({
                    userId,
                    recipientReference: `livego_${userId}`,
                    amountLocal: quote.local_net,
                    currency: curr,
                    description: `LiveGo saque ${diamonds} diamantes (80%) — ${user.name || userId}`,
                });
                console.log(`[PAYONEER] Payout streamer OK: ${payout.payoutId} (${curr} ${quote.local_net})`);
                status = 'processing';
            } catch (e: any) {
                console.error('[PAYONEER STREAMER PAYOUT ERROR]', e?.message);
                status = 'pending_retry';
                statusNote = 'Falha temporária ao enviar ao Payoneer — será reprocessado.';
            }

            // ── Perna 2: 20% da taxa para a conta DO DONO ──
            if (status === 'processing') {
                if (isPlatformConfigured()) {
                    try {
                        platformPayout = await createPlatformFeePayout({
                            amountBRL: quote.platform_fee_brl,
                            description: `LiveGo taxa 20% — streamer ${user.name || userId} · ref ${payoutRef}`,
                        });
                        console.log(`[PAYONEER] Payout plataforma (20%) OK: ${platformPayout.payoutId} (BRL ${quote.platform_fee_brl})`);
                    } catch (e: any) {
                        platformError = e?.message || 'falha ao enviar taxa';
                        console.error('[PAYONEER PLATFORM FEE ERROR]', platformError);
                    }
                } else {
                    platformError = 'Conta Payoneer do dono não configurada (PAYONEER_PLATFORM_EMAIL)';
                    console.warn(`[PAYONEER] ${platformError} — taxa de R$ ${quote.platform_fee_brl.toFixed(2)} registrada na fila`);
                }
            }
        } else {
            statusNote = 'Saque registrado. Divisão 80/20 será enviada ao Payoneer assim que a conta da empresa for conectada.';
        }

        // Auditoria + histórico
        await PurchaseAuditTrail.create({
            eventType: 'diamonds_delivered',
            orderId: payoutRef,
            userId,
            ip: req.ip || '',
            userAgent: (req.headers['user-agent'] || '').slice(0, 300),
            metadata: { diamonds, currency: curr, action: 'payoneer_withdrawal', payoutId: payout?.payoutId },
        }).catch(() => {});

        const PurchaseRecord = (await import('../models')).PurchaseRecord;
        await PurchaseRecord.create({
            id: payoutRef,
            userId,
            type: 'withdrawal',
            description: `Saque Payoneer (${curr}) — ${CURRENCY_SYMBOLS[curr]} ${quote.local_net.toFixed(2)} · ${diamonds} diamantes`,
            amountBRL: -quote.net_brl,
            amountCoins: diamonds,
            status: status === 'processing' ? 'Processando' : 'Pendente',
            metadata: {
                payoutRef,
                payoutId: payout?.payoutId || null,
                provider: 'payoneer',
                currency: curr,
                local_net: quote.local_net,
                net_brl: quote.net_brl,
                gross_brl: quote.gross_brl,
                platform_fee_brl: quote.platform_fee_brl,
                payoneer_fee_brl: quote.payoneer_fee_brl,
                method: wm.method,
                commissionType: 'streamer_payment',
                // Divisão automática 80/20 executada no ato do saque
                split: {
                    streamer_pct: 80,
                    streamer_payout_id: payout?.payoutId || null,
                    streamer_amount_local: quote.local_net,
                    platform_pct: 20,
                    platform_payout_id: platformPayout?.payoutId || null,
                    platform_amount_brl: quote.platform_fee_brl,
                    platform_status: platformPayout ? (platformPayout.status || 'sent') : (platformError || 'queued'),
                },
            },
        });
        await PurchaseRecord.create({
            id: `${payoutRef}_app`,
            userId: 'system_app',
            type: 'commission',
            description: `Comissão do app (${LIVEGO_FEES.PLATFORM_FEE_PCT * 100}%) — Streamer: ${user.name || userId}`,
            amountBRL: quote.platform_fee_brl,
            amountCoins: 0,
            status: platformPayout ? 'Concluído' : 'Pendente',
            metadata: {
                streamerId: userId,
                streamerName: user.name,
                payoutRef,
                percentage: 20,
                platformPayoutId: platformPayout?.payoutId || null,
                platformNote: platformError || undefined,
            },
        });

        const io = getIO();
        if (io) {
            io.to(userId).emit('withdrawal_processed', {
                userId,
                totalAmount: diamonds,
                streamerAmount: quote.local_net,
                appCommission: quote.platform_fee_brl,
                currency: curr,
                provider: 'payoneer',
                newBalance: debited.earnings,
                withdrawalId: payoutRef,
                streamerPayoutId: payout?.payoutId || null,
                platformPayoutId: platformPayout?.payoutId || null,
                status,
            });
            io.to(userId).emit('earnings_updated', {
                userId,
                available_diamonds: 0,
                brl_value: debited.earnings,
            });
        }

        res.json({
            success: true,
            withdrawalId: payoutRef,
            payoutId: payout?.payoutId || null,
            platformPayoutId: platformPayout?.payoutId || null,
            provider: 'payoneer',
            status,
            statusNote,
            currency: curr,
            quote,
            newBalance: debited.earnings,
            message: status === 'processing'
                ? `Saque enviado ao Payoneer! ${CURRENCY_SYMBOLS[curr]} ${quote.local_net.toFixed(2)} para sua conta (80%) + taxa de R$ ${quote.platform_fee_brl.toFixed(2)} para a plataforma (20%) — tudo automático.`
                : `Saque de ${CURRENCY_SYMBOLS[curr]} ${quote.local_net.toFixed(2)} registrado${statusNote ? ` — ${statusNote}` : ''}`,
        });
    } catch (error: any) {
        console.error('[PAYONEER WITHDRAW ERROR]', error);
        res.status(500).json({ error: 'Erro interno ao processar saque', message: 'Tente novamente em instantes.' });
    }
});

async function rollbackEarnings(userId: string, diamonds: number) {
    await User.updateOne({ id: userId }, { $inc: { earnings: diamonds } }).catch(() => {});
}

export default router;
