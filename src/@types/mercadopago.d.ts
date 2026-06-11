declare module 'mercadopago' {
  class MercadoPagoConfig {
    constructor(options: { accessToken: string; options?: { timeout?: number } });
  }
  export default MercadoPagoConfig;

  export class Payment {
    constructor(config: MercadoPagoConfig);
    create(data: any): Promise<any>;
    get(options: { id: string }): Promise<any>;
    search(options?: any): Promise<any>;
    capture(id: string): Promise<any>;
    cancel(options: { id: string }): Promise<any>;
    refund(id: string, opts?: any): Promise<any>;
    update(id: string, data: any): Promise<any>;
  }

  export class WebhookSignatureValidator {
    static validate(request: any): any;
  }

  export class Preference {
    constructor(config: MercadoPagoConfig);
    create(data: any): Promise<any>;
    get(id: string): Promise<any>;
    update(id: string, data: any): Promise<any>;
  }

  export class MerchantOrder {
    constructor(config: MercadoPagoConfig);
    get(id: string): Promise<any>;
  }

  export class PaymentRefund {
    constructor(config: MercadoPagoConfig);
    create(paymentId: string, data?: any): Promise<any>;
  }
}
