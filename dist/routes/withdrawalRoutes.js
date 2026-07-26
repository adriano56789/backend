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
const socket_1 = require("../socket");
const auth_1 = require("../middleware/auth");
const rateLimit_1 = require("../middleware/rateLimit");
const env_1 = require("../config/env");
const router = express_1.default.Router();
// Endpoint para realizar saque via Pix (cash-out) do Mercado Pago
router.post('/pix', auth_1.protect, rateLimit_1.paymentRateLimit, async (req, res) => {
    try {
        const { userId, amount, pixKey, pixKeyType } = req.body;
        // Verificar se o userId do token corresponde
        if (req.user?.id !== userId) {
            return res.status(403).json({ error: 'Acesso negado: userId não corresponde ao token' });
        }
        console.log(`[WITHDRAWAL PIX] Iniciando saque: User=${userId}, Amount=${amount}, PixKey=${pixKey}`);
        // Validações básicas
        if (!userId || !amount || !pixKey || !pixKeyType) {
            return res.status(400).json({
                error: 'Dados incompletos',
                details: 'userId, amount, pixKey e pixKeyType são obrigatórios'
            });
        }
        if (amount < 5) {
            return res.status(400).json({
                error: 'Valor mínimo não atingido',
                details: 'O valor mínimo para saque é R$ 5,00'
            });
        }
        // Buscar usuário com projeção apenas para dados financeiros
        const user = await models_1.User.findOne({ id: userId }).select('id earnings withdrawal_method name email');
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        // Verificar se usuário tem saldo suficiente
        if (user.earnings < amount) {
            return res.status(400).json({
                error: 'Saldo insuficiente',
                details: `Saldo disponível: R$ ${user.earnings.toFixed(2)}`
            });
        }
        // Verificar método de saque configurado
        console.log(`[WITHDRAW] Debug - User withdrawal_method:`, JSON.stringify(user.withdrawal_method, null, 2));
        if (!user.withdrawal_method) {
            return res.status(400).json({
                error: 'Método de saque não configurado',
                details: 'Configure seu método de saque (Pix) no perfil'
            });
        }
        // Verificar se o método é Pix (case insensitive e null safe)
        const method = user.withdrawal_method.method;
        console.log(`[WITHDRAW] Debug - Extracted method:`, method, `Type:`, typeof method);
        if (!method || method.toString().toLowerCase() !== 'pix') {
            return res.status(400).json({
                error: 'Método de saque não suportado',
                details: `Método atual: ${method || 'não configurado'}. Use Pix.`
            });
        }
        // Inicializar SDK do Mercado Pago
        const { default: mercadopago } = require('mercadopago');
        if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
            console.error('[WITHDRAWAL ERROR] MERCADO_PAGO_ACCESS_TOKEN não configurado');
            return res.status(500).json({
                error: 'Erro de configuração',
                details: 'Token do Mercado Pago não configurado'
            });
        }
        const client = new mercadopago.MercadoPagoConfig({
            access_token: process.env.MERCADO_PAGO_ACCESS_TOKEN
        });
        // Para transferências, precisamos do cliente de transferências
        const transferClient = new mercadopago.Transfer(client);
        // Calcular valores (80% para streamer, 20% para app)
        const streamerAmount = amount * 0.8; // 80% para o streamer
        const appCommission = amount * 0.2; // 20% para o app
        console.log(`[WITHDRAWAL PIX] Distribuição: Streamer=R$ ${streamerAmount.toFixed(2)} (80%), App=R$ ${appCommission.toFixed(2)} (20%)`);
        // Criar transferência para o streamer (80%)
        const streamerTransferData = {
            amount: streamerAmount,
            description: `LiveGo - Pagamento para ${user.name || userId} (80% comissão)`,
            pix: {
                key: pixKey,
                key_type: pixKeyType
            }
        };
        // Realizar transferência para o streamer
        const streamerTransfer = await transferClient.create({
            body: streamerTransferData
        });
        console.log(`[WITHDRAWAL SUCCESS] Transferência streamer criada: ${streamerTransfer.id}`);
        // Criar transferência para o app (20% - comissão)
        const appTransferData = {
            amount: appCommission,
            description: `LiveGo - Comissão do app (20%) - Streamer: ${user.name || userId}`,
            pix: {
                key: env_1.ENV.APP_PIX_KEY,
                key_type: 'email'
            }
        };
        // Realizar transferência para o app
        const appTransfer = await transferClient.create({
            body: appTransferData
        });
        console.log(`[WITHDRAWAL SUCCESS] Transferência app criada: ${appTransfer.id}`);
        // Deduzir saldo total do usuário + persistir atividade
        const updatedUser = await models_1.User.findOneAndUpdate({ id: userId }, {
            $inc: { earnings: -amount },
            $set: {
                lastWithdrawalAt: new Date(),
                lastWithdrawalAmount: amount
            },
            $push: { recentActivities: { $each: [{
                            action: 'withdrawal',
                            resource: 'financial_operation',
                            timestamp: new Date(),
                            endpoint: '/api/withdrawals/pix'
                        }], $slice: -50 } }
        }, { returnDocument: 'after' });
        // AUDIT: saque realizado
        await models_1.PurchaseAuditTrail.create({
            eventType: 'diamonds_delivered',
            orderId: `pix_withdraw_${userId}_${Date.now()}`,
            userId,
            ip: req.ip || '',
            userAgent: (req.headers['user-agent'] || '').slice(0, 300),
            metadata: { amount, pixKey, pixKeyType, action: 'pix_withdrawal' }
        }).catch(() => { });
        // Registrar no histórico - transferência para o streamer
        const PurchaseRecord = (await Promise.resolve().then(() => __importStar(require('../models')))).PurchaseRecord;
        await PurchaseRecord.create({
            id: `withdrawal_streamer_${userId}_${Date.now()}`,
            userId: userId,
            type: 'withdrawal',
            description: `Saque via Pix - R$ ${streamerAmount.toFixed(2)} (80%) - Transferência: ${streamerTransfer.id}`,
            amountBRL: -streamerAmount,
            amountCoins: 0,
            status: 'Processando',
            metadata: {
                transferId: streamerTransfer.id,
                pixKey: pixKey,
                pixKeyType: pixKeyType,
                commissionType: 'streamer_payment',
                percentage: 80
            }
        });
        // Registrar no histórico - comissão do app
        await PurchaseRecord.create({
            id: `withdrawal_app_${userId}_${Date.now()}`,
            userId: 'system_app', // ID do sistema para comissões
            type: 'commission',
            description: `Comissão do app (20%) - Streamer: ${user.name || userId} - Transferência: ${appTransfer.id}`,
            amountBRL: appCommission,
            amountCoins: 0,
            status: 'Processando',
            metadata: {
                transferId: appTransfer.id,
                streamerId: userId,
                streamerName: user.name,
                commissionType: 'app_commission',
                percentage: 20
            }
        });
        // Emitir WebSocket para atualizar frontend em tempo real
        const io = (0, socket_1.getIO)();
        if (io) {
            io.to(userId).emit('withdrawal_processed', {
                userId,
                totalAmount: amount,
                streamerAmount: streamerAmount,
                appCommission: appCommission,
                newBalance: updatedUser?.earnings || 0,
                transferId: streamerTransfer.id,
                status: 'processing'
            });
            // Também emitir earnings_updated para compatibilidade
            io.to(userId).emit('earnings_updated', {
                userId,
                available_diamonds: 0, // Saque zera diamantes disponíveis
                brl_value: updatedUser?.earnings || 0
            });
        }
        res.json({
            success: true,
            transferId: streamerTransfer.id,
            totalAmount: amount,
            streamerAmount: streamerAmount,
            appCommission: appCommission,
            status: 'processing',
            message: `Saque de R$ ${streamerAmount.toFixed(2)} iniciado com sucesso (80% do valor total). O dinheiro será transferido para sua conta Pix em até 1 dia útil.`,
            newBalance: updatedUser?.earnings || 0
        });
    }
    catch (error) {
        console.error('[WITHDRAWAL ERROR] Erro ao processar saque:', error);
        // Se for erro do Mercado Pago, retornar mensagem específica
        if (error.response && error.response.data) {
            return res.status(400).json({
                error: 'Erro na transferência',
                details: error.response.data.message || 'Erro ao processar transferência via Pix'
            });
        }
        res.status(500).json({
            error: 'Erro interno',
            message: 'Não foi possível processar o saque. Tente novamente.'
        });
    }
});
// Endpoint para consultar status da transferência
router.get('/status/:transferId', async (req, res) => {
    try {
        const { transferId } = req.params;
        const mercadopago = require('mercadopago');
        mercadopago.configure({
            access_token: process.env.MERCADO_PAGO_ACCESS_TOKEN
        });
        const transfer = await mercadopago.transfer.findById(transferId);
        res.json({
            success: true,
            transfer: transfer.body
        });
    }
    catch (error) {
        console.error('[WITHDRAWAL STATUS ERROR] Erro ao consultar status:', error);
        res.status(500).json({
            error: 'Erro ao consultar status',
            message: 'Não foi possível obter o status da transferência'
        });
    }
});
// Endpoint para listar saques do usuário
router.get('/history/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 10, offset = 0 } = req.query;
        const PurchaseRecord = (await Promise.resolve().then(() => __importStar(require('../models')))).PurchaseRecord;
        const withdrawals = await PurchaseRecord.find({
            userId: userId,
            type: 'withdrawal'
        })
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(offset));
        const total = await PurchaseRecord.countDocuments({
            userId: userId,
            type: 'withdrawal'
        });
        res.json({
            success: true,
            withdrawals,
            total,
            hasMore: (parseInt(offset) + withdrawals.length) < total
        });
    }
    catch (error) {
        console.error('[WITHDRAWAL HISTORY ERROR] Erro ao buscar histórico:', error);
        res.status(500).json({
            error: 'Erro ao buscar histórico',
            message: 'Não foi possível carregar o histórico de saques'
        });
    }
});
exports.default = router;
