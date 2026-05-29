/**
 * Serviço de Mapeamento de IDs de Stream
 * 
 * Este serviço resolve o problema de ID real vs ID protegido:
 * - Frontend recebe IDs protegidos (fakeIds) para segurança
 * - Frontend usa IDs protegidos para chamar rotas específicas
 * - Backend mapeia ID protegido -> ID real internamente
 * - IDs reais nunca são expostos ao frontend
 */

import { Streamer } from '../models';

interface StreamMapping {
    protectedId: string;    // ID exposto ao frontend
    realId: string;         // ID real no banco de dados
    createdAt: Date;        // Quando foi criado o mapeamento
    expiresAt: Date;       // Quando expira (24h)
}

class StreamIdMapper {
    private static instance: StreamIdMapper;
    private mappings: Map<string, StreamMapping> = new Map();
    private readonly CLEANUP_INTERVAL = 60000; // 1 minuto
    private readonly EXPIRY_HOURS = 24; // 24 horas

    private constructor() {
        // Iniciar limpeza periódica
        setInterval(() => this.cleanupExpiredMappings(), this.CLEANUP_INTERVAL);
    }

    public static getInstance(): StreamIdMapper {
        if (!StreamIdMapper.instance) {
            StreamIdMapper.instance = new StreamIdMapper();
        }
        return StreamIdMapper.instance;
    }

    /**
     * Criar mapeamento para um stream existente
     */
    public async createMapping(realId: string): Promise<string> {
        // Verificar se stream existe
        const stream = await Streamer.findOne({ id: realId });
        if (!stream) {
            throw new Error('Stream não encontrado');
        }

        // Gerar ID protegido único
        const protectedId = `protected_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
        
        const mapping: StreamMapping = {
            protectedId,
            realId,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + this.EXPIRY_HOURS * 60 * 60 * 1000)
        };

        // Armazenar mapeamento
        this.mappings.set(protectedId, mapping);

        console.log(`[STREAM-ID-MAPPER] Mapping created: ${realId} -> ${protectedId}`);
        return protectedId;
    }

    /**
     * Obter ID real a partir do ID protegido
     */
    public getRealId(protectedId: string): string | null {
        const mapping = this.mappings.get(protectedId);
        
        if (!mapping) {
            console.log(`[STREAM-ID-MAPPER] No mapping found for: ${protectedId}`);
            return null;
        }

        // Verificar se expirou
        if (Date.now() > mapping.expiresAt.getTime()) {
            console.log(`[STREAM-ID-MAPPER] Mapping expired: ${protectedId}`);
            this.mappings.delete(protectedId);
            return null;
        }

        return mapping.realId;
    }

    /**
     * Obter ID protegido a partir do ID real
     */
    public getProtectedId(realId: string): string | null {
        for (const [protectedId, mapping] of this.mappings.entries()) {
            if (mapping.realId === realId && Date.now() <= mapping.expiresAt.getTime()) {
                return protectedId;
            }
        }
        return null;
    }

    /**
     * Verificar se mapeamento existe e é válido
     */
    public isValidMapping(protectedId: string): boolean {
        const mapping = this.mappings.get(protectedId);
        return mapping !== undefined && Date.now() <= mapping.expiresAt.getTime();
    }

    /**
     * Remover mapeamento específico
     */
    public removeMapping(protectedId: string): boolean {
        const removed = this.mappings.delete(protectedId);
        if (removed) {
            console.log(`[STREAM-ID-MAPPER] Mapping removed: ${protectedId}`);
        }
        return removed;
    }

    /**
     * Limpar mapeamentos expirados
     */
    private cleanupExpiredMappings(): void {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [protectedId, mapping] of this.mappings.entries()) {
            if (now > mapping.expiresAt.getTime()) {
                this.mappings.delete(protectedId);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            console.log(`[STREAM-ID-MAPPER] Cleaned ${cleanedCount} expired mappings`);
        }
    }

    /**
     * Middleware para validar ID protegido em rotas
     */
    public validateProtectedId(req: any, res: any, next: any) {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'ID da stream é obrigatório'
            });
        }

        // Verificar se é um ID protegido válido
        if (!this.isValidMapping(id)) {
            return res.status(404).json({
                success: false,
                message: 'Stream não encontrado ou expirado'
            });
        }

        // Adicionar ID real ao request para uso interno
        const realId = this.getRealId(id);
        if (!realId) {
            return res.status(404).json({
                success: false,
                message: 'Stream não encontrado'
            });
        }

        req.realStreamId = realId;
        req.protectedStreamId = id;
        next();
    }

    /**
     * Estatísticas do mapeador
     */
    public getStats() {
        const now = Date.now();
        let activeCount = 0;
        let expiredCount = 0;

        for (const mapping of this.mappings.values()) {
            if (now <= mapping.expiresAt.getTime()) {
                activeCount++;
            } else {
                expiredCount++;
            }
        }

        return {
            totalMappings: this.mappings.size,
            activeMappings: activeCount,
            expiredMappings: expiredCount
        };
    }
}

// Exportar instância singleton
export const streamIdMapper = StreamIdMapper.getInstance();

// Exportar middleware
export const validateProtectedStreamId = (req: any, res: any, next: any) => {
    streamIdMapper.validateProtectedId(req, res, next);
};

// Tipos para TypeScript
declare global {
    namespace Express {
        interface Request {
            realStreamId?: string;
            protectedStreamId?: string;
        }
    }
}
