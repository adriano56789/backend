import express from 'express';
import { Order, User, PurchaseRecord, PurchaseAuditTrail } from '../models';
import FraudDetectionMiddleware from '../middleware/fraudDetection';

import { protect, AuthRequest } from '../middleware/auth';
import { requirePaymentAuth } from '../middleware/paymentSecurity';
import { paymentRateLimit } from '../middleware/rateLimit';
import { evaluatePurchaseRisk } from '../services/riskEngine';

const router = express.Router();

// Confirmar compra de diamantes
// Frontend chama com { orderId } � backend consulta Mercado Pago real para validar
router.post('/confirm',
    protect,
    requirePaymentAuth,
    FraudDetectionMiddleware.detectFraud,
    paymentRateLimit,
    async (req: AuthRequest, res) => {
    try {
        const { orderId, paymentConfirmationId, paymentStatus } = req.body;

        console.log(`[PURCHASE CONFIRM] Confirmando compra: ${orderId}`);

        const order = await Order.findOne({ id: orderId });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Verificar se a order pertence ao usuário autenticado
        if (order.userId !== req.user?.id) {
            await PurchaseAuditTrail.create({
                eventType: 'fraud_attempt',
                orderId, userId: req.user?.id || '',
                ip: req.ip || '',
                userAgent: (req.headers['user-agent'] || '').slice(0, 300),
                metadata: { reason: 'userId_mismatch', orderUserId: order.userId }
            }).catch(() => {});
            return res.status(403).json({ error: 'Esta ordem não pertence ao seu usuário' });
        }

        // Se já foi paga, retornar sucesso direto (idempotência)
        if (order.status === 'paid') {
            return res.json({ success: true, message: 'Compra já confirmada anteriormente' });
        }

        // Se não está pending, rejeitar
        if (order.status !== 'pending') {
            return res.status(400).json({ error: 'Status da order não permite confirmação' });
        }

        // �"��"��"� MERCADO PAGO REMOVIDO: consulta direta ao gateway não existe mais �"��"��"�
        if (!paymentConfirmationId) {
            return res.status(503).json({
                error: 'Pagamentos em transição',
                details: 'O Mercado Pago foi desativado. Depósitos retornarão em breve com o novo provedor.',
            });
        } else {
            // Validação de segurança: se paymentConfirmationId foi fornecido, paymentStatus precisa ser 'approved'
            if (paymentStatus !== 'approved') {
                const clientIp = req.ip || req.connection.remoteAddress;
                const deviceFingerprint = req.headers['x-device-fingerprint'] as string;
                if (order && clientIp && deviceFingerprint) {
                    await FraudDetectionMiddleware.banRelatedEntities(
                        clientIp, deviceFingerprint, order.userId, '',
                        'Tentativa de confirmação de pagamento sem aprovação real',
                        { orderId, paymentStatus, timestamp: new Date() }
                    ).catch(() => {});
                }
                return res.status(400).json({
                    error: 'Pagamento não confirmado',
                    details: 'Apenas pagamentos aprovados podem gerar diamantes'
                });
            }
        }
        const resolvedPaymentConfirmationId = paymentConfirmationId;

        // ATUALIZAR STATUS PARA PAID
        const updatedOrder = await Order.findOneAndUpdate(
            { id: orderId }, 
            { 
                $set: {
                    status: 'paid',
                    paymentConfirmationId: resolvedPaymentConfirmationId,
                    confirmedAt: new Date()
                }
            }, 
            { returnDocument: 'after' }
        );

        // ═══ SISTEMA ANTI-CHARGEBACK: avaliar risco da compra ═══
        const riskBuyer = await User.findOne({ id: req.user?.id }).select('createdAt');
        const approvedToday = await Order.countDocuments({
            userId: req.user?.id, status: 'paid',
            confirmedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        });
        const verdict = evaluatePurchaseRisk({
            order: updatedOrder || order,
            user: riskBuyer,
            providerRisk: (req.body as any)?.paymentRisk,
            ordersTodayApproved: approvedToday,
        });

        // Marcar a order com o status de risco
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

        const io = req.app.get('io');
        io.emit('order_updated', { userId: order.userId, orderId: order.id, status: 'paid' });

        const xpGain = Math.floor(order.amount * 10);

        const user = await User.findOneAndUpdate(
            { id: order.userId },
            { 
                $inc: { 
                    diamonds: order.diamonds,
                    diamonds_purchased: order.diamonds,
                    xp: xpGain
                },
                $push: { recentActivities: { $each: [{
                        action: 'purchase',
                        resource: 'financial_transaction',
                        timestamp: new Date(),
                        endpoint: '/api/purchase/confirm'
                    }], $slice: -50 } }
            },
            { returnDocument: 'after' }
        );

        // Se a compra for SUSPEITA, marcar esses diamantes como em análise:
        // utilizáveis in-app, mas o saque da parte correspondente fica retido por 7 dias.
        if (verdict.risky && user) {
            const holdExpires = verdict.holdExpiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            const existingLedger: any[] = user.risk_ledger || [];
            const mergedRef = existingLedger.find((l: any) => l.ref === order.id);
            await User.findOneAndUpdate(
                { id: order.userId },
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
            console.log(`[RISK] Compra ${order.id} marcada como SUSPEITA. ${order.diamonds} diamantes em análise (lib. em ${verdict.holdDays}d). Motivos: ${verdict.reasons.join(', ')}`);
        } else {
            console.log(`[RISK] Compra ${order.id} considerada SEGURA (score=${verdict.riskScore}).`);
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Audit trail: diamantes entregues
        await PurchaseAuditTrail.create({
            eventType: 'diamonds_delivered',
            orderId,
            userId: order.userId,
            ip: req.ip || '',
            userAgent: (req.headers['user-agent'] || '').slice(0, 300),
            metadata: {
                diamonds: order.diamonds, amount: order.amount,
                paymentConfirmationId: resolvedPaymentConfirmationId,
                newBalance: user.diamonds
            }
        }).catch(() => {});

        // Registrar compra no histórico
        await PurchaseRecord.create({
            id: `purchase_${orderId}_${Date.now()}`,
            userId: order.userId,
            type: 'purchase_diamonds',
            description: `Compra de ${order.diamonds} diamantes - Pagamento confirmado: ${resolvedPaymentConfirmationId}`,
            amountBRL: order.amount,
            amountCoins: order.diamonds,
            status: 'Concluído',
            metadata: { orderId },
        });

        // WebSocket: notificar usuário em tempo real (io já declarado acima)
        if (io) {
            io.to(order.userId).emit('purchase_completed', {
                orderId: order.id,
                diamonds: order.diamonds,
                amount: order.amount,
                timestamp: new Date()
            });
            io.to('user_' + order.userId).emit('diamonds_updated', {
                userId: order.userId,
                diamonds: user.diamonds,
                xp: user.xp
            });
        }

        console.log(`[PURCHASE SUCCESS] Usuário ${user.name} recebeu ${order.diamonds} diamantes (+${xpGain} XP). Saldo: ${user.diamonds}`);

        res.json({ success: true, user, order: updatedOrder });
    } catch (err: any) {
        console.error(`[PURCHASE ERROR] Erro ao confirmar compra:`, err);
        res.status(500).json({ error: err.message });
    }
});

export default router;

