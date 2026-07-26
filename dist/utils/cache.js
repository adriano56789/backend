"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheKeys = exports.cache = void 0;
class SimpleCache {
    constructor() {
        this.cache = new Map();
        this.DEFAULT_TTL = 30 * 1000; // 30 segundos padrão
    }
    // Define um item no cache
    set(key, data, ttl = this.DEFAULT_TTL) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
    }
    // Obtém um item do cache
    get(key) {
        const item = this.cache.get(key);
        if (!item) {
            return null;
        }
        // Verificar se o item expirou
        if (Date.now() - item.timestamp > item.ttl) {
            this.cache.delete(key);
            return null;
        }
        return item.data;
    }
    // Remove um item do cache
    delete(key) {
        return this.cache.delete(key);
    }
    // Limpa todo o cache
    clear() {
        this.cache.clear();
    }
    // Remove itens expirados
    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now - item.timestamp > item.ttl) {
                this.cache.delete(key);
            }
        }
    }
    // Retorna estatísticas do cache
    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}
// Instância global do cache
exports.cache = new SimpleCache();
// Limpeza automática a cada 2 minutos
setInterval(() => {
    exports.cache.cleanup();
}, 2 * 60 * 1000);
// Funções helper para cache específico
exports.cacheKeys = {
    ACTIVE_STREAMS: 'active_streams',
    STREAM_BY_ID: (id) => `stream_${id}`,
    USER_BY_ID: (id) => `user_${id}`,
    ONLINE_USERS_IN_STREAM: (streamId) => `online_users_${streamId}`
};
exports.default = exports.cache;
