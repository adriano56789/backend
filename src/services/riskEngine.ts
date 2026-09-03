import { Order, User } from '../models';

export const RISK_HOLD_DAYS = 7;
export const MAX_SAFE_PURCHASE_BRL = 500;
export const ACCOUNT_AGE_DAYS = 7;

export interface RiskVerdict {
    risky: boolean;
    holdDays: number;
    holdExpiresAt: Date | null;
    reasons: string[];
    riskScore: number;
}

interface EvaluateInput {
    order: any;
    user: any;
    providerRisk?: {
        flagged?: boolean;
        reasons?: string[];
        riskScore?: number;
    };
    ordersTodayApproved?: number;
}

/**
 * Avalia o risco de uma compra de diamantes.
 *
 * Regras do sistema anti-fraude / chargeback:
 *  - Compra normal  -> liberação instantânea e total.
 *  - Compra suspeita -> diamantes utilizáveis in-app, mas o saque daquela
 *    parte fica retido por até `RISK_HOLD_DAYS` dias, liberando se não houver
 *    chargeback.
 *
 * Sem sinais de risco (provedor em transição) retorna "seguro" — nunca inventa
 * risco onde não há sinal real.
 */
export function evaluatePurchaseRisk(input: EvaluateInput): RiskVerdict {
    const { order, user, providerRisk } = input;
    const reasons: string[] = [];
    let riskScore = 0;

    const amountBrl = parseFloat(String(order?.amount || 0));

    // Sinal explícito do provedor de pagamento (futuro integrador de depósito)
    if (providerRisk?.flagged) {
        riskScore += 70;
        reasons.push(...(providerRisk.reasons || ['Transação sinalizada como risco pelo provedor']));
    }
    if (typeof providerRisk?.riskScore === 'number') {
        riskScore += providerRisk.riskScore;
    }

    // Conta muito nova
    if (user?.createdAt) {
        const ageMs = Date.now() - new Date(user.createdAt).getTime();
        if (ageMs < ACCOUNT_AGE_DAYS * 24 * 60 * 60 * 1000) {
            riskScore += 20;
            reasons.push('Conta criada há menos de 7 dias');
        }
    }

    // Valor alto
    if (amountBrl > MAX_SAFE_PURCHASE_BRL) {
        riskScore += 20;
        reasons.push('Valor acima do limite seguro');
    }

    // Múltiplas compras aprovadas no mesmo dia
    const todayCount = input.ordersTodayApproved ?? 0;
    if (todayCount >= 3) {
        riskScore += 20;
        reasons.push('Múltiplas compras em um curto período');
    }

    const risky = riskScore >= 70;
    const holdExpiresAt = risky ? new Date(Date.now() + RISK_HOLD_DAYS * 24 * 60 * 60 * 1000) : null;

    return {
        risky,
        holdDays: risky ? RISK_HOLD_DAYS : 0,
        holdExpiresAt,
        reasons,
        riskScore,
    };
}

/**
 * Consome diamantes adquiridos em compras de risco (FIFO) do ledger do comprador.
 * Retorna a lista de refs (ordens) consumidos com seus valores — usado para
 * aplicar o hold correspondente no earnings do host que recebe o presente.
 */
export async function consumeRiskDiamonds(fromUserId: string, totalCost: number): Promise<Array<{ ref: string; amount: number }>> {
    const user = await User.findOne({ id: fromUserId });
    if (!user) return [];
    const ledger = (user.risk_ledger || []).filter((l: any) => l.remaining > 0);
    if (ledger.length === 0) return [];

    let toConsume = totalCost;
    let consumed = 0;
    const consumedRefs: Array<{ ref: string; amount: number }> = [];
    const remainingLedger: any[] = [];

    for (const entry of ledger) {
        if (toConsume <= 0) {
            remainingLedger.push(entry);
            continue;
        }
        const take = Math.min(entry.remaining, toConsume);
        entry.remaining -= take;
        consumed += take;
        toConsume -= take;
        if (take > 0) {
            consumedRefs.push({ ref: entry.ref, amount: take });
        }
        if (entry.remaining > 0) {
            remainingLedger.push(entry);
        } else {
            entry.remaining = 0;
        }
    }

    if (consumed > 0) {
        await User.findOneAndUpdate(
            { id: fromUserId },
            {
                $set: { risk_ledger: remainingLedger },
                $inc: { risk_diamonds: -consumed },
            }
        );
    }

    return consumedRefs;
}

