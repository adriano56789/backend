import { User } from '../models/User';
import { Followers } from '../models/Followers';
import { Friendship } from '../models/Friendship';
import { Block } from '../models';

export async function canSendMessage(senderId: string, receiverId: string): Promise<{ allowed: boolean; reason?: string; code?: string }> {
    try {
        // 🚫 Se o DESTINATÁRIO bloqueou o REMETENTE, a mensagem NÃO é enviada.
        // O bloqueado tenta mandar e vê: "Você foi proibido de falar".
        const block = await Block.findOne({
            blockerId: receiverId,
            blockedId: senderId,
            isActive: true
        }).lean();
        if (block) return { allowed: false, reason: 'Você foi proibido de falar', code: 'BLOCKED' };

        const receiver = await User.findOne({ id: receiverId }).select('chatPermission').lean();
        if (!receiver) return { allowed: false, reason: 'Usuário não encontrado' };

        const permission = receiver.chatPermission || 'all';
        if (permission === 'all') return { allowed: true };

        if (permission === 'none') return { allowed: false, reason: 'Este usuário não aceita mensagens privadas' };

        if (permission === 'following') {
            // "Apenas quem eu sigo": o receiver precisa seguir o sender
            const follow = await Followers.findOne({ followerId: receiverId, followingId: senderId, isActive: true }).lean();
            if (!follow) return { allowed: false, reason: 'Apenas quem este usuário segue pode enviar mensagens' };
            return { allowed: true };
        }

        if (permission === 'friends') {
            // "Apenas meus amigos": deve existir amizade ativa entre os dois
            const friendship = await Friendship.findOne({
                $or: [
                    { userId1: receiverId, userId2: senderId },
                    { userId1: senderId, userId2: receiverId }
                ],
                isActive: true
            }).lean();
            if (!friendship) return { allowed: false, reason: 'Apenas amigos podem enviar mensagens' };
            return { allowed: true };
        }

        // Legado 'followers': o sender precisa seguir o receiver
        const follow = await Followers.findOne({ followerId: senderId, followingId: receiverId, isActive: true }).lean();
        if (!follow) return { allowed: false, reason: 'Apenas seguidores podem enviar mensagens' };

        return { allowed: true };
    } catch (err) {
        console.error('[chatPermission] Erro ao verificar permissão:', err);
        return { allowed: false, reason: 'Erro ao verificar permissão' };
    }
}
