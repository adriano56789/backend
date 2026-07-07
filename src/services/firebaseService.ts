import { initializeApp, cert, getApp, App } from 'firebase-admin/app';
import { getMessaging, Messaging, Message, MulticastMessage } from 'firebase-admin/messaging';
import { ENV } from '../config/env';

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
  payload: { title: string; body: string; data?: Record<string, string>; imageUrl?: string }
) {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    console.warn('[FCM] Firebase não inicializado, ignorando notificação.');
    return null;
  }

  try {
    const message: Message = {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
    };

    if (payload.imageUrl) {
      message.notification = { ...message.notification, imageUrl: payload.imageUrl };
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
  payload: { title: string; body: string; data?: Record<string, string>; imageUrl?: string }
) {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    console.warn('[FCM] Firebase não inicializado, ignorando notificação multicast.');
    return [];
  }

  try {
    const message: MulticastMessage = {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
    };

    if (payload.imageUrl) {
      message.notification = { ...message.notification, imageUrl: payload.imageUrl };
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