/**
 * Aplica um hold (retenção de saque) sobre os earnings de um host.
 * `amount` = porção dos earnings originada de diamantes de compra suspeita.
 * `ref` = identificador da compra/ordem de origem.
 */
export async function applyHostHold(toUserId: string, amount: number, ref: string, expiresAt: Date): Promise<void> {
    if (!amount || amount <= 0) return;
    await User.findOneAndUpdate(
        { id: toUserId },
        {
            $push: {
                risk_holds: {
                    ref,
                    amount,
                    expiresAt,
                    status: 'held',
                    createdAt: new Date(),
                },
            },
            $inc: { earnings_locked: amount },
        }
    );
}

/**
 * Libera holds expirados de um usuário (diminui earnings_locked).
 * Deve ser chamado antes de calcular o saldo sacável.
 */
export async function releaseExpiredHolds(userId: string): Promise<number> {
    const user = await User.findOne({ id: userId });
    if (!user) return 0;
    const now = Date.now();
    const holds = user.risk_holds || [];

    const expired = holds.filter((h: any) => h.status === 'held' && h.expiresAt && new Date(h.expiresAt).getTime() <= now);
    if (expired.length === 0) return 0;

    const releasedAmount = expired.reduce((s: number, h: any) => s + h.amount, 0);

    await User.findOneAndUpdate(
        { id: userId },
        {
            $set: {
                risk_holds: holds.map((h: any) =>
                    h.status === 'held' && h.expiresAt && new Date(h.expiresAt).getTime() <= now
                        ? { ...h, status: 'released' }
                        : h
                ),
            },
            $inc: { earnings_locked: -releasedAmount },
        }
    );

    return releasedAmount;
}

export interface WithdrawableInfo {
    earnings: number;
    earnings_locked: number;
    earnings_debt: number;
    available: number;
    releasedNow: number;
}

/**
 * Varredura global: libera holds vencidos de todos os usuários.
 * Usada em um job periódico para garantir a liberação automática após 7 dias,
 * mesmo sem um saque por parte do host.
 */
export async function releaseAllExpiredHolds(limit = 200): Promise<number> {
    const now = Date.now();
    const users = await User.find({ 'risk_holds.status': 'held' })
        .select('id risk_holds')
        .limit(limit);
    let released = 0;
    for (const u of users) {
        const expired = (u.risk_holds || []).filter(
            (h: any) => h.status === 'held' && h.expiresAt && new Date(h.expiresAt).getTime() <= now
        );
        if (expired.length === 0) continue;
        const amt = expired.reduce((s: number, h: any) => s + (h.amount || 0), 0);
        await User.findOneAndUpdate(
            { id: u.id },
            {
                $set: {
                    risk_holds: (u.risk_holds || []).map((h: any) =>
                        h.status === 'held' && h.expiresAt && new Date(h.expiresAt).getTime() <= now
                            ? { ...h, status: 'released' }
                            : h
                    ),
                },
                $inc: { earnings_locked: -amt },
            }
        );
        released += amt;
    }
    return released;
}

/**
 * Saldo efetivamente sacável após liberar holds vencidos e descontar débitos.
 */
export async function getWithdrawable(userId: string): Promise<WithdrawableInfo> {
    const user = await User.findOne({ id: userId }).select(
        'earnings earnings_locked earnings_debt risk_holds'
    );
    if (!user) {
        return { earnings: 0, earnings_locked: 0, earnings_debt: 0, available: 0, releasedNow: 0 };
    }
    const releasedNow = await releaseExpiredHolds(userId);
    const fresh = await User.findOne({ id: userId }).select('earnings earnings_locked earnings_debt');
    const earnings = fresh?.earnings ?? user.earnings;
    const earnings_locked = fresh?.earnings_locked ?? user.earnings_locked;
    const earnings_debt = fresh?.earnings_debt ?? user.earnings_debt;
    return {
        earnings,
        earnings_locked,
        earnings_debt,
        available: Math.max(0, earnings - earnings_locked - earnings_debt),
        releasedNow,
    };
}
