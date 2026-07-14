"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mercadoPagoService_1 = __importDefault(require("../services/mercadoPagoService"));
const models_1 = require("../models");
const rateLimit_1 = require("../middleware/rateLimit");
const router = express_1.default.Router();
/**
 * Webhook específico para pagamentos de compras (Pix)
 */
router.post('/webhook/purchase', rateLimit_1.webhookRateLimit, async (req, res) => {
    try {
        console.log('🔔 [WEBHOOK PURCHASE] Notificação recebida:', JSON.stringify(req.body, null, 2));
        const { type, data } = req.body;
        if (type === 'payment') {
            const paymentId = data.id;
            if (!paymentId) {
                return res.status(400).json({ error: 'paymentId ausente' });
            }
            // Verificar se já processamos este paymentId
            const existingOrder = await models_1.Order.findOne({ mpPaymentId: paymentId });
            if (existingOrder && existingOrder.status === 'paid') {
                console.log(`⏭️ [WEBHOOK PURCHASE] Pagamento ${paymentId} já processado, ignorando`);
                return res.status(200).json({ received: true, duplicated: true });
            }
            // Buscar informações do pagamento no Mercado Pago
            const payment = await mercadoPagoService_1.default.getPaymentStatus(paymentId);
            console.log(`💳 [WEBHOOK PURCHASE] Status do pagamento ${paymentId}:`, payment.status);
            // Buscar ordem pela referência externa
            const order = await models_1.Order.findOne({ externalReference: payment.external_reference });
            if (!order) {
                console.log(`❌ [WEBHOOK PURCHASE] Ordem não encontrada para external_reference: ${payment.external_reference}`);
                return res.status(404).json({ error: 'Order not found' });
            }
            console.log(`📋 [WEBHOOK PURCHASE] Ordem encontrada: ${order.id}, Status: ${order.status}`);
            // Verificar se o pagamento foi aprovado e a ordem ainda está pendente
            if (payment.status === 'approved' && order.status === 'pending') {
                console.log(`✅ [WEBHOOK PURCHASE] Pagamento aprovado! Processando ordem ${order.id}`);
                // AUDIT: payment_approved
                await models_1.PurchaseAuditTrail.create({
                    eventType: 'payment_approved',
                    orderId: order.id,
                    userId: order.userId,
                    ip: req.ip || '',
                    userAgent: (req.headers['user-agent'] || '').slice(0, 300),
                    metadata: { paymentId, mpStatus: payment.status }
                }).catch(() => { });
                // Atualizar status da ordem
                order.status = 'paid';
                order.paymentConfirmationId = paymentId;
                order.mpPaymentId = paymentId;
                order.confirmedAt = new Date();
                await order.save();
                // Creditar diamantes para o usuário
                const user = await models_1.User.findOneAndUpdate({ id: order.userId }, {
                    $inc: { diamonds: order.diamonds },
                    $push: {
                        purchase_history: {
                            timestamp: new Date(),
                            amount: order.amount,
                            diamonds: order.diamonds,
                            paymentId: paymentId,
                            description: `Compra de ${order.diamonds} diamantes via Mercado Pago`,
                            status: 'completed'
                        },
                        recentActivities: {
                            action: 'diamond_purchase_completed',
                            resource: 'payment_transaction',
                            timestamp: new Date(),
                            endpoint: '/api/payment/webhook/purchase'
                        }
                    }
                }, { returnDocument: 'after' });
                if (!user) {
                    console.log(`❌ [WEBHOOK PURCHASE] Usuário não encontrado: ${order.userId}`);
                    return res.status(404).json({ error: 'User not found' });
                }
                // AUDIT: diamonds_delivered
                await models_1.PurchaseAuditTrail.create({
                    eventType: 'diamonds_delivered',
                    orderId: order.id,
                    userId: order.userId,
                    ip: req.ip || '',
                    userAgent: '',
                    metadata: {
                        diamonds: order.diamonds, amount: order.amount,
                        paymentId, newBalance: user.diamonds,
                        source: 'webhook_purchase'
                    }
                }).catch(() => { });
                console.log(`💎 [WEBHOOK PURCHASE] Usuário ${user.name} recebeu ${order.diamonds} diamantes. Saldo atual: ${user.diamonds}`);
                // Registrar compra no histórico
                await models_1.PurchaseRecord.create({
                    id: `purchase_${order.id}_${Date.now()}`,
                    userId: order.userId,
                    type: 'purchase_diamonds',
                    description: `Compra de ${order.diamonds} diamantes - Pagamento Pix: ${paymentId}`,
                    amountBRL: order.amount,
                    amountCoins: order.diamonds,
                    status: 'Concluído',
                });
                // Emitir WebSocket para atualização em tempo real
                const io = req.app.get('io');
                if (io) {
                    io.to(order.userId).emit('purchase_completed', {
                        orderId: order.id,
                        diamonds: order.diamonds,
                        amount: order.amount,
                        newBalance: user.diamonds
                    });
                    io.to('user_' + order.userId).emit('diamonds_updated', {
                        diamonds: user.diamonds,
                        change: order.diamonds
                    });
                }
                console.log(`🎉 [WEBHOOK PURCHASE] Compra concluída com sucesso! Ordem: ${order.id}`);
            }
            else if (payment.status === 'rejected' || payment.status === 'cancelled') {
                console.log(`❌ [WEBHOOK PURCHASE] Pagamento rejeitado/cancelado: ${paymentId}`);
                // AUDIT: cancellation/refund
                await models_1.PurchaseAuditTrail.create({
                    eventType: payment.status === 'cancelled' ? 'cancellation' : 'refund',
                    orderId: order.id,
                    userId: order.userId,
                    ip: req.ip || '',
                    userAgent: '',
                    metadata: { paymentId, mpStatus: payment.status }
                }).catch(() => { });
                // Atualizar status da ordem
                order.status = payment.status === 'rejected' ? 'failed' : 'cancelled';
                order.paymentConfirmationId = paymentId;
                order.mpPaymentId = paymentId;
                await order.save();
            }
            else {
                console.log(`⏳ [WEBHOOK PURCHASE] Pagamento em processamento: ${payment.status}`);
            }
        }
        res.status(200).json({ received: true });
    }
    catch (error) {
        console.error('❌ [WEBHOOK PURCHASE] Erro ao processar notificação:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * Webhook do Mercado Pago - recebe notificações de saques
 */
router.post('/webhook', rateLimit_1.webhookRateLimit, async (req, res) => {
    try {
        const { type, data } = req.body;
        console.log(`🔔 [WEBHOOK] Notificação recebida:`, { type, data });
        if (type === 'payment') {
            const paymentId = data.id;
            // Buscar informações do pagamento
            const payment = await mercadoPagoService_1.default.getPaymentStatus(paymentId);
            console.log(`💳 [WEBHOOK] Status do pagamento ${paymentId}:`, payment.status);
            // Buscar usuário pelo external_reference
            const user = await models_1.User.findOne({
                'withdrawal_requests.external_reference': payment.external_reference
            });
            if (user && user.withdrawal_requests) {
                // Atualizar status do saque
                const withdrawalRequest = user.withdrawal_requests.find((req) => req.external_reference === payment.external_reference);
                if (withdrawalRequest) {
                    // AUDIT: registro de mudança de status
                    await models_1.PurchaseAuditTrail.create({
                        eventType: withdrawalRequest.status === 'approved' ? 'payment_approved' : 'refund',
                        orderId: `withdrawal_${payment.external_reference || paymentId}`,
                        userId: user.id,
                        ip: req.ip || '',
                        userAgent: '',
                        metadata: {
                            paymentId, externalReference: payment.external_reference,
                            oldStatus: withdrawalRequest.status, newStatus: payment.status
                        }
                    }).catch(() => { });
                    withdrawalRequest.status = payment.status;
                    withdrawalRequest.mp_payment_id = paymentId;
                    withdrawalRequest.approved_at = payment.date_approved;
                    withdrawalRequest.net_amount = payment.net_amount;
                    withdrawalRequest.fee_amount = payment.fee_amount;
                    await user.save();
                    await models_1.User.findOneAndUpdate({ id: user.id }, {
                        $push: {
                            recentActivities: {
                                action: 'withdrawal_status_updated',
                                resource: 'payment_transaction',
                                timestamp: new Date(),
                                endpoint: '/api/payment/webhook'
                            }
                        }
                    }).catch(console.error);
                    console.log(`✅ [WEBHOOK] Saque atualizado para usuário ${user.name}:`, {
                        status: payment.status,
                        amount: payment.net_amount
                    });
                    // Emitir WebSocket para atualização em tempo real
                    const io = req.app.get('io');
                    if (io) {
                        io.to(user.id).emit('withdrawal_status_updated', {
                            external_reference: payment.external_reference || '',
                            status: payment.status,
                            net_amount: payment.net_amount,
                            approved_at: payment.date_approved
                        });
                    }
                }
            }
        }
        res.status(200).json({ received: true });
    }
    catch (error) {
        console.error('❌ [WEBHOOK] Erro ao processar notificação:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * Endpoint de notificação alternativa (compatibilidade)
 */
router.post('/notification', rateLimit_1.webhookRateLimit, async (req, res) => {
    try {
        const { type, data } = req.body;
        console.log(`🔔 [NOTIFICATION] Notificação recebida:`, { type, data });
        if (type === 'payment') {
            const paymentId = data.id;
            // Verificar duplicidade
            const dupOrder = await models_1.Order.findOne({ mpPaymentId: paymentId });
            if (dupOrder && dupOrder.status === 'paid') {
                return res.status(200).json({ received: true, duplicated: true });
            }
            const payment = await mercadoPagoService_1.default.getPaymentStatus(paymentId);
            console.log(`💳 [NOTIFICATION] Status do pagamento ${paymentId}:`, payment.status);
            const order = await models_1.Order.findOne({ externalReference: payment.external_reference });
            if (order) {
                if (payment.status === 'approved' && order.status === 'pending') {
                    await models_1.PurchaseAuditTrail.create({
                        eventType: 'payment_approved',
                        orderId: order.id,
                        userId: order.userId,
                        ip: req.ip || '',
                        userAgent: '',
                        metadata: { paymentId, source: 'notification_endpoint' }
                    }).catch(() => { });
                    order.status = 'paid';
                    order.paymentConfirmationId = paymentId;
                    order.mpPaymentId = paymentId;
                    order.confirmedAt = new Date();
                    await order.save();
                    const user = await models_1.User.findOneAndUpdate({ id: order.userId }, { $inc: { diamonds: order.diamonds } }, { returnDocument: 'after' });
                    if (user) {
                        await models_1.PurchaseAuditTrail.create({
                            eventType: 'diamonds_delivered',
                            orderId: order.id,
                            userId: order.userId,
                            ip: req.ip || '',
                            userAgent: '',
                            metadata: { diamonds: order.diamonds, paymentId, source: 'notification_endpoint' }
                        }).catch(() => { });
                    }
                    const io = req.app.get('io');
                    if (io) {
                        io.to(order.userId).emit('purchase_completed', {
                            orderId: order.id, diamonds: order.diamonds, amount: order.amount
                        });
                    }
                }
                else if (payment.status === 'rejected' || payment.status === 'cancelled') {
                    order.status = payment.status === 'rejected' ? 'failed' : 'cancelled';
                    await order.save();
                }
                return res.status(200).json({ received: true });
            }
            // Fallback: buscar usuário pelo external_reference (saques)
            const user = await models_1.User.findOne({
                'withdrawal_requests.external_reference': payment.external_reference
            });
            if (user && user.withdrawal_requests) {
                const withdrawalRequest = user.withdrawal_requests.find((req) => req.external_reference === payment.external_reference);
                if (withdrawalRequest) {
                    await models_1.PurchaseAuditTrail.create({
                        eventType: 'payment_approved',
                        orderId: `withdrawal_${payment.external_reference || paymentId}`,
                        userId: user.id,
                        ip: req.ip || '',
                        userAgent: '',
                        metadata: { paymentId, source: 'notification_endpoint', type: 'withdrawal' }
                    }).catch(() => { });
                    withdrawalRequest.status = payment.status;
                    withdrawalRequest.mp_payment_id = paymentId;
                    withdrawalRequest.approved_at = payment.date_approved;
                    withdrawalRequest.net_amount = payment.net_amount;
                    withdrawalRequest.fee_amount = payment.fee_amount;
                    await user.save();
                    const io = req.app.get('io');
                    if (io) {
                        io.to(user.id).emit('withdrawal_status_updated', {
                            external_reference: payment.external_reference || '',
                            status: payment.status,
                            net_amount: payment.net_amount
                        });
                    }
                }
            }
        }
        res.status(200).json({ received: true });
    }
    catch (error) {
        console.error('❌ [NOTIFICATION] Erro ao processar notificação:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * Verifica status de um pagamento Pix
 */
router.get('/pix/status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        // Buscar ordem no banco
        const order = await models_1.Order.findOne({ id: orderId });
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }
        // Se não tem mpPaymentId, ainda não foi gerado o Pix
        if (!order.mpPaymentId) {
            return res.json({
                success: true,
                status: 'pending',
                message: 'Pix ainda não gerado',
                order: {
                    id: order.id,
                    status: order.status,
                    amount: order.amount,
                    diamonds: order.diamonds
                }
            });
        }
        // Persistir atividade de verificação de status Pix
        await models_1.User.findOneAndUpdate({ id: order.userId }, {
            $push: {
                recentActivities: {
                    action: 'pix_status_checked',
                    resource: 'payment_transaction',
                    timestamp: new Date(),
                    endpoint: '/api/payment/pix/status/:orderId'
                }
            }
        }).catch(console.error);
        // Verificar status no Mercado Pago
        const payment = await mercadoPagoService_1.default.getPaymentStatus(order.mpPaymentId);
        // Atualizar status da ordem se necessário
        if (payment.status !== order.status) {
            order.status = payment.status === 'approved' ? 'paid' :
                payment.status === 'rejected' ? 'failed' :
                    payment.status === 'cancelled' ? 'cancelled' : 'pending';
            if (payment.status === 'approved') {
                order.paymentConfirmationId = payment.id;
                order.confirmedAt = new Date();
            }
            await order.save();
        }
        res.json({
            success: true,
            status: payment.status,
            order: {
                id: order.id,
                status: order.status,
                amount: order.amount,
                diamonds: order.diamonds,
                confirmedAt: order.confirmedAt
            },
            payment: {
                id: payment.id,
                status: payment.status,
                date_approved: payment.date_approved,
                transaction_amount: payment.transaction_amount
            }
        });
    }
    catch (error) {
        console.error('❌ [PIX STATUS] Erro ao verificar status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * Verifica status de um saque
 */
router.get('/status/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;
        // Tentar identificar usuário pelo paymentId (se possível)
        // Nota: Esta rota não tem userId direto, então vamos registrar como atividade administrativa
        const adminUserId = req.headers['admin-user-id'];
        if (adminUserId) {
            await models_1.User.findOneAndUpdate({ id: adminUserId }, {
                $push: {
                    recentActivities: {
                        action: 'payment_status_checked',
                        resource: 'payment_transaction',
                        timestamp: new Date(),
                        endpoint: '/api/payment/status/:paymentId'
                    }
                }
            }).catch(console.error);
        }
        const payment = await mercadoPagoService_1.default.getPaymentStatus(paymentId);
        res.json({
            success: true,
            payment
        });
    }
    catch (error) {
        console.error('❌ [STATUS] Erro ao verificar status:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * Verifica configuração do Mercado Pago
 */
router.get('/config', async (req, res) => {
    try {
        // Persistir atividade administrativa de verificação de configuração
        const adminUserId = req.headers['admin-user-id'];
        if (adminUserId) {
            await models_1.User.findOneAndUpdate({ id: adminUserId }, {
                $push: {
                    recentActivities: {
                        action: 'payment_config_checked',
                        resource: 'payment_configuration',
                        timestamp: new Date(),
                        endpoint: '/api/payment/config'
                    }
                }
            }).catch(console.error);
        }
        const config = mercadoPagoService_1.default.getConfigInfo();
        const isConfigured = mercadoPagoService_1.default.isConfigured();
        res.json({
            configured: isConfigured,
            config,
            webhook_url: process.env.WEBHOOK_URL,
            notification_url: process.env.NOTIFICATION_URL
        });
    }
    catch (error) {
        console.error('❌ [CONFIG] Erro ao verificar configuração:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
