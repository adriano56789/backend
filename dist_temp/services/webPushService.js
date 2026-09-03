"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initWebPush = initWebPush;
exports.getPublicKey = getPublicKey;
exports.sendPushNotificationToMultiple = sendPushNotificationToMultiple;
const web_push_1 = __importDefault(require("web-push"));
const env_1 = require("../config/env");
// ═══════════════════════════════════════════════════════════════════════════
// Web Push NATIVO (protocolo Web Push + VAPID) — sem Firebase, sem Google.
//
// O backend fala DIRETO com o push service do navegador usando a biblioteca
// `web-push`. As chaves VAPID são geradas localmente (npx web-push
// generate-vapid-keys) e as assinaturas dos dispositivos ficam salvas no
// MongoDB (DeviceToken.token = JSON da subscription PushSubscription).
//
// Payload enviado (JSON): { title, body, tag?, image?, data? }
// O Service Worker do frontend recebe o evento 'push' e monta a notificação.
// ═══════════════════════════════════════════════════════════════════════════
let vapidConfigured = false;
function initWebPush() {
    if (vapidConfigured)
        return true;
    const publicKey = env_1.ENV.VAPID_PUBLIC_KEY;
    const privateKey = env_1.ENV.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) {
        console.warn('[WEB-PUSH] Chaves VAPID não configuradas. Notificações push desabilitadas.');
        return false;
    }
    try {
        web_push_1.default.setVapidDetails(env_1.ENV.VAPID_SUBJECT || 'mailto:admin@livego.store', publicKey, privateKey);
        vapidConfigured = true;
        console.log('[WEB-PUSH] VAPID configurado — push nativo ativo.');
        return true;
    }
    catch (error) {
        console.error('[WEB-PUSH] Erro ao configurar VAPID:', error.message);
        return false;
    }
}
function getPublicKey() {
    return env_1.ENV.VAPID_PUBLIC_KEY || '';
}
/**
 * Envia o mesmo payload para uma lista de subscriptions (JSON strings).
 * Assinaturas expiradas/inválidas (404/410) voltam na lista de falhas para o
 * chamador remover do banco.
 */
async function sendPushNotificationToMultiple(subscriptionJsonList, payload) {
    if (!initWebPush())
        return [];
    if (!subscriptionJsonList.length)
        return [];
    const body = JSON.stringify({
        title: payload.title,
        body: payload.body,
        image: payload.image || undefined,
        data: payload.data || {},
    });
    // Envia em paralelo com limite prático por lotes para não estourar sockets
    const failed = [];
    const CHUNK_SIZE = 100;
    for (let i = 0; i < subscriptionJsonList.length; i += CHUNK_SIZE) {
        const chunk = subscriptionJsonList.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (json) => {
            try {
                let sub = json;
                if (typeof sub === 'string') {
                    const trimmed = sub.trim();
                    if (!trimmed.startsWith('{')) {
                        // Token legado/inválido (ex.: restos de FCM) → marca para remoção
                        failed.push({ token: json, error: 'invalid subscription' });
                        return;
                    }
                    sub = JSON.parse(trimmed);
                }
                if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
                    failed.push({ token: json, error: 'invalid subscription' });
                    return;
                }
                await web_push_1.default.sendNotification(sub, body);
            }
            catch (err) {
                const status = err?.statusCode;
                // 404/410 = inscrição sumiu/expirou → remove; outros erros só logam
                if (status === 404 || status === 410) {
                    failed.push({ token: json, error: `expired (${status})` });
                }
                else {
                    console.warn('[WEB-PUSH] Falha ao enviar:', err?.message || err);
                }
            }
        }));
    }
    return failed;
}
