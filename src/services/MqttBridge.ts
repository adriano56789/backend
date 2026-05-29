import { ENV } from '../config/env';
import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import pino from 'pino';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

type MqttQoS = 0 | 1 | 2;

const logger = pino({
  name: 'mqtt-bridge',
  level: process.env.MQTT_LOG_LEVEL || 'info',
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export interface MqttMessage {
  topic: string;
  payload: any;
  instanceId: string;
  timestamp: number;
}

export interface MqttPublishOptions {
  qos?: MqttQoS;
  retain?: boolean;
}

export type MqttMessageHandler = (message: MqttMessage) => void;

export class MqttBridge {
  public readonly instanceId: string;

  private client: MqttClient | null = null;
  private handlers = new Map<string, Set<MqttMessageHandler>>();
  private connected = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  private readonly host: string;
  private readonly useTls: boolean;
  private readonly mqttPort: number;
  private readonly wsPort: number;
  private readonly serviceToken: string;
  private readonly baseReconnectMs: number;
  private readonly maxReconnectMs: number;
  private readonly qosDefault: MqttQoS;
  private readonly heartbeatIntervalMs: number;

  constructor() {
    this.instanceId = crypto.randomUUID();

    this.host = ENV.EMQX_HOST;
    this.useTls = ENV.EMQX_TLS;
    this.mqttPort = this.useTls
      ? parseInt(ENV.EMQX_TLS_PORT, 10)
      : parseInt(ENV.EMQX_PORT, 10);
    this.wsPort = parseInt(process.env.EMQX_WS_PORT || '8083', 10);
    this.serviceToken = ENV.EMQX_SERVICE_TOKEN;
    this.baseReconnectMs = parseInt(process.env.EMQX_RECONNECT_BASE_MS || '1000', 10);
    this.maxReconnectMs = parseInt(process.env.EMQX_RECONNECT_MAX_MS || '30000', 10);
    this.qosDefault = Math.min(Math.max(parseInt(process.env.EMQX_QOS_DEFAULT || '1', 10), 0), 2) as MqttQoS;
    this.heartbeatIntervalMs = parseInt(process.env.EMQX_HEARTBEAT_INTERVAL_MS || '15000', 10);
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = this.useTls ? 'mqtts' : 'mqtt';

      // Gerar JWT token para autenticação no EMQX
      // Expiração longa (1 ano) porque é backend-to-backend com token estático
      const jwtToken = jwt.sign(
        {
          username: 'livego-backend',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
        },
        this.serviceToken,
        { algorithm: 'HS256' }
      );

      const options: IClientOptions = {
        host: this.host,
        port: this.mqttPort,
        protocol,
        clientId: `livego-backend-${this.instanceId.slice(0, 8)}`,
        username: 'livego-backend',
        password: jwtToken,
        clean: false,
        reconnectPeriod: this.baseReconnectMs,
        connectTimeout: 10000,
        rejectUnauthorized: this.useTls,
        resubscribe: true,
      };

      logger.info({ host: this.host, port: this.mqttPort, protocol, clientId: options.clientId }, 'Connecting to EMQX');

      this.client = mqtt.connect(options);

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
        if (!this.connected) reject(err);
      });

      this.client.on('message', (topic, payload) => {
        try {
          const parsed: MqttMessage = JSON.parse(payload.toString());
          parsed.topic = topic;

          for (const [pattern, handlers] of this.handlers) {
            if (this.topicMatches(pattern, topic)) {
              handlers.forEach((handler) => handler(parsed));
            }
          }
        } catch (err: any) {
          logger.error({ err: err.message, topic }, 'Failed to parse MQTT message');
        }
      });
    });
  }

  async publish(
    topic: string,
    data: any,
    options?: MqttPublishOptions
  ): Promise<void> {
    if (!this.client || !this.connected) {
      logger.warn({ topic }, 'Cannot publish: not connected to EMQX');
      return;
    }

    const message: MqttMessage = {
      topic,
      payload: data,
      instanceId: this.instanceId,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      this.client!.publish(
        topic,
        JSON.stringify(message),
        {
          qos: options?.qos ?? this.qosDefault,
          retain: options?.retain ?? false,
        },
        (err) => {
          if (err) {
            logger.error({ err: err.message, topic }, 'Publish failed');
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  subscribe(topic: string, handler: MqttMessageHandler): () => void {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, new Set());
      if (this.client && this.connected) {
        this.client.subscribe(topic, { qos: this.qosDefault }, (err) => {
          if (err) logger.error({ err: err.message, topic }, 'Subscribe failed');
          else logger.info({ topic }, 'Subscribed to topic');
        });
      }
    }

    this.handlers.get(topic)!.add(handler);

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

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    this.stopHeartbeat();
    if (this.client) {
      // Remover retained health message antes de desconectar
      const healthTopic = `livego/health/instance/${this.instanceId}`;
      this.client.publish(healthTopic, '', { qos: 0, retain: true }, () => {});
      return new Promise((resolve) => {
        this.client!.end(true, {}, () => {
          this.connected = false;
          logger.info('Disconnected from EMQX');
          resolve();
        });
      });
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    const topic = `livego/health/instance/${this.instanceId}`;

    this.heartbeatTimer = setInterval(() => {
      this.publish(topic, {
        status: 'alive',
        uptime: process.uptime(),
        memory: process.memoryUsage().heapUsed,
      }, { qos: 0, retain: true }).catch(() => {});
    }, this.heartbeatIntervalMs);

    this.publish(topic, { status: 'online', startedAt: new Date().toISOString() }, { qos: 0, retain: true }).catch(() => {});

    logger.info({ topic, intervalMs: this.heartbeatIntervalMs }, 'Heartbeat started');
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private topicMatches(pattern: string, topic: string): boolean {
    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');

    if (patternParts.length !== topicParts.length && !pattern.includes('#')) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '#') return true;
      if (patternParts[i] === '+') continue;
      if (patternParts[i] !== topicParts[i]) return false;
    }

    return patternParts.length === topicParts.length;
  }

  private matchTopic(topic: string): string[] {
    const matches: string[] = [];
    for (const pattern of this.handlers.keys()) {
      if (this.topicMatches(pattern, topic)) {
        matches.push(pattern);
      }
    }
    return matches;
  }
}

export const mqttBridge = new MqttBridge();
