"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiftTransaction = void 0;
var mongoose_1 = require("mongoose");
var GiftTransactionSchema = new mongoose_1.Schema({
    id: { type: String, required: true, unique: true },
    fromUserId: { type: String, required: true, index: true },
    fromUserName: { type: String },
    fromUserAvatar: { type: String },
    toUserId: { type: String, required: true, index: true },
    toUserName: { type: String },
    streamId: { type: String, required: true, index: true },
    giftId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Gift', required: true },
    giftName: { type: String, required: true },
    giftIcon: { type: String, required: true },
    giftPrice: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    totalValue: { type: Number, required: true },
    transactionHash: { type: String, index: true }
}, { timestamps: true });
exports.GiftTransaction = mongoose_1.default.model('GiftTransaction', GiftTransactionSchema);
