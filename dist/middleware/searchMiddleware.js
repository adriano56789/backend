"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserSearchIndex = void 0;
const UserSearchService_1 = require("../services/UserSearchService");
// Middleware para atualizar o índice de busca automaticamente
const updateUserSearchIndex = async (user, operation) => {
    try {
        switch (operation) {
            case 'create':
            case 'update':
                await UserSearchService_1.UserSearchService.updateUserIndex(user);
                break;
            case 'delete':
                await UserSearchService_1.UserSearchService.removeUserFromIndex(user.id || user._id);
                break;
        }
    }
    catch (error) {
        console.error(`❌ Erro ao atualizar índice de busca (${operation}):`, error.message);
    }
};
exports.updateUserSearchIndex = updateUserSearchIndex;
