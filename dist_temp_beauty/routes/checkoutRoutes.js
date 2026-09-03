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
const fraudDetection_1 = __importDefault(require("../middleware/fraudDetection"));
const auth_1 = require("../middleware/auth");
const paymentSecurity_1 = require("../middleware/paymentSecurity");
const activityHelpers_1 = require("../utils/activityHelpers");
const rateLimit_1 = require("../middleware/rateLimit");
const diamondConversion_1 = require("../utils/diamondConversion");
const router = express_1.default.Router();
const diamondPackages = diamondConversion_1.DIAMOND_PACKAGES.map((p, i) => ({
    id: `pack${i + 1}`, diamonds: p.diamonds, price: p.brl, bonus: 0,
    icon: ['gem', 'gem_stack', 'chest', 'treasure', 'crown', 'diamond_throne'][i] || 'gem'
}));
router.get('/pack', async (req, res) => res.json(diamondPackages));
router.post('/order', auth_1.protect, paymentSecurity_1.requirePaymentAuth, paymentSecurity_1.validatePackageAmounts, fraudDetection_1.default.detectFraud, rateLimit_1.paymentRateLimit, async (req, res) => {
    try {
        const { packageId, amount, diamonds } = req.body;
        console.log(`[ORDER CREATE] Criando order para userId=${req.user?.id}:`, req.body);
        // Usar valores DO SERVIDOR (ignorar amount/diamonds do frontend)
        const pkg = diamondConversion_1.DIAMOND_PACKAGES.find(p => {
            const id = `pack${diamondConversion_1.DIAMOND_PACKAGES.indexOf(p) + 1}`;
            return id === packageId;
        });
        const safeAmount = pkg.brl;
        const safeDiamonds = pkg.diamonds;
        const order = await models_1.Order.create({
            ...req.body,
            id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            status: 'pending',
            amount: safeAmount,
            diamonds: safeDiamonds,
            timestamp: new Date()
        });
        // Audit trail
        await models_1.PurchaseAuditTrail.create({
            eventType: 'order_created',
            orderId: order.id,
            userId: order.userId,
            ip: req.ip || '',
            userAgent: (req.headers['user-agent'] || '').slice(0, 300),
            metadata: {
                packageId, amount: safeAmount, diamonds: safeDiamonds,
                originalAmount: amount, originalDiamonds: diamonds
            }
        }).catch(() => { });
        if (order.userId) {
            await (0, activityHelpers_1.pushRecentActivity)(order.userId, {
                action: 'purchase_order_created',
                resource: 'financial_transaction',
                endpoint: '/api/checkout/order'
            });
        }
        console.log(`[ORDER SUCCESS] Order criada: ${order.id} para usuário ${order.userId} (R$${safeAmount}, ${safeDiamonds} diamantes)`);
        res.json(order);
    }
    catch (err) {
        console.error(`[ORDER ERROR] Erro ao criar order:`, err);
        res.status(500).json({ error: err.message });
    }
});
// ═══ MERCADO PAGO REMOVIDO — LiveGo usa SOMENTE Payoneer (saques Pix BRL/USD/EUR) ═══
const paymentsUnavailable = (_req, res) => res.status(503).json({
    error: 'Pagamentos em transição',
    details: 'O Mercado Pago foi desativado. Os depósitos voltarão em breve com o novo provedor.',
    provider: 'payoneer',
    provider_role: 'withdrawals_only',
});
router.post('/pix', auth_1.protect, paymentsUnavailable);
router.post('/credit-card', auth_1.protect, paymentsUnavailable);
router.post('/confirm', auth_1.protect, paymentSecurity_1.requirePaymentAuth, fraudDetection_1.default.detectFraud, rateLimit_1.paymentRateLimit, async (req, res) => {
    try {
        const { orderId, paymentConfirmationId, paymentStatus } = req.body;
        console.log(`[PURCHASE CONFIRM] Confirmando compra: ${orderId}`);
        // VALIDAÇÃO OBRIGATÓRIA: Só processar se pagamento foi confirmado
        if (!paymentConfirmationId || paymentStatus !== 'approved') {
            console.log(`[FRAUD ATTEMPT] Tentativa de confirmação sem pagamento aprovado: Order=${orderId}, Status=${paymentStatus}`);
            // Audit trail
            await models_1.PurchaseAuditTrail.create({
                eventType: 'fraud_attempt',
                orderId, userId: req.user?.id || '',
                ip: req.ip || '',
                userAgent: (req.headers['user-agent'] || '').slice(0, 300),
                metadata: { paymentStatus, reason: 'sem_aprovacao_real' }
            }).catch(() => { });
            // Banir tentativa de fraude
            const clientIp = req.ip || req.connection.remoteAddress;
            const deviceFingerprint = req.headers['x-device-fingerprint'];
            const order = await models_1.Order.findOne({ id: orderId });
            if (order && clientIp && deviceFingerprint) {
                await fraudDetection_1.default.banRelatedEntities(clientIp, deviceFingerprint, order.userId, '', 'Tentativa de confirmação de pagamento sem aprovação real', { orderId, paymentStatus, timestamp: new Date() });
            }
            return res.status(400).json({
                error: 'Pagamento não confirmado',
                details: 'Apenas pagamentos aprovados podem gerar diamantes'
            });
        }
        const order = await models_1.Order.findOne({ id: orderId });
        if (!order) {
            console.log(`[PURCHASE ERROR] Order não encontrada: ${orderId}`);
            return res.status(404).json({ error: 'Order not found' });
        }
        // Verificar se a order pertence ao usuário autenticado
        if (order.userId !== req.user?.id) {
            return res.status(403).json({ error: 'Esta ordem não pertence ao seu usuário' });
        }
        // VERIFICAÇÃO DUPLA: Order já está paga?
        if (order.status === 'paid') {
            console.log(`[FRAUD ATTEMPT] Tentativa de confirmação duplicada: Order=${orderId}`);
            return res.status(400).json({
                error: 'Order já processada',
                details: 'Esta compra já foi confirmada anteriormente'
            });
        }
        // VALIDAÇÃO FINAL: Order deve estar 'pending' para ser confirmada
        if (order.status !== 'pending') {
            console.log(`[FRAUD ATTEMPT] Order com status inválido: Order=${orderId}, Status=${order.status}`);
            return res.status(400).json({
                error: 'Order inválida',
                details: 'Status da order não permite confirmação'
            });
        }
        console.log(`[PURCHASE CONFIRM] Order validada:`, {
            orderId: order.id,
            userId: order.userId,
            diamonds: order.diamonds,
            amount: order.amount,
            paymentConfirmationId
        });
        // ATUALIZAR STATUS PARA PAID (só após validação completa)
        const updatedOrder = await models_1.Order.findOneAndUpdate({ id: orderId }, {
            $set: {
                status: 'paid',
                paymentConfirmationId,
                confirmedAt: new Date()
            }
        }, { returnDocument: 'after' });
        const io = req.app.get('io');
        io.emit('order_updated', { userId: order.userId, orderId: order.id, status: 'paid' });
        const user = await Promise.resolve().then(() => __importStar(require('../models'))).then(m => m.User).then(U => U.findOneAndUpdate({ id: order.userId }, {
            $inc: { diamonds: order.diamonds }
        }, { returnDocument: 'after' }));
        await (0, activityHelpers_1.pushRecentActivity)(order.userId, {
            action: 'diamond_purchase_completed',
            resource: 'financial_transaction',
            endpoint: '/api/checkout/confirm'
        });
        if (!user) {
            console.log(`[PURCHASE ERROR] Usuário não encontrado: ${order.userId}`);
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
                paymentConfirmationId, newBalance: user.diamonds
            }
        }).catch(() => { });
        console.log(`[PURCHASE SUCCESS] Usuário ${user.name} recebeu ${order.diamonds} diamantes. Saldo atual: ${user.diamonds}`);
        // Registrar compra no histórico
        const PurchaseRecord = (await Promise.resolve().then(() => __importStar(require('../models')))).PurchaseRecord;
        await PurchaseRecord.create({
            id: `purchase_${orderId}_${Date.now()}`,
            userId: order.userId,
            type: 'purchase_diamonds',
            description: `Compra de ${order.diamonds} diamantes - Pagamento confirmado: ${paymentConfirmationId}`,
            amountBRL: order.amount,
            amountCoins: order.diamonds,
            status: 'Concluído',
        });
        res.json({ success: true, user, order: updatedOrder });
    }
    catch (err) {
        console.error(`[PURCHASE ERROR] Erro ao confirmar compra:`, err);
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
