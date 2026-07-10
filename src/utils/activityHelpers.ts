import { User } from '../models';

/**
 * Interface para entrada de atividade recente no User.recentActivities
 */
export interface RecentActivityInput {
  action: string;
  resource: string;
  endpoint: string;
  timestamp?: Date;
}

/**
 * Adiciona uma atividade recente ao array recentActivities do usuário,
 * limitando automaticamente às últimas 50 entradas ($slice: -50).
 * 
 * @param userId - ID do usuário
 * @param activity - Dados da atividade
 * @param onError - Callback opcional para log de erros (ex: console.error)
 */
export async function pushRecentActivity(
  userId: string,
  activity: RecentActivityInput,
  onError?: (err: any) => void
): Promise<void> {
  try {
    await User.findOneAndUpdate(
      { id: userId },
      {
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
      }
    );
  } catch (err) {
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
export function pushRecentActivityForUsers(
  userIds: string[],
  activity: RecentActivityInput
): Promise<void>[] {
  return userIds.map(userId =>
    pushRecentActivity(userId, activity)
  );
}
