"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const models_1 = require("../models");
const fraudDetection_1 = __importDefault(require("../middleware/fraudDetection"));
const mercadoPagoService_1 = __importDefault(require("../services/mercadoPagoService"));
const auth_1 = require("../middleware/auth");
const paymentSecurity_1 = require("../middleware/paymentSecurity");
const rateLimit_1 = require("../middleware/rateLimit");
const router = express_1.default.Router();
// Confirmar compra de diamantes
// Frontend chama com { orderId } — backend consulta Mercado Pago real para validar
router.post('/confirm', auth_1.protect, paymentSecurity_1.requirePaymentAuth, fraudDetection_1.default.detectFraud, rateLimit_1.paymentRateLimit, async (req, res) => {
    try {
        const { orderId, paymentConfirmationId, paymentStatus } = req.body;
        console.log(`[PURCHASE CONFIRM] Confirmando compra: ${orderId}`);
        const order = await models_1.Order.findOne({ id: orderId });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        // Verificar se a order pertence ao usuário autenticado
        if (order.userId !== req.user?.id) {
            await models_1.PurchaseAuditTrail.create({
                eventType: 'fraud_attempt',
                orderId, userId: req.user?.id || '',
                ip: req.ip || '',
                userAgent: (req.headers['user-agent'] || '').slice(0, 300),
                metadata: { reason: 'userId_mismatch', orderUserId: order.userId }
            }).catch(() => { });
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
        let resolvedPaymentConfirmationId = paymentConfirmationId;
        // Se frontend chamou sem paymentConfirmationId, consultar Mercado Pago real
        if (!paymentConfirmationId) {
            if (!order.mpPaymentId) {
                return res.status(400).json({
                    error: 'Pagamento não iniciado',
                    details: 'Nenhum pagamento Mercado Pago associado a esta order'
                });
            }
            try {
                const paymentResult = await mercadoPagoService_1.default.getPaymentStatus(order.mpPaymentId);
                if (paymentResult.status === 'approved') {
                    resolvedPaymentConfirmationId = order.mpPaymentId;
                }
                else if (paymentResult.status === 'pending' || paymentResult.status === 'in_process') {
                    return res.json({
                        status: 'pending',
                        message: 'Pagamento ainda não aprovado pelo Mercado Pago'
                    });
                }
                else {
                    await models_1.Order.findOneAndUpdate({ id: orderId }, {
                        $set: {
                            status: 'failed',
                            paymentStatus: paymentResult.status,
                            paymentData: paymentResult
                        }
                    });
                    const io = req.app.get('io');
                    io.emit('order_updated', { userId: order.userId, orderId: order.id, status: 'failed' });
                    return res.status(400).json({
                        error: 'Pagamento não aprovado',
                        status: paymentResult.status
                    });
                }
            }
            catch (mpError) {
                console.error(`[PURCHASE ERROR] Erro ao consultar Mercado Pago:`, mpError);
                return res.status(502).json({
                    error: 'Erro ao consultar gateway de pagamento',
                    details: mpError.message
                });
            }
        }
        else {
            // Validação de segurança: se paymentConfirmationId foi fornecido, paymentStatus precisa ser 'approved'
            if (paymentStatus !== 'approved') {
                const clientIp = req.ip || req.connection.remoteAddress;
                const deviceFingerprint = req.headers['x-device-fingerprint'];
                if (order && clientIp && deviceFingerprint) {
                    await fraudDetection_1.default.banRelatedEntities(clientIp, deviceFingerprint, order.userId, '', 'Tentativa de confirmação de pagamento sem aprovação real', { orderId, paymentStatus, timestamp: new Date() }).catch(() => { });
                }
                return res.status(400).json({
                    error: 'Pagamento não confirmado',
                    details: 'Apenas pagamentos aprovados podem gerar diamantes'
                });
            }
        }
        // ATUALIZAR STATUS PARA PAID
        const updatedOrder = await models_1.Order.findOneAndUpdate({ id: orderId }, {
            $set: {
                status: 'paid',
                paymentConfirmationId: resolvedPaymentConfirmationId,
                confirmedAt: new Date()
            }
        }, { returnDocument: 'after' });
        const io = req.app.get('io');
        io.emit('order_updated', { userId: order.userId, orderId: order.id, status: 'paid' });
        const xpGain = Math.floor(order.amount * 10);
        const user = await models_1.User.findOneAndUpdate({ id: order.userId }, {
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
        }, { returnDocument: 'after' });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Audit trail: diamantes entregues
        await models_1.PurchaseAuditTrail.create({
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
        }).catch(() => { });
        // Registrar compra no histórico
        await models_1.PurchaseRecord.create({
            id: `purchase_${orderId}_${Date.now()}`,
            userId: order.userId,
            type: 'purchase_diamonds',
            description: `Compra de ${order.diamonds} diamantes - Pagamento confirmado: ${resolvedPaymentConfirmationId}`,
            amountBRL: order.amount,
            amountCoins: order.diamonds,
            status: 'Concluído',
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
    }
    catch (err) {
        console.error(`[PURCHASE ERROR] Erro ao confirmar compra:`, err);
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
