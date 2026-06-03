"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChatImageUrl = exports.getPhotoUrl = exports.getAvatarUrl = exports.getUploadsUrl = exports.getFrontendUrl = exports.getBackendUrl = exports.getBaseUrl = exports.currentConfig = exports.URL_CONFIG = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.URL_CONFIG = {
    production: {
        baseUrl: process.env.BASE_URL || 'https://livego.store',
        backendUrl: process.env.BACKEND_URL || 'https://livego.store',
        frontendUrl: process.env.FRONTEND_URL || 'https://livego.store',
        uploadsUrl: process.env.BASE_URL || 'https://livego.store',
        srsHost: process.env.SRS_HOST || 'srs',
        srsApiUrl: process.env.SRS_API_URL || 'https://srs:1990',
        srsRtmpUrl: process.env.SRS_RTMP_URL || 'rtmp://srs:1935/live',
        srsHttpUrl: process.env.SRS_HTTP_URL || 'https://srs:8088/live'
    }
};
exports.currentConfig = exports.URL_CONFIG.production;
const getBaseUrl = () => exports.currentConfig.baseUrl;
exports.getBaseUrl = getBaseUrl;
const getBackendUrl = () => exports.currentConfig.backendUrl;
exports.getBackendUrl = getBackendUrl;
const getFrontendUrl = () => exports.currentConfig.frontendUrl;
exports.getFrontendUrl = getFrontendUrl;
const getUploadsUrl = () => exports.currentConfig.uploadsUrl;
exports.getUploadsUrl = getUploadsUrl;
const getAvatarUrl = (filename) => `${exports.currentConfig.uploadsUrl}/uploads/avatars/${filename}`;
exports.getAvatarUrl = getAvatarUrl;
const getPhotoUrl = (filename) => `${exports.currentConfig.uploadsUrl}/uploads/photos/${filename}`;
exports.getPhotoUrl = getPhotoUrl;
const getChatImageUrl = (filename) => `${exports.currentConfig.uploadsUrl}/uploads/chat/${filename}`;
exports.getChatImageUrl = getChatImageUrl;
console.log(`🔗 Base URL: ${exports.currentConfig.baseUrl}`);
exports.default = exports.currentConfig;
