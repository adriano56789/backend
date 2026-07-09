// @ts-ignore - local mercadopago SDK
const MercadoPagoConfig: any = require('mercadopago').default || require('mercadopago');
// @ts-ignore
const { Payment } = require('mercadopago');

const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || '';

export const mpConfig = new MercadoPagoConfig({
  accessToken,
  options: {
    timeout: 10000,
  },
});

export const paymentClient = new Payment(mpConfig);
