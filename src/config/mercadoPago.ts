import MercadoPagoConfig from 'mercadopago';
import { Payment } from 'mercadopago';

const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || '';

export const mpConfig = new MercadoPagoConfig({
  accessToken,
  options: {
    timeout: 10000,
  },
});

export const paymentClient = new Payment(mpConfig);
