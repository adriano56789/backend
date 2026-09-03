import { User, Order, EstornoRequest, PurchaseAuditTrail } from '../models';
import { applyHostHold, releaseExpiredHolds } from './riskEngine';
import FraudDetectionMiddleware from '../middleware/fraudDetection';

export const CHARGEBACK_HOLD_DAYS = 7;

export interface ChargebackResult {
    orderId: string;
    processed: Array<{
        userId: string;
        debited: number;
        debt: number;
        fromHolds: number;
    }>;
    totalDebited: number;
    totalDebt: number;
    totalRecovered: number;
    bannedUserId?: string;
}

/**
 * Encontra os hosts cujos earnings foram alimentados por uma determinada
 * compra/order (via risk_holds referenciando a order).
 */
export async function findHostsByOrder(orderId: string): Promise<any[]> {
    return User.find({ 'risk_holds.ref': orderId });
}

/**
 * Passo 1 do fluxo de estorno: quando alguém pede estorno, o valor
 * correspondente fica BLOQUEADO na carteira da host por até 7 dias,
 * enquanto o banco confirma com a plataforma.
 *
 * Re-aplica um hold 'held' de 7 dias em cada host afetado pela order,
 * mesmo que o hold anterior já tivesse sido liberado (para congelar o valor
 * durante a janela de análise do estorno).
 */
export async function applyEstornoHolds(orderId: string, amountCoins: number): Promise<number> {
    const now = new Date();
    const expiresAt = new Date(Date.now() + CHARGEBACK_HOLD_DAYS * 24 * 60 * 60 * 1000);
    const hosts = await findHostsByOrder(orderId);

    let totalHeld = 0;

    for (const host of hosts) {
        const holds = host.risk_holds || [];
        // Valor já sob análise para esta order (holds ativos)
        const activeHeld = holds
            .filter((h: any) => h.ref === orderId && h.status === 'held')
            .reduce((s: number, h: any) => s + (h.amount || 0), 0);

        // Precisa segurar a diferença até o valor total da compra
        const toHold = Math.max(0, Math.min(amountCoins, amountCoins - activeHeld));
        if (toHold > 0) {
            await applyHostHold(host.id, toHold, orderId, expiresAt);
            totalHeld += toHold;
        }

        // Reforçar: garantir expiração dentro da janela do estorno
        await User.findOneAndUpdate(
            { id: host.id, 'risk_holds.ref': orderId, 'risk_holds.status': 'held' },
            {
                $set: {
                    'risk_holds.$.expiresAt': expiresAt,
                },
            }
        ).catch(() => {});
    }

    return totalHeld;
}

/**
 * Passo 2: decisão do estorno.
 *
 *  - fraudConfirmed = true  -> FRAUDE COMPROVADA: debita da carteira da host
 *    (ou fica como débito para ser descontado dos ganhos futuros até quitar,
 *    quando ela já tiver sacado), e o valor recuperado fica à disposição da
 *    plataforma para estornar ao banco.
 *  - fraudConfirmed = false -> NÃO é fraude: libera o valor, SEM devolução.
 */
