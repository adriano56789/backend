"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPlatformConfigured = exports.getPlatformRecipient = exports.isConfigured = exports.getEnvironment = exports.LIVEGO_FEES = void 0;
exports.registerRecipient = registerRecipient;
exports.createPayout = createPayout;
exports.getPayoutStatus = getPayoutStatus;
exports.createPlatformFeePayout = createPlatformFeePayout;
exports.buildQuote = buildQuote;
exports.createDepositSession = createDepositSession;
const axios_1 = __importDefault(require("axios"));
const currencyService_1 = require("./currencyService");
/**
 * ═══════════════════════════════════════════════════════════════
 *  PAYONEER SERVICE — Único provedor de pagamentos/saques LiveGo
 * ═══════════════════════════════════════════════════════════════
 *  Payoneer cobre tudo: Pix (BRL), conta bancária internacional
 *  (USD) e local europeia (EUR), com conversão de moeda feita
 *  pela própria plataforma.
 *
 *  CREDENCIAIS: basta preencher no .env da VPS quando a conta/
 *  empresa Payoneer existir — NADA mais precisa ser reescrito:
 *    PAYONEER_CLIENT_ID       → OAuth2 client id
 *    PAYONEER_CLIENT_SECRET   → OAuth2 client secret
 *    PAYONEER_PROGRAM_ID      → program id do parceiro
 *    PAYONEER_ENVIRONMENT     → sandbox | production
 *    PAYONEER_WEBHOOK_SECRET  → validação de webhooks
 *
 *  API docs: https://www.payoneer.com/docs/payouts (MassPayouts REST v2)
 */
const PAYONEER_API = {
    sandbox: 'https://api.sandbox.payoneer.com/v2',
    production: 'https://api.payoneer.com/v2',
};
// ─── Taxas LiveGo (transparentes para o criador antes do saque) ───
exports.LIVEGO_FEES = {
    /** Comissão da plataforma sobre o bruto em diamantes */
    PLATFORM_FEE_PCT: 0.20,
    /** Taxa fixa Payoneer por payout (em BRL) */
    PAYONEER_FIXED_BRL: 2.00,
    /** Taxa variável Payoneer sobre o líquido */
    PAYONEER_PCT: 0.02,
    /** Saque mínimo em diamantes */
    MIN_DIAMONDS: 5,
};
let cachedToken = null;
const getClientId = () => process.env.PAYONEER_CLIENT_ID || '';
const getClientSecret = () => process.env.PAYONEER_CLIENT_SECRET || '';
const getEnvironment = () => (process.env.PAYONEER_ENVIRONMENT === 'production' ? 'production' : 'sandbox');
exports.getEnvironment = getEnvironment;
/** Serviço configurado com credenciais reais? */
const isConfigured = () => Boolean(getClientId() && getClientSecret());
exports.isConfigured = isConfigured;
const baseUrl = () => PAYONEER_API[(0, exports.getEnvironment)()];
/** OAuth2 client_credentials — token em cache até expirar (60s de margem) */
async function getAccessToken() {
    if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
        return cachedToken.token;
    }
    const auth = Buffer.from(`${getClientId()}:${getClientSecret()}`).toString('base64');
    const { data } = await axios_1.default.post(`${baseUrl()}/token`, 'grant_type=client_credentials', {
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 15000,
    });
    cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    console.log(`[PAYONEER] Token obtido (${(0, exports.getEnvironment)()}), expira em ${data.expires_in}s`);
    return cachedToken.token;
}
async function payoneerRequest(method, path, body) {
    const token = await getAccessToken();
    const { data } = await axios_1.default.request({
        method,
        url: `${baseUrl()}${path}`,
        data: body,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        timeout: 30000,
    });
    return data;
}
/**
 * Registrar beneficiário (criador) na conta Payoneer do parceiro.
 * payoutMethod: PIX (BRL) | BANK_USD | BANK_EUR | PAYONEER_ACCOUNT
 */
async function registerRecipient(params) {
    const body = {
        program_id: process.env.PAYONEER_PROGRAM_ID,
        reference: `livego_${params.userId}`,
        first_name: params.name?.split(' ')[0] || 'LiveGo',
        last_name: params.name?.split(' ').slice(1).join(' ') || 'Creator',
        email: params.email,
        payout_method: params.payoutMethod,
        payout_details: params.details,
    };
    const res = await payoneerRequest('post', '/recipients', body);
    return { recipientId: res.recipient_id || res.id || '', status: res.status || 'PENDING' };
}
/** Criar instrução de pagamento (payout) para um beneficiário */
async function createPayout(params) {
    const body = {
        program_id: process.env.PAYONEER_PROGRAM_ID,
        recipient_reference: params.recipientReference,
        payout_method: params.payoutMethod || (params.currency === 'BRL'
            ? 'PIX'
            : params.currency === 'EUR' ? 'BANK_EUR' : 'BANK_USD'),
        amount: Number(params.amountLocal.toFixed(2)),
        currency: params.currency,
        description: params.description.slice(0, 140),
        metadata: { source: 'livego', user_id: params.userId },
    };
    const res = await payoneerRequest('post', '/payouts', body);
    return { payoutId: res.payout_id || res.client_reference_id || '', status: res.status || 'PENDING' };
}
/** Consultar status de um payout já criado */
async function getPayoutStatus(payoutId) {
    return payoneerRequest('get', `/payouts/${encodeURIComponent(payoutId)}`);
}
/**
 * Referência do beneficiário do DONO da plataforma (recebe os 20% de cada saque).
 * Configure no .env: PAYONEER_PLATFORM_RECIPIENT (referência do beneficiário)
 * ou PAYONEER_PLATFORM_EMAIL (e-mail da conta Payoneer do dono).
 */
