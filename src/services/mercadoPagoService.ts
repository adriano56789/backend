import { paymentClient } from '../config/mercadoPago';

export interface WithdrawalRequest {
  amount: number;
  description: string;
  external_reference: string;
  payer_email: string;
}

export interface WithdrawalResponse {
  id: string;
  status: string;
  amount: number;
  date_created: string;
  date_approved?: string;
  transaction_amount: number;
  net_amount: number;
  fee_amount: number;
  external_reference?: string;
}

function calcNetAmount(payment: any): number {
  const fees = (payment.fee_details || []).reduce((sum: number, fee: any) => sum + (fee.amount || 0), 0);
  return (payment.transaction_amount || 0) - fees;
}

function toWithdrawalResponse(payment: any): WithdrawalResponse {
  return {
    id: String(payment.id),
    status: payment.status,
    amount: payment.transaction_amount,
    date_created: payment.date_created,
    date_approved: payment.date_approved,
    transaction_amount: payment.transaction_amount,
    net_amount: calcNetAmount(payment),
    fee_amount: (payment.transaction_amount || 0) - calcNetAmount(payment),
    external_reference: payment.external_reference,
  };
}

class MercadoPagoService {
  private accessToken: string;
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || '';
    this.clientId = process.env.MERCADO_PAGO_CLIENT_ID || '';
    this.clientSecret = process.env.MERCADO_PAGO_CLIENT_SECRET || '';
    const isProduction = !this.accessToken.startsWith('TEST-');
    console.log(`🔧 [MERCADO_PAGO] Modo: ${isProduction ? 'PRODUÇÃO' : 'TESTE'}`);
    console.log(`🔧 [MERCADO_PAGO] Access Token: ${this.accessToken.substring(0, 10)}...`);
  }

  async makeWithdrawal(request: WithdrawalRequest): Promise<WithdrawalResponse> {
    try {
      console.log(`💸 [MERCADO_PAGO] Iniciando saque:`);
      console.log(`   Valor: R$ ${request.amount.toFixed(2)}`);
      console.log(`   Email: ${request.payer_email}`);
      console.log(`   Ref: ${request.external_reference}`);

      const payment = await paymentClient.create({
        body: {
          transaction_amount: request.amount,
          description: request.description,
          payment_method_id: 'account_money',
          payer: { email: request.payer_email },
          external_reference: request.external_reference,
          statement_descriptor: 'LiveGo Saque',
          notification_url: process.env.NOTIFICATION_URL,
        },
        requestOptions: {
          idempotencyKey: `${request.external_reference}-${Date.now()}`,
        },
      });

      console.log(`✅ [MERCADO_PAGO] Saque criado: ID=${payment.id}, Status=${payment.status}`);
      return toWithdrawalResponse(payment);
    } catch (error: any) {
      console.error('❌ [MERCADO_PAGO] Erro no saque:', error.message);
      if (error.cause) console.error('   Cause:', error.cause);
      throw new Error(`Mercado Pago: ${error.message}`);
    }
  }

  async getPaymentStatus(paymentId: string): Promise<WithdrawalResponse> {
    try {
      const payment = await paymentClient.get({ id: paymentId });
      return toWithdrawalResponse(payment);
    } catch (error: any) {
      console.error('❌ [MERCADO_PAGO] Erro ao verificar status:', error.message);
      throw new Error('Falha ao verificar status do pagamento');
    }
  }

  async cancelPayment(paymentId: string): Promise<boolean> {
    try {
      await paymentClient.cancel({ id: paymentId });
      console.log(`✅ [MERCADO_PAGO] Pagamento ${paymentId} cancelado`);
      return true;
    } catch (error: any) {
      console.error('❌ [MERCADO_PAGO] Erro ao cancelar pagamento:', error.message);
      return false;
    }
  }

  isConfigured(): boolean {
    return !!(this.accessToken && this.clientId && this.clientSecret);
  }

  getConfigInfo() {
    const isProduction = !this.accessToken.startsWith('TEST-');
    return {
      isProduction,
      hasAccessToken: !!this.accessToken,
      hasClientId: !!this.clientId,
      hasClientSecret: !!this.clientSecret,
      accessTokenPrefix: this.accessToken.substring(0, 10) + '...',
    };
  }
}

export default new MercadoPagoService();