export async function processEstornoDecision(input: {
    estornoRequestId: string;
    fraudConfirmed: boolean;
    reviewNote?: string;
    reviewedBy?: string;
    hostProvedLie?: boolean;
    banContext?: { ip?: string; deviceFingerprint?: string };
    banEvidence?: any;
}): Promise<ChargebackResult> {
    const estorno = await EstornoRequest.findOne({ id: input.estornoRequestId });
    if (!estorno) {
        throw new Error('Estorno não encontrado');
    }
    if (estorno.status === 'refunded' || estorno.status === 'rejected') {
        throw new Error('Estorno já decidido');
    }

    const hostCount = await User.countDocuments({ 'risk_holds.ref': estorno.targetId, 'risk_holds.status': 'held' });

    if (!input.fraudConfirmed) {
        // NÃO é fraude -> libera o hold, sem devolução.
        await releaseEstornoHolds(estorno.targetId);

        // ⚠️ Se a host comprovou que o usuário MENTIU (tentou golpe de estorno),
        // o sistema bane a conta do solicitante PERMANENTEMENTE — automático, sem
        // volta. Nenhuma devolução é feita.
        let bannedUserId: string | undefined;
        let banNote = input.reviewNote || 'Não comprovado como fraude — valor liberado, sem devolução.';
        if (input.hostProvedLie) {
            bannedUserId = await autoBanLyingRequester(
                estorno.requestedById,
                input.reviewNote || 'Falso estorno: usuário mentiu para tentar recuperar dinheiro injustamente (host comprovou o cumprimento do combinado).',
                input.banContext,
                input.banEvidence,
            );
            banNote = `Usuário baniu por FALSO ESTORNO (host comprovou a mentira). Valor liberado, sem devolução. Banimento permanente.`;
        }

        await EstornoRequest.findOneAndUpdate(
            { id: input.estornoRequestId },
            {
                $set: {
                    status: 'rejected',
                    fraudConfirmed: false,
                    reviewNote: banNote,
                    reviewedAt: new Date(),
                    reviewedBy: input.reviewedBy || 'system',
                    userBanned: !!bannedUserId,
                },
            },
            { returnDocument: 'after' }
        );
        return { orderId: estorno.targetId, processed: [], totalDebited: 0, totalDebt: 0, totalRecovered: 0, bannedUserId };
    }

    // FRAUDE COMPROVADA: debita dos hosts afetados.
    const { processed, totalDebited, totalDebt } = await executeHostDebit(estorno.targetId);

    const totalRecovered = totalDebited; // debitado agora da carteira
    // O remainder (totalDebt) será recuperado automaticamente dos ganhos futuros.

    await EstornoRequest.findOneAndUpdate(
        { id: input.estornoRequestId },
        {
            $set: {
                status: 'refunded',
                fraudConfirmed: true,
                reviewNote: input.reviewNote || `Fraude comprovada. Recuperado: ${totalRecovered} · a recuperar de ganhos futuros: ${totalDebt}`,
                reviewedAt: new Date(),
                reviewedBy: input.reviewedBy || 'system',
                refundedAt: new Date(),
                recovered: totalRecovered,
            },
        },
        { returnDocument: 'after' }
    );

    return { orderId: estorno.targetId, processed, totalDebited, totalDebt, totalRecovered };
}

/**
 * Debita o valor da fraude da carteira de cada host afetado.
 * Se o host já sacou (ou não tem saldo), o valor vai para `earnings_debt`:
 * o sistema monitora a conta e desconta automaticamente de cada novo ganho
 * até quitar o valor total da fraude; e o saque fica bloqueado até então.
 */
async function executeHostDebit(orderId: string): Promise<{ processed: ChargebackResult['processed']; totalDebited: number; totalDebt: number }> {
    const hosts = await findHostsByOrder(orderId);
    const processed: ChargebackResult['processed'] = [];
    let totalDebited = 0;
    let totalDebt = 0;

    for (const host of hosts) {
        const holds = (host.risk_holds || []).filter(
            (h: any) => h.ref === orderId && h.status === 'held'
        );
        const holdsAmount = holds.reduce((s: number, h: any) => s + (h.amount || 0), 0);
        if (holdsAmount <= 0) continue;

        // Reverter a retenção
        const remainingHolds = (host.risk_holds || []).map((h: any) =>
            h.ref === orderId && h.status === 'held' ? { ...h, status: 'charged_back' } : h
        );
        const lockedAfter = (host.earnings_locked || 0) - holdsAmount;

        const withdrawableAt = (host.earnings || 0) - Math.max(0, lockedAfter) - (host.earnings_debt || 0);
        const toDebit = Math.min(holdsAmount, Math.max(0, withdrawableAt));
        const shortfall = holdsAmount - toDebit;

        await User.findOneAndUpdate(
            { id: host.id },
            {
                $set: { risk_holds: remainingHolds, earnings_locked: Math.max(0, lockedAfter) },
                $inc: { earnings: -toDebit, earnings_debt: shortfall },
            }
        );

        totalDebited += toDebit;
        totalDebt += shortfall;
        processed.push({ userId: host.id, debited: toDebit, debt: shortfall, fromHolds: holdsAmount });
    }

    return { processed, totalDebited, totalDebt };
}

