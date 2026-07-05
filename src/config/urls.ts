import dotenv from 'dotenv';
import { ENV } from './env';
dotenv.config();

export const URL_CONFIG = {
  production: {
    baseUrl: process.env.BASE_URL || 'https://livego.store',
    backendUrl: process.env.BACKEND_URL || 'https://livego.store',
    frontendUrl: process.env.FRONTEND_URL || 'https://livego.store',
    uploadsUrl: process.env.BASE_URL || 'https://livego.store',
    srsHost: process.env.SRS_HOST || 'srs',
    srsApiUrl: ENV.SRS_API_URL,
    srsRtmpUrl: process.env.SRS_RTMP_URL || 'rtmp://srs:1935/live',
    srsHttpUrl: process.env.SRS_HTTP_URL || 'https://srs:8088/live'
  }
};

export const currentConfig = URL_CONFIG.production;

export const getBaseUrl = () => currentConfig.baseUrl;
export const getBackendUrl = () => currentConfig.backendUrl;
export const getFrontendUrl = () => currentConfig.frontendUrl;
export const getUploadsUrl = () => currentConfig.uploadsUrl;
export const getAvatarUrl = (filename: string) => `${currentConfig.uploadsUrl}/uploads/avatars/${filename}`;
export const getPhotoUrl = (filename: string) => `${currentConfig.uploadsUrl}/uploads/photos/${filename}`;
export const getChatImageUrl = (filename: string) => `${currentConfig.uploadsUrl}/uploads/chat/${filename}`;

console.log(`🔗 Base URL: ${currentConfig.baseUrl}`);

export default currentConfig;
