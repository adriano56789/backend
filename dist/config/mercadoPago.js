"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentClient = exports.mpConfig = void 0;
// @ts-ignore - local mercadopago SDK
const MercadoPagoConfig = require('mercadopago').default || require('mercadopago');
// @ts-ignore
const { Payment } = require('mercadopago');
const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || '';
exports.mpConfig = new MercadoPagoConfig({
    accessToken,
    options: {
        timeout: 10000,
    },
});
exports.paymentClient = new Payment(exports.mpConfig);
