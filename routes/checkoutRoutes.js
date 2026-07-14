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
            await models_1.User.findOneAndUpdate({ id: order.userId }, {
                $push: {
                    recentActivities: {
                        action: 'purchase_order_created',
                        resource: 'financial_transaction',
                        timestamp: new Date(),
                        endpoint: '/api/checkout/order'
                    }
                }
            }).catch(console.error);
        }
        console.log(`[ORDER SUCCESS] Order criada: ${order.id} para usuário ${order.userId} (R$${safeAmount}, ${safeDiamonds} diamantes)`);
        res.json(order);
    }
    catch (err) {
        console.error(`[ORDER ERROR] Erro ao criar order:`, err);
        res.status(500).json({ error: err.message });
    }
});
router.post('/pix', auth_1.protect, paymentSecurity_1.requirePaymentAuth, fraudDetection_1.default.detectFraud, rateLimit_1.paymentRateLimit, async (req, res) => {
    try {
        const { orderId } = req.body;
        console.log(`[PIX PAYMENT] Gerando PIX para order: ${orderId}`);
        // Verificar se a order existe
        const order = await models_1.Order.findOne({ id: orderId });
        if (!order) {
            console.log(`[PIX ERROR] Order não encontrada: ${orderId}`);
            return res.status(404).json({ error: 'Order not found' });
        }
        // Verificar se a order pertence ao usuário autenticado
        if (order.userId !== req.user?.id) {
            console.log(`[FRAUD] Tentativa de PIX em order de outro usuário: orderUserId=${order.userId}, tokenUserId=${req.user?.id}`);
            return res.status(403).json({ error: 'Esta ordem não pertence ao seu usuário' });
        }
        // Verificar se order já não foi paga
        if (order.status === 'paid') {
            return res.status(400).json({ error: 'Esta compra já foi paga' });
        }
        // Verificar se está configurado para produção
        if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
            throw new Error('Mercado Pago Access Token não configurado');
        }
        console.log(`[PIX PRODUCTION] Criando PIX real para order ${orderId}: R$${order.amount} (${order.diamonds} diamantes)`);
        try {
            const { paymentClient } = await Promise.resolve().then(() => __importStar(require('../config/mercadoPago')));
            const result = await paymentClient.create({
                body: {
                    transaction_amount: order.amount,
                    description: `LiveGo - Compra de ${order.diamonds} diamantes`,
                    payment_method_id: 'pix',
                    external_reference: `purchase_${orderId}_${Date.now()}`,
                    notification_url: process.env.NOTIFICATION_URL,
                    payer: {
                        email: req.body.payerEmail || 'comprador@livego.store',
                        first_name: req.body.payerFirstName || 'Comprador',
                        last_name: req.body.payerLastName || 'LiveGo',
                        identification: {
                            type: 'CPF',
                            number: req.body.payerCpf || '00000000000'
                        }
                    }
                },
                requestOptions: {
                    idempotencyKey: `pix_${orderId}_${Date.now()}`,
                },
            });
            console.log('[MERCADO PAGO SUCCESS] Pagamento criado:', result.id);
            // Extrair dados do PIX da resposta correta da API v2
            const pixCode = result.point_of_interaction?.transaction_data?.qr_code;
            const qrCodeBase64 = result.point_of_interaction?.transaction_data?.qr_code_base64;
            if (!pixCode) {
                console.error('[PIX ERROR] Resposta do Mercado Pago (sem qr_code):', JSON.stringify(result, null, 2));
                throw new Error('Mercado Pago não retornou o código PIX (Copia e Cola). Verifique se a conta tem uma chave PIX configurada.');
            }
            if (!qrCodeBase64) {
                console.warn('[PIX WARNING] QR Code base64 ausente na resposta');
            }
            // Atualizar ordem com dados do pagamento + persistir atividade
            const externalReference = result.external_reference;
            await models_1.Order.findOneAndUpdate({ id: orderId }, {
                $set: {
                    externalReference: externalReference,
                    mpPaymentId: result.id,
                    pixCode: pixCode,
                    pixQrCode: qrCodeBase64,
                    pixExpiration: result.date_of_expiration
                }
            });
            const io = req.app.get('io');
            io.emit('order_updated', { userId: order.userId, orderId: order.id, status: order.status });
            // Persistir atividade de geração de PIX
            if (order.userId) {
                await models_1.User.findOneAndUpdate({ id: order.userId }, {
                    $push: {
                        recentActivities: {
                            action: 'pix_payment_generated',
                            resource: 'financial_transaction',
                            timestamp: new Date(),
                            endpoint: '/api/checkout/pix'
                        }
                    }
                }).catch(console.error);
            }
            const pixResponse = {
                success: true,
                pixCode: pixCode,
                qrCode: qrCodeBase64,
                expiration: result.date_of_expiration,
                orderId: orderId,
                amount: order.amount,
                diamonds: order.diamonds,
                mpPaymentId: result.id
            };
            console.log(`[PIX SUCCESS] PIX REAL gerado para order ${orderId}:`);
            console.log(`  - Valor: R$${order.amount} (${order.diamonds} diamantes)`);
            console.log(`  - PIX Code: ${pixCode?.substring(0, 50)}...`);
            console.log(`  - Expiração: ${result.date_of_expiration}`);
            console.log(`  - MP Payment ID: ${result.id}`);
            console.log(`  - External Reference: ${externalReference}`);
            res.json(pixResponse);
        }
        catch (err) {
            console.error('[PIX ERROR] Erro ao gerar PIX:', err);
            console.log('[DEBUG] Detalhes do erro:', {
                message: err.message,
                status: err.status,
                responseStatus: err.response?.status,
                responseData: err.response?.data,
                error: err.error
            });
            // Sem fallback - apenas retorna erro real para debugging
            if (err.response?.data?.message?.includes('without key enabled')) {
                return res.status(400).json({
                    error: 'Conta Mercado Pago sem chave PIX configurada',
                    details: 'Configure uma chave PIX na conta Mercado Pago para gerar pagamentos',
                    mpError: err.response?.data
                });
            }
            res.status(500).json({
                error: 'Erro ao gerar PIX',
                details: err.message,
                mpError: err.response?.data
            });
        }
    }
    catch (err) {
        console.error('[PIX ERROR] Erro ao gerar PIX:', err);
        res.status(500).json({ error: err.message });
    }
});
router.post('/credit-card', auth_1.protect, paymentSecurity_1.requirePaymentAuth, fraudDetection_1.default.detectFraud, rateLimit_1.paymentRateLimit, async (req, res) => {
    try {
        const { orderId, cardToken, payerEmail, payerName, installments = 1 } = req.body;
        if (!cardToken) {
            return res.status(400).json({ error: 'Card token is required' });
        }
        // Verificar se a order existe
        const order = await models_1.Order.findOne({ id: orderId });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        // Verificar se a order pertence ao usuário autenticado
        if (order.userId !== req.user?.id) {
            console.log(`[FRAUD] Tentativa de cartão em order de outro usuário: orderUserId=${order.userId}, tokenUserId=${req.user?.id}`);
            return res.status(403).json({ error: 'Esta ordem não pertence ao seu usuário' });
        }
        // Verificar se já foi paga
        if (order.status === 'paid') {
            return res.status(400).json({ error: 'Esta compra já foi paga' });
        }
        // Verificar se está configurado para produção
        if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
            throw new Error('Mercado Pago Access Token não configurado');
        }
        console.log(`[CREDIT CARD PRODUCTION] Processando cartão real para order ${orderId}: R$${order.amount} (${order.diamonds} diamantes)`);
        console.log(`[DEBUG] Installments: ${installments}`);
        const { paymentClient } = await Promise.resolve().then(() => __importStar(require('../config/mercadoPago')));
        const result = await paymentClient.create({
            body: {
                transaction_amount: order.amount,
                token: cardToken,
                description: `LiveGo - Compra de ${order.diamonds} diamantes`,
                installments: parseInt(installments),
                payment_method_id: 'credit_card',
                external_reference: `purchase_${orderId}_${Date.now()}`,
                notification_url: process.env.NOTIFICATION_URL,
                payer: {
                    email: payerEmail,
                    first_name: payerName?.split(' ')[0] || 'Comprador',
                    last_name: payerName?.split(' ').slice(1).join(' ') || 'LiveGo',
                    identification: {
                        type: 'CPF',
                        number: req.body.payerCpf || '00000000000'
                    }
                }
            },
            requestOptions: {
                idempotencyKey: `card_${orderId}_${Date.now()}`,
            },
        });
        console.log('[MERCADO PAGO SUCCESS] Pagamento com cartão criado:', result.id);
        console.log(`[CREDIT CARD SUCCESS] Status: ${result.status} | Order: ${orderId} | Valor: R$${order.amount}`);
        // Atualizar ordem com dados do pagamento + persistir atividade
        await models_1.Order.findOneAndUpdate({ id: orderId }, {
            $set: {
                externalReference: `purchase_${orderId}`,
                mpPaymentId: result.id,
                paymentStatus: result.status,
                paymentMethod: 'credit_card',
                paymentData: {
                    status: result.status,
                    status_detail: result.status_detail,
                    payment_method_id: result.payment_method_id,
                    payment_type_id: result.payment_type_id,
                    installments: result.installments,
                    card: {
                        first_six_digits: result.card?.first_six_digits,
                        last_four_digits: result.card?.last_four_digits,
                        cardholder: result.card?.cardholder
                    }
                }
            }
        });
        const io = req.app.get('io');
        io.emit('order_updated', { userId: order.userId, orderId: order.id, status: order.status });
        // Persistir atividade de pagamento com cartão
        if (order.userId) {
            await models_1.User.findOneAndUpdate({ id: order.userId }, {
                $push: {
                    recentActivities: {
                        action: 'credit_card_payment',
                        resource: 'financial_transaction',
                        timestamp: new Date(),
                        endpoint: '/api/checkout/credit-card'
                    }
                }
            }).catch(console.error);
        }
        res.json({
            success: true,
            status: result.status,
            status_detail: result.status_detail,
            orderId: orderId,
            mpPaymentId: result.id,
            paymentMethod: 'credit_card',
            installments: result.installments,
            cardInfo: {
                firstSix: result.card?.first_six_digits,
                lastFour: result.card?.last_four_digits,
                cardholder: result.card?.cardholder?.name
            },
            message: result.status === 'approved' ? 'Pagamento aprovado' : 'Pagamento em processamento'
        });
    }
    catch (err) {
        console.error('[CREDIT CARD ERROR] Erro ao processar pagamento:', err);
        console.log('[DEBUG] Detalhes do erro:', {
            message: err.message,
            status: err.status,
            responseStatus: err.response?.status,
            responseData: err.response?.data,
            error: err.error
        });
        // Tratamento específico para erros comuns do cartão
        if (err.response?.data) {
            const mpError = err.response.data;
            if (mpError.message?.includes('card_token')) {
                return res.status(400).json({
                    error: 'Token do cartão inválido',
                    details: 'Gere um novo token do cartão no frontend',
                    mpError: mpError
                });
            }
            if (mpError.message?.includes('insufficient')) {
                return res.status(400).json({
                    error: 'Saldo insuficiente',
                    details: 'Cartão sem limite disponível',
                    mpError: mpError
                });
            }
            if (mpError.message?.includes('invalid')) {
                return res.status(400).json({
                    error: 'Dados do cartão inválidos',
                    details: 'Verifique os dados do cartão',
                    mpError: mpError
                });
            }
        }
        res.status(500).json({
            error: 'Erro ao processar pagamento com cartão',
            details: err.message,
            mpError: err.response?.data
        });
    }
});
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
            $inc: { diamonds: order.diamonds },
            $push: {
                recentActivities: {
                    action: 'diamond_purchase_completed',
                    resource: 'financial_transaction',
                    timestamp: new Date(),
                    endpoint: '/api/checkout/confirm'
                }
            }
        }, { returnDocument: 'after' }));
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