const getPlatformRecipient = () => process.env.PAYONEER_PLATFORM_RECIPIENT ||
    (process.env.PAYONEER_PLATFORM_EMAIL ? `livego_platform_${process.env.PAYONEER_PLATFORM_EMAIL}` : '') ||
    'livego_platform_owner';
exports.getPlatformRecipient = getPlatformRecipient;
/** A conta do dono está configurada para receber a taxa? */
const isPlatformConfigured = () => Boolean(process.env.PAYONEER_PLATFORM_RECIPIENT || process.env.PAYONEER_PLATFORM_EMAIL);
exports.isPlatformConfigured = isPlatformConfigured;
/**
 * Enviar os 20% da taxa da plataforma para a conta Payoneer DO DONO.
 * Chamado automaticamente em CADA saque — divisão na hora, sem enrolação.
 * O Payoneer converte BRL → moeda da conta do dono.
 */
async function createPlatformFeePayout(params) {
    return createPayout({
        userId: 'platform_owner',
        recipientReference: (0, exports.getPlatformRecipient)(),
        // O payout é sempre na moeda da conta destino; BRL aqui e o Payoneer converte
        amountLocal: params.amountBRL,
        currency: 'BRL',
        payoutMethod: 'PAYONEER_ACCOUNT',
        description: params.description,
    });
}
/**
 * Pré-visualização completa e transparente do saque:
 * bruto → taxa plataforma (20%) → taxas Payoneer → valor final na moeda local.
 * Conversão de moeda é responsabilidade do Payoneer; usamos a cotação
 * apenas como ESTIMATIVA exibida ao criador.
 */
async function buildQuote(diamonds, currency) {
    const grossBRL = diamonds * 0.00875; // conversão diamante → BRL
    const platformFeeBRL = grossBRL * exports.LIVEGO_FEES.PLATFORM_FEE_PCT;
    const afterPlatformBRL = grossBRL - platformFeeBRL;
    const payoneerFeeBRL = Math.min(afterPlatformBRL, afterPlatformBRL * exports.LIVEGO_FEES.PAYONEER_PCT + exports.LIVEGO_FEES.PAYONEER_FIXED_BRL);
    const netBRL = Math.max(0, afterPlatformBRL - payoneerFeeBRL);
    // Estimativa de câmbio (o valor final é convertido pelo Payoneer)
    const rate = await (0, currencyService_1.convertBRL)(1, currency).catch(() => null);
    const fxRate = currency === 'BRL' ? 1 : Math.max(rate || 0, 0);
    // Conversão SEMPRE proporcional — nunca zera os valores por causa do líquido
    const toLocal = (brl) => brl * fxRate;
    const covered = netBRL > 0;
    return {
        diamonds,
        currency,
        fees_covered: covered,
        gross_brl: round2(grossBRL),
        platform_fee_brl: round2(platformFeeBRL),
        platform_fee_pct: exports.LIVEGO_FEES.PLATFORM_FEE_PCT * 100,
        payoneer_fee_brl: round2(payoneerFeeBRL),
        payoneer_fee_pct: exports.LIVEGO_FEES.PAYONEER_PCT * 100,
        payoneer_fee_fixed_brl: exports.LIVEGO_FEES.PAYONEER_FIXED_BRL,
        net_brl: round2(netBRL),
        estimated_fx_rate: fxRate ? Number(fxRate.toFixed(6)) : null,
        local_gross: round2(toLocal(grossBRL)),
        local_platform_fee: round2(toLocal(platformFeeBRL)),
        local_payoneer_fee: round2(toLocal(payoneerFeeBRL)),
        local_net: round2(toLocal(netBRL)),
        note: !covered
            ? 'Valor abaixo das taxas mínimas — solicite um saque maior.'
            : currency === 'BRL'
                ? 'A taxa de processamento do Payoneer é descontada do seu saque — a plataforma não paga nada.'
                : 'A taxa do Payoneer é sua (descontada acima). O valor final é convertido pelo Payoneer na hora do saque.',
    };
}
/**
 * ═══ DEPÓSITOS (dinheiro ENTRANDO no app) — via Payoneer Checkout ═══
 * Toda compra de diamantes passa por aqui. Com as credenciais da empresa
 * no .env, cria uma sessão de pagamento hospedada no Payoneer — o usuário
 * paga (cartão/Pix local conforme país) e o dinheiro cai na conta Payoneer
 * da plataforma. NADA mais precisa ser reescrito.
 */
async function createDepositSession(params) {
    const body = {
        program_id: process.env.PAYONEER_PROGRAM_ID,
        reference: `livego_dep_${params.userId}_${Date.now()}`,
        amount: Number(params.amountBRL.toFixed(2)),
        currency: 'BRL',
        description: (params.description || `LiveGo — ${params.diamonds} diamantes`).slice(0, 140),
        return_url: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/wallet` : undefined,
        cancel_url: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/shop` : undefined,
        metadata: { source: 'livego', user_id: params.userId, diamonds: params.diamonds },
    };
    const res = await payoneerRequest('post', '/checkout/sessions', body);
    return {
        sessionId: res.session_id || res.id || '',
        redirectUrl: res.redirect_url || res.payment_page_url || null,
        raw: res,
    };
}
const round2 = (n) => Math.round(n * 100) / 100;
exports.default = {
    isConfigured: exports.isConfigured,
    getEnvironment: exports.getEnvironment,
    isPlatformConfigured: exports.isPlatformConfigured,
    getPlatformRecipient: exports.getPlatformRecipient,
    registerRecipient,
    createPayout,
    createPlatformFeePayout,
    getPayoutStatus,
    createDepositSession,
    buildQuote,
    LIVEGO_FEES: exports.LIVEGO_FEES,
};
