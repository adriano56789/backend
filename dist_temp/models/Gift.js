"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Gift = void 0;
var mongoose_1 = require("mongoose");
var GiftSchema = new mongoose_1.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    icon: { type: String, required: true },
    category: {
        type: String,
        enum: ['Popular', 'Luxo', 'Atividade', 'VIP', 'Efeito', 'Entrada'],
        required: true
    },
    videoUrl: { type: String },
    triggersAutoFollow: { type: Boolean, default: false }
}, { timestamps: true });
exports.Gift = mongoose_1.default.model('Gift', GiftSchema);
