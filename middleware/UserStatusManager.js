"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("../models");
let instance = null;
class UserStatusManager {
    constructor(io) {
        this.heartbeatMap = {};
        this.HEARTBEAT_INTERVAL = 30000; // 30 segundos
        this.HEARTBEAT_TIMEOUT = 60000; // 60 segundos para considerar offline
        this.io = io;
        this.setupEventHandlers();
        instance = this;
    }
    static getInstance() {
        return instance;
    }
    setupEventHandlers() {
        // Quando usuário se conecta
        this.io.on('connection', (socket) => {
            console.log(`Usuário conectado: ${socket.id}`);
            // Registrar heartbeat do usuário
            socket.on('user_heartbeat', async (data) => {
                await this.handleHeartbeat(data.userId, socket);
            });
            // Quando usuário entra no app (autenticação)
            socket.on('user_online', async (data) => {
                await this.setUserOnline(data.userId);
                this.startHeartbeat(data.userId, socket);
            });
            // Quando usuário sai do app
            socket.on('user_offline', async (data) => {
                await this.setUserOffline(data.userId);
                this.stopHeartbeat(data.userId);
            });
            // Quando socket desconecta
            socket.on('disconnect', () => {
                console.log(`Usuário desconectado: ${socket.id}`);
                this.handleDisconnect(socket);
            });
        });
    }
    async handleHeartbeat(userId, socket) {
        const now = Date.now();
        if (!this.heartbeatMap[userId]) {
            this.heartbeatMap[userId] = {
                lastHeartbeat: now,
                isAlive: true
            };
            // Se o usuário não estava no mapa, garantir que ele seja marcado como online no DB
            await this.setUserOnline(userId);
        }
        else {
            this.heartbeatMap[userId].lastHeartbeat = now;
            this.heartbeatMap[userId].isAlive = true;
        }
        // Enviar confirmação do heartbeat
        if (socket) {
            socket.emit('heartbeat_ack', {
                userId,
                timestamp: now,
                nextHeartbeat: now + this.HEARTBEAT_INTERVAL
            });
        }
    }
    async setUserOnline(userId) {
        try {
            // Importar dinamicamente para evitar circular dependency
            const { User, UserStatus } = await Promise.resolve().then(() => __importStar(require('../models')));
            const now = new Date();
            await UserStatus.findOneAndUpdate({ userId: userId }, { $set: { isOnline: true, lastSeen: now } }, { upsert: true });
            await User.findOneAndUpdate({ id: userId }, {
                $set: { isOnline: true, lastSeen: now, lastLogin: now },
                $inc: { loginCount: 1 },
                $push: {
                    recentActivities: {
                        action: 'user_online',
                        resource: 'user_session',
                        timestamp: now,
                        endpoint: 'websocket_connection'
                    }
                }
            }, { upsert: true });
            // Broadcast para todos os usuários interessados
            this.io.emit('user_status_changed', {
                userId: userId,
                isOnline: true,
                timestamp: now
            });
            console.log(` Usuário ${userId} marcado como online`);
        }
        catch (error) {
            console.error('Erro ao marcar usuário como online:', error);
        }
    }
    async setUserOffline(userId) {
        try {
            // Importar dinamicamente
            const { User, UserStatus } = await Promise.resolve().then(() => __importStar(require('../models')));
            const now = new Date();
            await UserStatus.findOneAndUpdate({ userId: userId }, { $set: { isOnline: false, lastSeen: now } }, { upsert: true });
            await User.findOneAndUpdate({ id: userId }, {
                $set: { isOnline: false, lastSeen: now },
                $push: {
                    recentActivities: {
                        action: 'user_offline',
                        resource: 'user_session',
                        timestamp: now,
                        endpoint: 'websocket_disconnection'
                    }
                }
            });
            // Broadcast para todos os usuários interessados
            this.io.emit('user_status_changed', {
                userId: userId,
                isOnline: false,
                lastSeen: now,
                timestamp: now
            });
            console.log(` Usuário ${userId} marcado como offline`);
        }
        catch (error) {
            console.error('Erro ao marcar usuário como offline:', error);
        }
    }
    startHeartbeat(userId, socket) {
        // Limpar heartbeat anterior se existir
        this.stopHeartbeat(userId);
        // Iniciar novo heartbeat
        const intervalId = setInterval(() => {
            const heartbeat = this.heartbeatMap[userId];
            if (!heartbeat || !heartbeat.isAlive) {
                this.stopHeartbeat(userId);
                this.setUserOffline(userId);
                return;
            }
            // Resetar status alive para verificar no próximo ciclo
            heartbeat.isAlive = false;
            // Enviar solicitação de heartbeat
            socket.emit('heartbeat_request', {
                userId,
                timestamp: Date.now()
            });
        }, this.HEARTBEAT_INTERVAL);
        this.heartbeatMap[userId] = {
            lastHeartbeat: Date.now(),
            intervalId,
            isAlive: true
        };
        console.log(`Heartbeat iniciado para usuário ${userId}`);
    }
    stopHeartbeat(userId) {
        const heartbeat = this.heartbeatMap[userId];
        if (heartbeat && heartbeat.intervalId) {
            clearInterval(heartbeat.intervalId);
        }
        delete this.heartbeatMap[userId];
        console.log(`Heartbeat parado para usuário ${userId}`);
    }
    handleDisconnect(socket) {
        // Encontrar e limpar heartbeats associados a este socket
        for (const userId in this.heartbeatMap) {
            const heartbeat = this.heartbeatMap[userId];
            if (heartbeat && !heartbeat.isAlive) {
                this.stopHeartbeat(userId);
                this.setUserOffline(userId);
            }
        }
    }
    // Limpar usuários inativos (executar periodicamente)
    cleanupInactiveUsers() {
        const now = Date.now();
        for (const userId in this.heartbeatMap) {
            const heartbeat = this.heartbeatMap[userId];
            if (heartbeat && (now - heartbeat.lastHeartbeat) > this.HEARTBEAT_TIMEOUT) {
                this.stopHeartbeat(userId);
                this.setUserOffline(userId);
            }
        }
    }
    // Obter status atual do usuário
    async getUserStatus(userId) {
        try {
            const status = await models_1.UserStatus.findOne({ userId: userId });
            return status || {
                userId: userId,
                isOnline: false,
                lastSeen: new Date(),
                updatedAt: new Date()
            };
        }
        catch (error) {
            console.error('Erro ao obter status do usuário:', error);
            return null;
        }
    }
    // Obter todos os usuários online
    async getOnlineUsers(limit = 50, offset = 0) {
        try {
            const onlineUsers = await models_1.UserStatus.find({ isOnline: true })
                .sort({ updatedAt: -1 })
                .limit(limit)
                .skip(offset)
                .select('userId lastSeen updatedAt');
            return onlineUsers;
        }
        catch (error) {
            console.error('Erro ao obter usuários online:', error);
            return [];
        }
    }
}
exports.default = UserStatusManager;
