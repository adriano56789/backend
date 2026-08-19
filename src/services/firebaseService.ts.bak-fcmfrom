import { initializeApp, cert, getApp, App } from 'firebase-admin/app';
import { getMessaging, Messaging, Message, MulticastMessage } from 'firebase-admin/messaging';
import { ENV } from '../config/env';

// ═══════════════════════════════════════════════════════════════════════
// REGRA: Firebase/FCM envia a notificação PUSH na tela (title + body). Por
// padrão NENHUM campo de imagem/avatar/ícone trafega nos dados (data) — para
// o push de "início de live" é enviado UM campo `image` (Big Picture) apenas
// no notification.webpush.notification.image / notification.image, usado pelo
// service worker para exibir a imagem grande (como nos grandes apps).
// ═══════════════════════════════════════════════════════════════════════
const IMAGE_LIKE_FIELD = /(avatar|image|icon|photo|picture|cover|thumb)/i;

function sanitizeData(data?: Record<string, string>): Record<string, string> {
  if (!data) return {};
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    // Remove chaves de imagem/avatar/ícone (nunca trafegam no push)
    if (IMAGE_LIKE_FIELD.test(key)) continue;
    // Remove valores que são URLs de imagem (defesa extra)
    if (typeof value === 'string' && /^(https?:)?\/\/.*\.(png|jpe?g|gif|webp|svg|ico|avif)([?#]|$)/i.test(value)) continue;
    clean[key] = value;
  }
  return clean;
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  /** Imagem grande (Big Picture) exibida no push — apenas Web push. */
  image?: string;
}

function buildNotification(payload: PushPayload) {
  const notification: any = {
    title: payload.title,
    body: payload.body,
  };
  if (payload.image) {
    notification.image = payload.image;
  }
  return notification;
}

let firebaseApp: App | null = null;
let firebaseMessaging: Messaging | null = null;

export function initFirebase() {
  try {
    firebaseApp = getApp();
  } catch {
    // App not initialized yet
  }

  if (firebaseApp) return firebaseApp;

  const projectId = ENV.FIREBASE_PROJECT_ID;
  const privateKey = ENV.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = ENV.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    console.warn('[FIREBASE] Credenciais não configuradas. Notificações push desabilitadas.');
    return null;
  }

  try {
    firebaseApp = initializeApp({
      credential: cert({ projectId, privateKey, clientEmail }),
    });
    firebaseMessaging = getMessaging(firebaseApp);
    console.log('[FIREBASE] Admin SDK inicializado com sucesso.');
    return firebaseApp;
  } catch (error: any) {
    console.error('[FIREBASE] Erro ao inicializar:', error.message);
    return null;
  }
}

export function getFirebaseMessaging() {
  if (firebaseMessaging) return firebaseMessaging;
  const app = initFirebase();
  if (!app) return null;
  firebaseMessaging = getMessaging(app);
  return firebaseMessaging;
}

export async function sendPushNotification(
  token: string,
  payload: PushPayload
) {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    console.warn('[FCM] Firebase não inicializado, ignorando notificação.');
    return null;
  }

  try {
    const message: Message = {
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
  } catch (error: any) {
    if (error.code === 'messaging/registration-token-not-registered') {
      console.warn('[FCM] Token não registrado, removendo:', token);
    } else {
      console.error('[FCM] Erro ao enviar notificação:', error.message);
    }
    return null;
  }
}

export async function sendPushNotificationToMultiple(
  tokens: string[],
  payload: PushPayload
) {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    console.warn('[FCM] Firebase não inicializado, ignorando notificação multicast.');
    return [];
  }

  try {
    const message: MulticastMessage = {
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

    const failedTokens: { token: string; error: string }[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        failedTokens.push({ token: tokens[idx], error: resp.error?.code || 'unknown' });
      }
    });

    return failedTokens;
  } catch (error: any) {
    console.error('[FCM] Erro ao enviar notificação multicast:', error.message);
    return [];
  }
}
