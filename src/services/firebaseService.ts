import { initializeApp, cert, getApp, App } from 'firebase-admin/app';
import { getMessaging, Messaging, Message, MulticastMessage } from 'firebase-admin/messaging';
import { ENV } from '../config/env';

// ═══════════════════════════════════════════════════════════════════════
// REGRA DE OURO: Firebase/FCM serve EXCLUSIVAMENTE para enviar notificação
// PUSH na tela do usuário (title + body). NUNCA deve carregar/buscar imagem,
// avatar ou ícone — nem no notification (imageUrl/icon) nem nos dados (data).
// Qualquer campo que pareça imagem/avatar/ícone é REMOVIDO do payload antes
// do envio, garantindo que o push NUNCA dispare um fetch de imagem.
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
  payload: { title: string; body: string; data?: Record<string, string> }
) {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    console.warn('[FCM] Firebase não inicializado, ignorando notificação.');
    return null;
  }

  try {
    // 🚫 SEM imageUrl/icon: o push é SÓ título + corpo. Nenhuma imagem é baixada.
    const message: Message = {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: sanitizeData(payload.data),
    };

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
  payload: { title: string; body: string; data?: Record<string, string> }
) {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    console.warn('[FCM] Firebase não inicializado, ignorando notificação multicast.');
    return [];
  }

  try {
    // 🚫 SEM imageUrl/icon: o push é SÓ título + corpo. Nenhuma imagem é baixada.
    const message: MulticastMessage = {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: sanitizeData(payload.data),
    };

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
