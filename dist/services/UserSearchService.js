"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSearchService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("../models");
const UserIndex_1 = require("../models/UserIndex");
class UserSearchService {
    /**
     * Atualizar ou adicionar usuário no índice de busca
     */
    static async updateUserIndex(user) {
        try {
            // Gerar searchTerms manualmente
            const name = (user.name || '').toLowerCase();
            const displayName = (user.displayName || user.name || '').toLowerCase();
            const identification = (user.identification || '').toLowerCase();
            const searchTerms = [
                name,
                displayName,
                identification,
                ...name.split(' ').filter((t) => t.length > 0),
                ...displayName.split(' ').filter((t) => t.length > 0),
                ...identification.split(' ').filter((t) => t.length > 0)
            ].filter((term, index, arr) => arr.indexOf(term) === index); // Remover duplicatas
            const indexData = {
                id: `user_idx_${user.id}`,
                userId: user.id,
                identification: user.identification,
                name: user.name,
                displayName: user.displayName || user.name,
                avatarUrl: user.avatarUrl,
                searchTerms: searchTerms, // Adicionar searchTerms explicitamente
                isActive: true,
                lastUpdated: new Date()
            };
            // Usar upsert para criar ou atualizar
            await models_1.UserIndex.findOneAndUpdate({ userId: user.id }, { $set: indexData }, { upsert: true, new: true });
            console.log(`✅ Usuário ${user.name} adicionado/atualizado no índice de busca`);
        }
        catch (error) {
            console.error(`❌ Erro ao atualizar índice do usuário ${user.id}:`, error.message);
        }
    }
    /**
     * Remover usuário do índice (quando deletado)
     */
    static async removeUserFromIndex(userId) {
        try {
            await models_1.UserIndex.findOneAndDelete({ userId });
            console.log(`✅ Usuário ${userId} removido do índice de busca`);
        }
        catch (error) {
            console.error(`❌ Erro ao remover usuário do índice:`, error.message);
        }
    }
    /**
     * Buscar usuários por ID ou nome
     */
    static async searchUsers(query, limit = 20) {
        try {
            if (!query || query.trim().length < 2) {
                return [];
            }
            const searchTerm = query.trim().toLowerCase();
            const db = mongoose_1.default.connection.db;
            if (!db) {
                console.error("❌ MongoDB connection not available");
                return [];
            }
            const collection = db.collection("userindexes");
            const results = await (0, UserIndex_1.searchUserIndexesByName)(collection, searchTerm, limit, { isActive: true });
            return results;
        }
        catch (error) {
            console.error('❌ Erro na busca de usuários:', error.message);
            return [];
        }
    }
    /**
     * Sincronizar todos os usuários existentes com o índice
     */
    static async syncAllUsers() {
        try {
            console.log('🔄 Iniciando sincronização de todos os usuários...');
            // Buscar todos os usuários ativos
            const users = await models_1.User.find({
                $or: [
                    { isActive: { $exists: false } },
                    { isActive: true }
                ]
            });
            console.log(`📊 Encontrados ${users.length} usuários para sincronizar`);
            // Atualizar cada usuário no índice
            for (const user of users) {
                await this.updateUserIndex(user);
            }
            console.log('✅ Sincronização concluída com sucesso!');
        }
        catch (error) {
            console.error('❌ Erro na sincronização:', error.message);
        }
    }
    /**
     * Limpar usuários inativos do índice
     */
    static async cleanupInactiveUsers() {
        try {
            console.log('🧹 Limpando usuários inativos do índice...');
            // Marcar como inativos usuários que não existem mais no banco principal
            const activeUserIds = await models_1.User.distinct('id');
            await models_1.UserIndex.updateMany({ userId: { $nin: activeUserIds } }, { $set: { isActive: false } });
            console.log('✅ Limpeza concluída!');
        }
        catch (error) {
            console.error('❌ Erro na limpeza:', error.message);
        }
    }
}
exports.UserSearchService = UserSearchService;
