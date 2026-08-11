import axios from 'axios';

// Moedas aceitas pela plataforma (somente estas três)
export const SUPPORTED_CURRENCIES = ['BRL', 'EUR', 'USD'] as const;
export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

// Mapa país (código ISO minúsculo) → moeda de saque
export const COUNTRY_CURRENCY_MAP: Record<string, SupportedCurrency> = {
    br: 'BRL',
    pt: 'EUR',
    us: 'USD',
};

export const DEFAULT_CURRENCY: SupportedCurrency = 'BRL';

// Taxas de fallback (1 unidade = quanto vale em BRL) usadas caso a API esteja indisponível
const FALLBACK_RATES: Record<SupportedCurrency, number> = {
    BRL: 1,
    EUR: 6.20,
    USD: 5.60,
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

let cachedRates: { rates: Record<SupportedCurrency, number>; updatedAt: Date; source: 'live' | 'fallback' } | null = null;

export const getCurrencyForCountry = (country?: string): SupportedCurrency => {
    const code = (country || '').trim().toLowerCase();
    return COUNTRY_CURRENCY_MAP[code] || DEFAULT_CURRENCY;
};

/**
 * Buscar taxas de câmbio em tempo real (1 unidade de cada moeda em BRL).
 * Usa open.er-api.com (base BRL, sem chave). Cache de 1h com fallback fixo.
 */
export const getExchangeRates = async (): Promise<{ rates: Record<SupportedCurrency, number>; updatedAt: Date; source: 'live' | 'fallback' }> => {
    if (cachedRates && Date.now() - cachedRates.updatedAt.getTime() < CACHE_TTL_MS) {
        return cachedRates;
    }

    try {
        const { data } = await axios.get('https://open.er-api.com/v6/latest/BRL', { timeout: 8000 });

        if (data && data.result === 'success' && data.rates) {
            const rates: Record<SupportedCurrency, number> = {
                BRL: 1,
                EUR: data.rates.EUR ?? FALLBACK_RATES.EUR,
                USD: data.rates.USD ?? FALLBACK_RATES.USD,
            };
            cachedRates = { rates, updatedAt: new Date(), source: 'live' };
            console.log(`[CURRENCY] Taxas atualizadas (live): EUR=${rates.EUR.toFixed(4)}, USD=${rates.USD.toFixed(4)}`);
            return cachedRates;
        }
    } catch (error: any) {
        console.warn(`[CURRENCY] Falha ao buscar taxas (usando fallback): ${error?.message || 'erro desconhecido'}`);
    }

    const rates = { ...FALLBACK_RATES };
    cachedRates = { rates, updatedAt: new Date(), source: 'fallback' };
    return cachedRates;
};

/**
 * Converter um valor em BRL para a moeda de destino.
 */
export const convertBRL = async (brl: number, toCurrency: SupportedCurrency): Promise<number> => {
    if (brl <= 0) return 0;
    if (toCurrency === 'BRL') return Math.round(brl * 100) / 100;

    const { rates } = await getExchangeRates();
    const value = brl * rates[toCurrency];
    return Math.round(value * 100) / 100;
};

/**
 * Converter diamantes → valores em todas as moedas suportadas (bruto, taxa e líquido).
 */
export const calculateMultiCurrency = async (diamonds: number, brlValue: number) => {
    const { rates, source } = await getExchangeRates();
    const platformFee = brlValue * 0.20;

    const currencies: SupportedCurrency[] = ['BRL', 'EUR', 'USD'];
    const byCurrency: Record<SupportedCurrency, { gross: number; fee: number; net: number }> = {
        BRL: { gross: Math.round(brlValue * 100) / 100, fee: Math.round(platformFee * 100) / 100, net: Math.round((brlValue - platformFee) * 100) / 100 },
        EUR: { gross: 0, fee: 0, net: 0 },
        USD: { gross: 0, fee: 0, net: 0 },
    };

    for (const currency of currencies) {
        if (currency === 'BRL') continue;
        byCurrency[currency] = {
            gross: Math.round(brlValue * rates[currency] * 100) / 100,
            fee: Math.round(platformFee * rates[currency] * 100) / 100,
            net: Math.round((brlValue - platformFee) * rates[currency] * 100) / 100,
        };
    }

    return {
        rates,
        rateSource: source,
        diamonds,
        byCurrency,
    };
};

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
    BRL: 'R$',
    EUR: '€',
    USD: 'US$',
};

export const formatCurrency = (value: number, currency: SupportedCurrency): string => {
    const symbol = CURRENCY_SYMBOLS[currency];
    const formatted = value.toFixed(2).replace('.', ',');
    return `${symbol} ${formatted}`;
};