/**
 * Libera o bloqueio (hold) de uma order — usado quando o estorno é rejeitado
 * (não é fraude). Nenhuma devolução é feita.
 */
export async function releaseEstornoHolds(orderId: string): Promise<number> {
    const hosts = await findHostsByOrder(orderId);
    let released = 0;
    for (const host of hosts) {
        const now = Date.now();
        const held = (host.risk_holds || []).filter(
            (h: any) => h.ref === orderId && h.status === 'held'
        );
        const amount = held.reduce((s: number, h: any) => s + (h.amount || 0), 0);
        if (amount <= 0) continue;

        await User.findOneAndUpdate(
            { id: host.id },
            {
                $set: {
                    risk_holds: (host.risk_holds || []).map((h: any) =>
                        h.ref === orderId && h.status === 'held' ? { ...h, status: 'released' } : h
                    ),
                },
                $inc: { earnings_locked: -amount },
            }
        );
        released += amount;
    }
    return released;
}

/**
 * [Compat] Processa um chargeback por fraude (sem registro de estorno prévio).
 */
export async function processChargeback(input: {
    orderId: string;
    reason?: string;
    amountCoins?: number;
    byUser?: string;
}): Promise<ChargebackResult> {
    const { orderId } = input;

    const order = await Order.findOne({ id: orderId });
    if (order && order.status !== 'charged_back') {
        await Order.findOneAndUpdate({ id: orderId }, { $set: { status: 'charged_back', chargedBackAt: new Date() } });
    }

    const { processed, totalDebited, totalDebt } = await executeHostDebit(orderId);

    await PurchaseAuditTrail.create({
        eventType: 'refund',
        orderId,
        userId: input.byUser || 'system',
        ip: '',
        userAgent: 'chargeback-service',
        metadata: {
            reason: input.reason || 'fraud_chargeback',
            processed,
            totalDebited,
            totalDebt,
            timestamp: new Date(),
        },
    }).catch(() => {});

    return { orderId, processed, totalDebited, totalDebt, totalRecovered: totalDebited };
}

/**
 * BANIMENTO AUTOMÁTICO por FALSO ESTORNO.
 * Quando a host comprova que o solicitante mentiu para recuperar dinheiro
 * injustamente, o sistema bloqueia a conta dele PERMANENTEMENTE — sem volta e
 * sem precisar de intervenção manual. Banindo usuário + email + dispositivo +
 * IP, ele não consegue mais entrar no app.
 */
async function autoBanLyingRequester(
    userId: string,
    reason: string,
    context?: { ip?: string; deviceFingerprint?: string },
    evidence?: any
): Promise<string> {
    let email = '';
    try {
        const user = await User.findOne({ id: userId }).select('email name');
        email = user?.email || '';
    } catch (_) { /* segue com ban do usuário mesmo sem email */ }

    try {
        await FraudDetectionMiddleware.banRelatedEntities(
            context?.ip || '',
            context?.deviceFingerprint || '',
            userId,
            email,
            reason,
            evidence || {
                type: 'fake_estorno',
                userId,
                timestamp: new Date(),
            }
        );
    } catch (error: any) {
        console.error(`[ESTORNO-BAN] Falha no banimento completo, tentando só o usuário:`, error?.message);
        await FraudDetectionMiddleware.banEntity('user', userId, reason, evidence || {}, true);
    }

    console.log(`🚫 [ESTORNO-BAN] Usuário ${userId} banido PERMANENTEMENTE por falso estorno.`);
    return userId;
}
