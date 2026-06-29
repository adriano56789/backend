"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseRecord = void 0;
var mongoose_1 = require("mongoose");
var PurchaseRecordSchema = new mongoose_1.Schema({
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    type: {
        type: String,
        required: true,
        enum: ['purchase_diamonds', 'withdraw_earnings', 'withdraw_platform_earnings', 'purchase_frame', 'platform_fee_income', 'withdrawal', 'commission']
    },
    description: { type: String, required: true },
    amountBRL: { type: Number, required: true },
    amountCoins: { type: Number, default: 0 },
    status: {
        type: String,
        required: true,
        enum: ['Concluído', 'Pendente', 'Cancelado', 'Processando', 'Aprovado', 'Recusado'],
        default: 'Pendente'
    },
    externalReference: { type: String, index: true },
    paymentId: { type: String, index: true },
    metadata: { type: mongoose_1.Schema.Types.Mixed }
}, { timestamps: true });
exports.PurchaseRecord = mongoose_1.default.model('PurchaseRecord', PurchaseRecordSchema);
