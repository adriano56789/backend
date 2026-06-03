"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentClient = exports.mpConfig = void 0;
const mercadopago_1 = __importDefault(require("mercadopago"));
const mercadopago_2 = require("mercadopago");
const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || '';
exports.mpConfig = new mercadopago_1.default({
    accessToken,
    options: {
        timeout: 10000,
    },
});
exports.paymentClient = new mercadopago_2.Payment(exports.mpConfig);
