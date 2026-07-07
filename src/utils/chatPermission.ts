import { User } from '../models/User';
import { Followers } from '../models/Followers';

export async function canSendMessage(senderId: string, receiverId: string): Promise<{ allowed: boolean; reason?: string }> {
    try {
        const receiver = await User.findOne({ id: receiverId }).select('chatPermission').lean();
        if (!receiver) return { allowed: false, reason: 'Usuário não encontrado' };

        const permission = receiver.chatPermission || 'all';
        if (permission === 'all') return { allowed: true };

        if (permission === 'none') return { allowed: false, reason: 'Este usuário não aceita mensagens privadas' };

        const follow = await Followers.findOne({ followerId: senderId, followingId: receiverId, isActive: true }).lean();
        if (!follow) return { allowed: false, reason: 'Apenas seguidores podem enviar mensagens' };

        return { allowed: true };
    } catch (err) {
        console.error('[chatPermission] Erro ao verificar permissão:', err);
        return { allowed: false, reason: 'Erro ao verificar permissão' };
    }
}
