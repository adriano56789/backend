"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mqttBridge = exports.MqttBridge = void 0;
const env_1 = require("../config/env");
const mqtt_1 = __importDefault(require("mqtt"));
const pino_1 = __importDefault(require("pino"));
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger = (0, pino_1.default)({
    name: 'mqtt-bridge',
    level: process.env.MQTT_LOG_LEVEL || 'info',
    formatters: {
        level(label) {
            return { level: label };
        },
    },
    timestamp: pino_1.default.stdTimeFunctions.isoTime,
});
class MqttBridge {
    constructor() {
        this.client = null;
        this.handlers = new Map();
        this.connected = false;
        this.heartbeatTimer = null;
        this.instanceId = crypto_1.default.randomUUID();
        this.host = env_1.ENV.EMQX_HOST;
        this.useTls = env_1.ENV.EMQX_TLS;
        this.mqttPort = this.useTls
            ? parseInt(env_1.ENV.EMQX_TLS_PORT, 10)
            : parseInt(env_1.ENV.EMQX_PORT, 10);
        this.wsPort = parseInt(process.env.EMQX_WS_PORT || '8083', 10);
        this.serviceToken = env_1.ENV.EMQX_SERVICE_TOKEN;
        this.baseReconnectMs = parseInt(process.env.EMQX_RECONNECT_BASE_MS || '1000', 10);
        this.maxReconnectMs = parseInt(process.env.EMQX_RECONNECT_MAX_MS || '30000', 10);
        this.qosDefault = Math.min(Math.max(parseInt(process.env.EMQX_QOS_DEFAULT || '1', 10), 0), 2);
        this.heartbeatIntervalMs = parseInt(process.env.EMQX_HEARTBEAT_INTERVAL_MS || '15000', 10);
    }
    async connect() {
        return new Promise((resolve, reject) => {
            const protocol = this.useTls ? 'mqtts' : 'mqtt';
            // Gerar JWT token para autenticação no EMQX
            // Expiração longa (1 ano) porque é backend-to-backend com token estático
            const jwtToken = jsonwebtoken_1.default.sign({
                username: 'livego-backend',
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
            }, this.serviceToken, { algorithm: 'HS256' });
            const options = {
                host: this.host,
                port: this.mqttPort,
                protocol,
                clientId: `livego-backend-${this.instanceId.slice(0, 8)}`,
                username: 'livego-backend',
                password: jwtToken,
                clean: true,
                reconnectPeriod: this.baseReconnectMs,
                connectTimeout: 10000,
                rejectUnauthorized: this.useTls,
                resubscribe: true,
            };
            logger.info({ host: this.host, port: this.mqttPort, protocol, clientId: options.clientId }, 'Connecting to EMQX');
            this.client = mqtt_1.default.connect(options);
            this.client.on('connect', () => {
                this.connected = true;
                logger.info('Connected to EMQX');
                this.startHeartbeat();
                resolve();
            });
            this.client.on('reconnect', () => {
                logger.warn('Reconnecting to EMQX');
            });
            this.client.on('close', () => {
                this.connected = false;
                logger.warn('Connection to EMQX closed');
            });
            this.client.on('offline', () => {
                this.connected = false;
                logger.warn('EMQX client offline');
            });
            this.client.on('error', (err) => {
                logger.error({ err: err.message }, 'EMQX connection error');
                if (!this.connected)
                    reject(err);
            });
            this.client.on('message', (topic, payload) => {
                try {
                    const parsed = JSON.parse(payload.toString());
                    parsed.topic = topic;
                    for (const [pattern, handlers] of this.handlers) {
                        if (this.topicMatches(pattern, topic)) {
                            handlers.forEach((handler) => handler(parsed));
                        }
                    }
                }
                catch (err) {
                    logger.error({ err: err.message, topic }, 'Failed to parse MQTT message');
                }
            });
        });
    }
    async publish(topic, data, options) {
        if (!this.client || !this.connected) {
            logger.warn({ topic }, 'Cannot publish: not connected to EMQX');
            return;
        }
        const message = {
            topic,
            payload: data,
            instanceId: this.instanceId,
            timestamp: Date.now(),
        };
        return new Promise((resolve, reject) => {
            this.client.publish(topic, JSON.stringify(message), {
                qos: options?.qos ?? this.qosDefault,
                retain: options?.retain ?? false,
            }, (err) => {
                if (err) {
                    logger.error({ err: err.message, topic }, 'Publish failed');
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }
    subscribe(topic, handler) {
        if (!this.handlers.has(topic)) {
            this.handlers.set(topic, new Set());
            if (this.client && this.connected) {
                this.client.subscribe(topic, { qos: this.qosDefault }, (err) => {
                    if (err)
                        logger.error({ err: err.message, topic }, 'Subscribe failed');
                    else
                        logger.info({ topic }, 'Subscribed to topic');
                });
            }
        }
        this.handlers.get(topic).add(handler);
        return () => {
            const handlers = this.handlers.get(topic);
            if (handlers) {
                handlers.delete(handler);
                if (handlers.size === 0) {
                    this.handlers.delete(topic);
                    if (this.client && this.connected) {
                        this.client.unsubscribe(topic);
                    }
                }
            }
        };
    }
    isConnected() {
        return this.connected;
    }
    async disconnect() {
        this.stopHeartbeat();
        if (this.client) {
            // Remover retained health message antes de desconectar
            const healthTopic = `livego/health/instance/${this.instanceId}`;
            this.client.publish(healthTopic, '', { qos: 0, retain: true }, () => { });
            return new Promise((resolve) => {
                this.client.end(true, {}, () => {
                    this.connected = false;
                    logger.info('Disconnected from EMQX');
                    resolve();
                });
            });
        }
    }
    startHeartbeat() {
        this.stopHeartbeat();
        const topic = `livego/health/instance/${this.instanceId}`;
        this.heartbeatTimer = setInterval(() => {
            this.publish(topic, {
                status: 'alive',
                uptime: process.uptime(),
                memory: process.memoryUsage().heapUsed,
            }, { qos: 0, retain: true }).catch(() => { });
        }, this.heartbeatIntervalMs);
        this.publish(topic, { status: 'online', startedAt: new Date().toISOString() }, { qos: 0, retain: true }).catch(() => { });
        logger.info({ topic, intervalMs: this.heartbeatIntervalMs }, 'Heartbeat started');
    }
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
    topicMatches(pattern, topic) {
        const patternParts = pattern.split('/');
        const topicParts = topic.split('/');
        if (patternParts.length !== topicParts.length && !pattern.includes('#')) {
            return false;
        }
        for (let i = 0; i < patternParts.length; i++) {
            if (patternParts[i] === '#')
                return true;
            if (patternParts[i] === '+')
                continue;
            if (patternParts[i] !== topicParts[i])
                return false;
        }
        return patternParts.length === topicParts.length;
    }
    matchTopic(topic) {
        const matches = [];
        for (const pattern of this.handlers.keys()) {
            if (this.topicMatches(pattern, topic)) {
                matches.push(pattern);
            }
        }
        return matches;
    }
}
exports.MqttBridge = MqttBridge;
exports.mqttBridge = new MqttBridge();
