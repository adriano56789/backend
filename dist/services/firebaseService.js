"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initFirebase = initFirebase;
exports.getFirebaseMessaging = getFirebaseMessaging;
exports.sendPushNotification = sendPushNotification;
exports.sendPushNotificationToMultiple = sendPushNotificationToMultiple;
const app_1 = require("firebase-admin/app");
const messaging_1 = require("firebase-admin/messaging");
const env_1 = require("../config/env");
// ═══════════════════════════════════════════════════════════════════════
// REGRA: Firebase/FCM envia a notificação PUSH na tela (title + body). Por
// padrão NENHUM campo de imagem/avatar/ícone trafega nos dados (data) — para
// o push de "início de live" é enviado UM campo `image` (Big Picture) apenas
// no notification.webpush.notification.image / notification.image, usado pelo
// service worker para exibir a imagem grande (como nos grandes apps).
// ═══════════════════════════════════════════════════════════════════════
const IMAGE_LIKE_FIELD = /(avatar|image|icon|photo|picture|cover|thumb)/i;
function sanitizeData(data) {
    if (!data)
        return {};
    const clean = {};
    for (const [key, value] of Object.entries(data)) {
        // Remove chaves de imagem/avatar/ícone (nunca trafegam no push)
        if (IMAGE_LIKE_FIELD.test(key))
            continue;
        // Remove valores que são URLs de imagem (defesa extra)
        if (typeof value === 'string' && /^(https?:)?\/\/.*\.(png|jpe?g|gif|webp|svg|ico|avif)([?#]|$)/i.test(value))
            continue;
        clean[key] = value;
    }
    return clean;
}
function buildNotification(payload) {
    const notification = {
        title: payload.title,
        body: payload.body,
    };
    if (payload.image) {
        notification.image = payload.image;
    }
    return notification;
}
let firebaseApp = null;
let firebaseMessaging = null;
function initFirebase() {
    try {
        firebaseApp = (0, app_1.getApp)();
    }
    catch {
        // App not initialized yet
    }
    if (firebaseApp)
        return firebaseApp;
    const projectId = env_1.ENV.FIREBASE_PROJECT_ID;
    const privateKey = env_1.ENV.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = env_1.ENV.FIREBASE_CLIENT_EMAIL;
    if (!projectId || !privateKey || !clientEmail) {
        console.warn('[FIREBASE] Credenciais não configuradas. Notificações push desabilitadas.');
        return null;
    }
    try {
        firebaseApp = (0, app_1.initializeApp)({
            credential: (0, app_1.cert)({ projectId, privateKey, clientEmail }),
        });
        firebaseMessaging = (0, messaging_1.getMessaging)(firebaseApp);
        console.log('[FIREBASE] Admin SDK inicializado com sucesso.');
        return firebaseApp;
    }
    catch (error) {
        console.error('[FIREBASE] Erro ao inicializar:', error.message);
        return null;
    }
}
function getFirebaseMessaging() {
    if (firebaseMessaging)
        return firebaseMessaging;
    const app = initFirebase();
    if (!app)
        return null;
    firebaseMessaging = (0, messaging_1.getMessaging)(app);
    return firebaseMessaging;
}
async function sendPushNotification(token, payload) {
    const messaging = getFirebaseMessaging();
    if (!messaging) {
        console.warn('[FCM] Firebase não inicializado, ignorando notificação.');
        return null;
    }
    try {
        const message = {
            token,
            notification: buildNotification(payload),
            data: sanitizeData(payload.data),
        };
        if (payload.image) {
            // Big Picture — imagem grande do push (padrão Web Push)
            message.webpush = { notification: { image: payload.image } };
        }
        const response = await messaging.send(message);
        console.log('[FCM] Notificação enviada com sucesso:', response);
        return response;
    }
    catch (error) {
        if (error.code === 'messaging/registration-token-not-registered') {
            console.warn('[FCM] Token não registrado, removendo:', token);
        }
        else {
            console.error('[FCM] Erro ao enviar notificação:', error.message);
        }
        return null;
    }
}
async function sendPushNotificationToMultiple(tokens, payload) {
    const messaging = getFirebaseMessaging();
    if (!messaging) {
        console.warn('[FCM] Firebase não inicializado, ignorando notificação multicast.');
        return [];
    }
    try {
        const message = {
            tokens,
            notification: buildNotification(payload),
            data: sanitizeData(payload.data),
        };
        if (payload.image) {
            // Big Picture — imagem grande do push (padrão Web Push)
            message.webpush = { notification: { image: payload.image } };
        }
        const response = await messaging.sendEachForMulticast(message);
        console.log(`[FCM] Notificação enviada para ${response.successCount} dispositivos, ${response.failureCount} falhas.`);
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
            if (!resp.success) {
                failedTokens.push({ token: tokens[idx], error: resp.error?.code || 'unknown' });
            }
        });
        return failedTokens;
    }
    catch (error) {
        console.error('[FCM] Erro ao enviar notificação multicast:', error.message);
        return [];
    }
}
