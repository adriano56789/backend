"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const models_1 = require("../models");
const mercadopago_1 = require("mercadopago");
const router = express_1.default.Router();
// Webhook do Mercado Pago para receber notificações de pagamento
router.post('/mercadopago', async (req, res) => {
    try {
        // Validar assinatura do webhook
        try {
            mercadopago_1.WebhookSignatureValidator.validate({
                xSignature: req.headers['x-signature'],
                xRequestId: req.headers['x-request-id'],
                dataId: req.query['data.id'],
                secret: process.env.MERCADO_PAGO_WEBHOOK_SECRET || '',
                toleranceSeconds: 300,
            });
        }
        catch (err) {
            console.warn('[WEBHOOK] Assinatura inválida (modo não-bloqueante):', err.reason);
            // Non-blocking: loga mas não rejeita
        }
        console.log('[WEBHOOK] Notificação recebida do Mercado Pago:', JSON.stringify(req.body, null, 2));
        // Verificar se é uma notificação de pagamento
        if (req.body.type === 'payment') {
            const paymentId = req.body.data.id;
            console.log(`[WEBHOOK] Processando pagamento ${paymentId}`);
            // Buscar informações do pagamento usando SDK v3
            const { paymentClient } = await Promise.resolve().then(() => __importStar(require('../config/mercadoPago')));
            const paymentData = await paymentClient.get({ id: paymentId });
            console.log(`[WEBHOOK] Status do pagamento ${paymentId}: ${paymentData.status}`);
            // Procurar ordem associada a este pagamento
            const order = await models_1.Order.findOne({ mpPaymentId: paymentId });
            if (!order) {
                console.log(`[WEBHOOK] Ordem não encontrada para pagamento ${paymentId}`);
                return res.status(404).json({ error: 'Ordem não encontrada' });
            }
            console.log(`[WEBHOOK] Ordem ${order.id} encontrada para pagamento ${paymentId}`);
            // Se o pagamento foi aprovado e a ordem ainda está pendente
            if (paymentData.status === 'approved' && order.status === 'pending') {
                console.log(`[WEBHOOK] Pagamento aprovado! Processando ordem ${order.id}`);
                // Atualizar status da ordem
                await models_1.Order.findOneAndUpdate({ id: order.id }, {
                    $set: {
                        status: 'paid',
                        paymentConfirmationId: paymentId,
                        confirmedAt: new Date(),
                        paymentStatus: 'approved'
                    }
                });
                const io = req.app.get('io');
                if (io) {
                    io.emit('order_updated', { userId: order.userId, orderId: order.id, status: 'paid' });
                }
                // Creditar diamantes para o usuário + persistir atividade
                const User = (await Promise.resolve().then(() => __importStar(require('../models')))).User;
                const user = await User.findOneAndUpdate({ id: order.userId }, {
                    $inc: { diamonds: order.diamonds },
                    $push: {
                        recentActivities: {
                            action: 'webhook_payment_processed',
                            resource: 'webhook_mercadopago',
                            timestamp: new Date(),
                            endpoint: '/api/webhook/mercadopago'
                        }
                    }
                }, { new: true });
                if (!user) {
                    console.log(`[WEBHOOK] Usuário não encontrado: ${order.userId}`);
                    return res.status(404).json({ error: 'Usuário não encontrado' });
                }
                console.log(`[WEBHOOK] SUCESSO! Usuário ${user.name} recebeu ${order.diamonds} diamantes. Saldo atual: ${user.diamonds}`);
                // Registrar compra no histórico
                const PurchaseRecord = (await Promise.resolve().then(() => __importStar(require('../models')))).PurchaseRecord;
                await PurchaseRecord.create({
                    id: `purchase_${order.id}_${Date.now()}`,
                    userId: order.userId,
                    type: 'diamond_purchase',
                    description: `Compra de ${order.diamonds} diamantes - Pagamento confirmado: ${paymentId}`,
                    amountBRL: order.amount,
                    amountCoins: order.diamonds,
                    status: 'Concluído',
                    timestamp: new Date()
                });
                console.log(`[WEBHOOK] Compra registrada no histórico para usuário ${order.userId}`);
                // Emitir WebSocket para atualizar frontend em tempo real
                if (io) {
                    io.to('user_' + order.userId).emit('diamonds_updated', {
                        userId: order.userId,
                        diamonds: user.diamonds,
                        change: order.diamonds,
                        source: 'purchase'
                    });
                    console.log(`[WEBHOOK] WebSocket emitido para usuário ${order.userId}`);
                }
            }
            else if (paymentData.status === 'rejected' || paymentData.status === 'cancelled') {
                console.log(`[WEBHOOK] Pagamento rejeitado/cancelado: ${paymentId}`);
                // Persistir atividade de pagamento rejeitado
                const User = (await Promise.resolve().then(() => __importStar(require('../models')))).User;
                await User.findOneAndUpdate({ id: order.userId }, {
                    $push: {
                        recentActivities: {
                            action: 'webhook_payment_rejected',
                            resource: 'webhook_mercadopago',
                            timestamp: new Date(),
                            endpoint: '/api/webhook/mercadopago'
                        }
                    }
                }).catch(console.error);
                await models_1.Order.findOneAndUpdate({ id: order.id }, {
                    $set: {
                        status: 'cancelled',
                        paymentStatus: paymentData.status,
                        cancelledAt: new Date()
                    }
                });
                const io2 = req.app.get('io');
                if (io2) {
                    io2.emit('order_updated', { userId: order.userId, orderId: order.id, status: 'cancelled' });
                }
            }
        }
        else if (req.body.type === 'merchant_order') {
            console.log(`[WEBHOOK] Merchant order recebido: ${req.body.data.id}`);
        }
        res.status(200).json({ received: true });
    }
    catch (error) {
        console.error('[WEBHOOK] Erro ao processar webhook:', error);
        res.status(500).json({ error: error.message });
    }
});
// Endpoint para testar webhook
router.post('/test', async (req, res) => {
    try {
        console.log('[WEBHOOK TEST] Notificação de teste recebida');
        // Persistir atividade de teste de webhook
        const User = (await Promise.resolve().then(() => __importStar(require('../models')))).User;
        // Para webhook de teste, podemos persistir para um usuário admin ou genérico
        await User.findOneAndUpdate({ id: 'admin' }, // ou outro identificador de admin
        {
            $push: {
                recentActivities: {
                    action: 'webhook_test_received',
                    resource: 'webhook_system',
                    timestamp: new Date(),
                    endpoint: '/api/webhook/test'
                }
            }
        }).catch(console.error);
        res.status(200).json({ received: true, message: 'Webhook de teste recebido' });
    }
    catch (error) {
        console.error('[WEBHOOK TEST] Erro:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
