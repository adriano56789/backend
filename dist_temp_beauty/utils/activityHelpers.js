"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushRecentActivity = pushRecentActivity;
exports.pushRecentActivityForUsers = pushRecentActivityForUsers;
const models_1 = require("../models");
/**
 * Adiciona uma atividade recente ao array recentActivities do usuário,
 * limitando automaticamente às últimas 50 entradas ($slice: -50).
 *
 * @param userId - ID do usuário
 * @param activity - Dados da atividade
 * @param onError - Callback opcional para log de erros (ex: console.error)
 */
async function pushRecentActivity(userId, activity, onError) {
    try {
        await models_1.User.findOneAndUpdate({ id: userId }, {
            $push: {
                recentActivities: {
                    $each: [{
                            action: activity.action,
                            resource: activity.resource,
                            timestamp: activity.timestamp || new Date(),
                            endpoint: activity.endpoint
                        }],
                    $slice: -50
                }
            }
        });
    }
    catch (err) {
        if (onError) {
            onError(err);
        }
        // Falha silenciosa por padrão - não travar a requisição principal
    }
}
/**
 * Versão para Promise.all com múltiplos usuários.
 * Útil para atividades que envolvem dois usuários (bloquear, seguir, etc).
 */
function pushRecentActivityForUsers(userIds, activity) {
    return userIds.map(userId => pushRecentActivity(userId, activity));
}
