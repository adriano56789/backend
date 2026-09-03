import { Order, User, PurchaseRecord, PurchaseAuditTrail } from '../models';
import { getIO } from '../socket';
import { evaluatePurchaseRisk } from './riskEngine';

/**
 * Confirma uma compra de diamantes e credita no usuário.
 * Compartilhado entre o retorno do checkout Payoneer e o webhook, para que a
 * lógica (anti-fraude + xp + histórico) seja única. Idempotente.
 */
export async function completeOrderPayment(params: {
    orderId: string;
    paymentConfirmationId: string;
    ip?: string;
    userAgent?: string;
    paymentRisk?: any;
    paymentMethod?: string;
}): Promise<{ success: boolean; user?: any; order?: any; message?: string }> {
    const { orderId, paymentConfirmationId } = params;

    const order = await Order.findOne({ id: orderId });
    if (!order) {
        return { success: false, message: 'Order not found' };
    }

    const userId = order.userId;

    if (order.status === 'paid') {
        return { success: true, message: 'Compra já confirmada anteriormente', order };
    }
    if (order.status !== 'pending') {
        return { success: false, message: 'Status da order não permite confirmação' };
    }

    const updatedOrder = await Order.findOneAndUpdate(
        { id: orderId },
        {
            $set: {
                status: 'paid',
                paymentConfirmationId,
                confirmedAt: new Date(),
            },
        },
        { returnDocument: 'after' }
    );

    const riskBuyer = await User.findOne({ id: userId }).select('createdAt');
    const approvedToday = await Order.countDocuments({
        userId,
        status: 'paid',
        confirmedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    });
    const verdict = evaluatePurchaseRisk({
        order: updatedOrder || order,
        user: riskBuyer,
        providerRisk: params.paymentRisk,
        ordersTodayApproved: approvedToday,
    });

    await Order.findOneAndUpdate(
        { id: orderId },
        {
            $set: {
                riskStatus: verdict.risky ? 'hold' : 'safe',
                riskScore: verdict.riskScore,
                riskReasons: verdict.reasons,
                riskHoldExpiresAt: verdict.holdExpiresAt,
            },
        },
        { returnDocument: 'after' }
    ).catch(() => {});

    const io = getIO();
    io.emit('order_updated', { userId, orderId: order.id, status: 'paid' });

    const xpGain = Math.floor(order.amount * 10);

    const user = await User.findOneAndUpdate(
        { id: userId },
        {
            $inc: { diamonds: order.diamonds, diamonds_purchased: order.diamonds, xp: xpGain },
            $push: {
                recentActivities: {
                    $each: [{
                        action: 'purchase',
                        resource: 'financial_transaction',
                        timestamp: new Date(),
                        endpoint: '/purchase/paid',
                    }],
                    $slice: -50,
                },
            },
        },
        { returnDocument: 'after' }
    );

    if (verdict.risky && user) {
        const holdExpires = verdict.holdExpiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const existingLedger: any[] = user.risk_ledger || [];
        const mergedRef = existingLedger.find((l: any) => l.ref === order.id);
        await User.findOneAndUpdate(
            { id: userId },
            mergedRef
                ? { $set: { [`risk_ledger.${existingLedger.indexOf(mergedRef)}.remaining`]: mergedRef.remaining + order.diamonds } }
                : {
                      $push: {
                          risk_ledger: {
                              ref: order.id,
                              amount: order.diamonds,
                              remaining: order.diamonds,
                              expiresAt: holdExpires,
                              createdAt: new Date(),
                          },
                      },
                      $inc: { risk_diamonds: order.diamonds },
                  }
        );
    }

    await PurchaseAuditTrail.create({
        eventType: 'diamonds_delivered',
        orderId,
        userId,
        ip: params.ip || '',
        userAgent: (params.userAgent || '').slice(0, 300),
        metadata: {
            diamonds: order.diamonds,
            amount: order.amount,
            paymentConfirmationId,
            newBalance: user?.diamonds,
        },
    }).catch(() => {});

    await PurchaseRecord.create({
        id: `purchase_${orderId}_${Date.now()}`,
        userId,
        type: 'purchase_diamonds',
        description: `Compra de ${order.diamonds} diamantes - Pagamento confirmado: ${paymentConfirmationId}`,
        amountBRL: order.amount,
        amountCoins: order.diamonds,
        status: 'Concluído',
        metadata: { orderId },
    });

    if (io && user) {
        io.to(userId).emit('purchase_completed', {
            orderId: order.id,
            diamonds: order.diamonds,
            amount: order.amount,
            timestamp: new Date(),
        });
        io.to('user_' + userId).emit('diamonds_updated', {
            userId,
            diamonds: user.diamonds,
            xp: user.xp,
        });
    }

    console.log(`[PURCHASE SUCCESS] Usuário ${userId} recebeu ${order.diamonds} diamantes (+${xpGain} XP). Saldo: ${user?.diamonds}`);
    return { success: true, user, order: updatedOrder };
}
