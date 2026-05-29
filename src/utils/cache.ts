// Cache simples em memória para otimizar consultas frequentes
interface CacheItem<T> {
    data: T;
    timestamp: number;
    ttl: number; // Time to live em milissegundos
}

class SimpleCache {
    private cache = new Map<string, CacheItem<any>>();
    private readonly DEFAULT_TTL = 30 * 1000; // 30 segundos padrão

    // Define um item no cache
    set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
    }

    // Obtém um item do cache
    get<T>(key: string): T | null {
        const item = this.cache.get(key);
        
        if (!item) {
            return null;
        }

        // Verificar se o item expirou
        if (Date.now() - item.timestamp > item.ttl) {
            this.cache.delete(key);
            return null;
        }

        return item.data as T;
    }

    // Remove um item do cache
    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    // Limpa todo o cache
    clear(): void {
        this.cache.clear();
    }

    // Remove itens expirados
    cleanup(): void {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now - item.timestamp > item.ttl) {
                this.cache.delete(key);
            }
        }
    }

    // Retorna estatísticas do cache
    getStats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

// Instância global do cache
export const cache = new SimpleCache();

// Limpeza automática a cada 2 minutos
setInterval(() => {
    cache.cleanup();
}, 2 * 60 * 1000);

// Funções helper para cache específico
export const cacheKeys = {
    ACTIVE_STREAMS: 'active_streams',
    STREAM_BY_ID: (id: string) => `stream_${id}`,
    USER_BY_ID: (id: string) => `user_${id}`,
    ONLINE_USERS_IN_STREAM: (streamId: string) => `online_users_${streamId}`
};

export default cache;
