import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || "development",
  USE_REAL_APIS: process.env.USE_REAL_APIS === "true",
  PORT: parseInt(process.env.PORT || "3000"),

  // MongoDB
  MONGODB_URI: process.env.MONGODB_URI || "",
  MONGODB_NAME: process.env.MONGODB_NAME || "api",

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || "dev_jwt_secret_key_change_me",

  // Security
  APP_SECRET_HEADER_KEY: process.env.APP_SECRET_HEADER_KEY || "dev_app_secret_key",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173,https://livego.store,https://api.livego.store",

  // Financial & Admin
  ADM_EMAIL: process.env.ADM_EMAIL || "",
  APP_PIX_KEY: process.env.APP_PIX_KEY || "dev_pix_key",
  PLATFORM_FEE_PERCENTAGE: parseInt(process.env.PLATFORM_FEE_PERCENTAGE || "20"),
  MIN_WITHDRAWAL_AMOUNT: parseInt(process.env.MIN_WITHDRAWAL_AMOUNT || "5"),

  // Certificates
  HTTPS_CERT_PATH: process.env.HTTPS_CERT_PATH || "cert.pem",
  HTTPS_KEY_PATH: process.env.HTTPS_KEY_PATH || "key.pem",

  // Payoneer — ÚNICO provedor de pagamentos/saques (Pix BRL, USD, EUR)
  PAYONEER_CLIENT_ID: process.env.PAYONEER_CLIENT_ID || "",
  PAYONEER_CLIENT_SECRET: process.env.PAYONEER_CLIENT_SECRET || "",
  PAYONEER_PROGRAM_ID: process.env.PAYONEER_PROGRAM_ID || "",
  PAYONEER_ENVIRONMENT: process.env.PAYONEER_ENVIRONMENT || "sandbox",
  PAYONEER_WEBHOOK_SECRET: process.env.PAYONEER_WEBHOOK_SECRET || "",
  // Conta Payoneer do DONO da plataforma — recebe os 20% de cada saque automaticamente
  PAYONEER_PLATFORM_EMAIL: process.env.PAYONEER_PLATFORM_EMAIL || "",
  PAYONEER_PLATFORM_RECIPIENT: process.env.PAYONEER_PLATFORM_RECIPIENT || "",

  // Webhooks
  WEBHOOK_URL: process.env.WEBHOOK_URL || "",
  NOTIFICATION_URL: process.env.NOTIFICATION_URL || "",

  // URLs Públicas
  BACKEND_URL: (process.env.BACKEND_URL || "https://api.livego.store").replace(/\/+$/, ""),
  FRONTEND_URL: (process.env.FRONTEND_URL || "https://livego.store").replace(/\/+$/, ""),

  // SRS
  SRS_HOST: process.env.SRS_HOST || "localhost",
  SRS_API_URL: process.env.SRS_API_URL || "http://" + (process.env.SRS_HOST || "localhost") + ":" + (process.env.SRS_API_PORT || "1985"),
  SRS_API_PORT: process.env.SRS_API_PORT || "1985",
  SRS_HTTP_PORT: process.env.SRS_HTTP_PORT || "8080",
  SRS_RTC_PORT: process.env.SRS_RTC_PORT || "8000",
  SRS_RTMP_PORT: process.env.SRS_RTMP_PORT || "1935",

  // SRS - URL HTTPS pública para HLS/FLV (via proxy Nginx)
  SRS_PUBLIC_URL: (process.env.SRS_PUBLIC_URL || process.env.BACKEND_URL || "https://api.livego.store").replace(/\/+$/, "") + "/api/video/http",

  // Web Push nativo (VAPID) — sem Firebase
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || "",
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || "",
  VAPID_SUBJECT: process.env.VAPID_SUBJECT || "mailto:admin@livego.store",

  // TURN/Coturn
  TURN_SECRET: process.env.TURN_SECRET || "dev_turn_secret_key_change_me",
  TURN_HOST: process.env.TURN_HOST || "2.25.192.154",
  TURN_PORT: process.env.TURN_PORT || "3478",
  TURN_USERNAME: process.env.TURN_USERNAME || "livego",
  TURN_CREDENTIAL: process.env.TURN_CREDENTIAL || "livegosecretpassword",

  // STUN
  STUN_URL: process.env.STUN_URL || "stun:2.25.192.154:3478",

  // EMQX (MQTT)
  MQTT_ENABLED: process.env.MQTT_ENABLED === "true",
  EMQX_HOST: process.env.EMQX_HOST || "localhost",
  EMQX_TLS: process.env.EMQX_TLS === "true",
  EMQX_PORT: process.env.EMQX_PORT || "1883",
  EMQX_TLS_PORT: process.env.EMQX_TLS_PORT || "8883",
  EMQX_SERVICE_TOKEN: process.env.EMQX_SERVICE_TOKEN || "livego_mqtt_service_token",
};

export const isDev = ENV.NODE_ENV === "development";
export const useRealApis = ENV.USE_REAL_APIS;
