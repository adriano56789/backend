import dotenv from 'dotenv';
import path from 'path';

// Load .env from the backend root
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  USE_REAL_APIS: process.env.USE_REAL_APIS === 'true',
  PORT: parseInt(process.env.PORT || '3000'),
  WS_PORT: parseInt(process.env.WS_PORT || '3001'),

  // MongoDB
  MONGODB_URI: process.env.MONGODB_URI || '',
  MONGODB_NAME: process.env.MONGODB_NAME || 'api',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'dev_jwt_secret_key_change_me',

  // Security
  APP_SECRET_HEADER_KEY: process.env.APP_SECRET_HEADER_KEY || 'dev_app_secret_key',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173,https://livego.store,https://api.livego.store',

  // Financial & Admin
  ADM_EMAIL: process.env.ADM_EMAIL || 'admin@livego.test',
  APP_PIX_KEY: process.env.APP_PIX_KEY || 'dev_pix_key',
  PLATFORM_FEE_PERCENTAGE: parseInt(process.env.PLATFORM_FEE_PERCENTAGE || '20'),
  MIN_WITHDRAWAL_AMOUNT: parseInt(process.env.MIN_WITHDRAWAL_AMOUNT || '5'),

  // Certificates
  HTTPS_CERT_PATH: process.env.HTTPS_CERT_PATH || 'cert.pem',
  HTTPS_KEY_PATH: process.env.HTTPS_KEY_PATH || 'key.pem',

  // Mercado Pago
  MERCADO_PAGO_ACCESS_TOKEN: process.env.MERCADO_PAGO_ACCESS_TOKEN || '',
  MERCADO_PAGO_PUBLIC_KEY: process.env.MERCADO_PAGO_PUBLIC_KEY || '',
  MERCADO_PAGO_CLIENT_ID: process.env.MERCADO_PAGO_CLIENT_ID || '',
  MERCADO_PAGO_CLIENT_SECRET: process.env.MERCADO_PAGO_CLIENT_SECRET || '',

  // Webhooks
  WEBHOOK_URL: process.env.WEBHOOK_URL || '',
  NOTIFICATION_URL: process.env.NOTIFICATION_URL || '',

  // SRS
  SRS_HOST: process.env.SRS_HOST || 'localhost',
  SRS_API_URL: process.env.SRS_API_URL || 'http://localhost:1985',
  SRS_API_PORT: process.env.SRS_API_PORT || '1985',
  SRS_HTTP_PORT: process.env.SRS_HTTP_PORT || '8080',
  SRS_RTC_PORT: process.env.SRS_RTC_PORT || '8000',
  SRS_RTMP_PORT: process.env.SRS_RTMP_PORT || '1935',

  // LiveKit (WebRTC/SFU)
  LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY || 'devkey',
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET || 'secret',
  LIVEKIT_URL: process.env.LIVEKIT_URL || 'wss://sfu.livego.store',

  // TURN/Coturn
  TURN_SECRET: process.env.TURN_SECRET || 'dev_turn_secret_key_change_me',

  // EMQX (MQTT)
  MQTT_ENABLED: process.env.MQTT_ENABLED === 'true',
  EMQX_HOST: process.env.EMQX_HOST || 'localhost',
  EMQX_TLS: process.env.EMQX_TLS === 'true',
  EMQX_PORT: process.env.EMQX_PORT || '1883',
  EMQX_TLS_PORT: process.env.EMQX_TLS_PORT || '8883',
  EMQX_SERVICE_TOKEN: process.env.EMQX_SERVICE_TOKEN || 'livego_mqtt_service_token',
};

export const isDev = ENV.NODE_ENV === 'development';
export const useRealApis = ENV.USE_REAL_APIS;
