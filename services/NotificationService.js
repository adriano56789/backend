"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const index_1 = require("../models/index");
const firebaseService_1 = require("./firebaseService");
const db_1 = require("../config/db");
class NotificationService {
    static async createLiveNotification(payload) {
        await index_1.LiveNotification.create({
            userId: payload.userId,
            streamerId: payload.streamerId || '',
            streamId: payload.streamId || '',
            message: payload.message,
            read: false,
            createdAt: new Date(),
        });
    }
    static emitSocket(io, userId, eventData) {
        if (!io)
            return;
        io.to(`user_${userId}`).emit('unread_notification', {
            ...eventData,
            timestamp: new Date().toISOString(),
        });
    }
    static async sendFcm(userId, fcm) {
        try {
            const tokens = await index_1.DeviceToken.find({ userId }).select('token').lean();
            const tokenList = tokens.map((t) => t.token);
            if (tokenList.length > 0) {
                await (0, firebaseService_1.sendPushNotificationToMultiple)(tokenList, {
                    title: fcm.title,
                    body: fcm.body,
                    data: fcm.data || {},
                });
                console.log(`[NOTIFICATION] FCM enviado para ${tokenList.length} dispositivos de ${userId}`);
            }
        }
        catch (err) {
            console.warn('[NOTIFICATION] Erro FCM:', err);
        }
    }
    static async sendFcmBatch(userIds, fcm) {
        try {
            const tokens = await index_1.DeviceToken.find({ userId: { $in: userIds } }).select('token').lean();
            const tokenList = tokens.map((t) => t.token);
            if (tokenList.length > 0) {
                await (0, firebaseService_1.sendPushNotificationToMultiple)(tokenList, {
                    title: fcm.title,
                    body: fcm.body,
                    data: fcm.data || {},
                });
                console.log(`[NOTIFICATION] FCM batch enviado para ${tokenList.length} dispositivos`);
            }
        }
        catch (err) {
            console.warn('[NOTIFICATION] Erro FCM batch:', err);
        }
    }
    static async isGiftNotificationEnabled(userId, giftId) {
        try {
            const db = (0, db_1.getDb)();
            const settings = await db.collection('giftnotificationsettings').findOne({ userId }, { projection: { gifts: 1 } });
            if (settings?.gifts && settings.gifts[giftId] === false) {
                return false;
            }
            return true;
        }
        catch {
            return true;
        }
    }
    static async notifyGiftReceived(io, toUserId, fromUserId, fromUserName, giftId, giftName, giftIcon, quantity, totalValue, streamId) {
        const enabled = await this.isGiftNotificationEnabled(toUserId, giftId);
        if (!enabled) {
            console.log(`[NOTIFICATION] Notificação de presente suprimida para ${toUserId} (gift ${giftName})`);
            return;
        }
        const message = `${fromUserName} enviou ${quantity}x ${giftName}`;
        await this.createLiveNotification({ userId: toUserId, streamerId: fromUserId, streamId, message });
        this.emitSocket(io, toUserId, {
            type: 'gift_received', fromUserId, fromUserName, fromUserAvatar: '',
            giftName, giftIcon, quantity, totalValue,
            streamId: streamId || '', message,
        });
        await this.sendFcm(toUserId, {
            title: '🎁 Presente recebido!',
            body: message,
            data: {
                type: 'gift_received', fromUserId, fromUserName,
                giftName, giftIcon: giftIcon || '',
                quantity: String(quantity), totalValue: String(totalValue),
                streamId: streamId || '', click_action: 'OPEN_GIFT',
            },
        });
    }
    static async notifyNewFollower(io, toUserId, followerId, followerName, followerAvatar) {
        const message = `${followerName} começou a seguir você`;
        await this.createLiveNotification({ userId: toUserId, streamerId: followerId, streamId: '', message });
        this.emitSocket(io, toUserId, {
            type: 'new_follower', followerId, followerName, followerAvatar, message,
        });
        await this.sendFcm(toUserId, {
            title: '👤 Novo seguidor!',
            body: message,
            data: {
                type: 'new_follower', followerId, followerName,
                followerAvatar: followerAvatar || '', click_action: 'OPEN_PROFILE',
            },
        });
    }
    static async notifyLiveStarted(io, hostId, hostName, hostAvatar, streamId, followerIds) {
        if (!followerIds.length)
            return;
        const message = `${hostName || 'Alguém'} está ao vivo!`;
        const notifications = followerIds.map((uid) => ({
            userId: uid, streamerId: hostId, streamId,
            message, read: false, createdAt: new Date(),
        }));
        await index_1.LiveNotification.insertMany(notifications);
        if (io) {
            followerIds.forEach((fid) => {
                io.to(`user_${fid}`).emit('unread_notification', {
                    type: 'live_started', streamerId: hostId, streamId,
                    message, avatar: hostAvatar,
                    timestamp: new Date().toISOString(),
                });
            });
        }
        await this.sendFcmBatch(followerIds, {
            title: hostName || 'LiveGO',
            body: message,
            data: {
                type: 'live_started', streamKey: streamId, streamId, hostId,
                click_action: 'OPEN_STREAM',
            },
        });
    }
    static async notifyPhotoLiked(io, photoOwnerId, likerId, photoId) {
        if (photoOwnerId === likerId)
            return;
        const message = `Alguém curtiu sua foto`;
        await this.createLiveNotification({ userId: photoOwnerId, streamerId: likerId, streamId: '', message });
        this.emitSocket(io, photoOwnerId, { type: 'photo_liked', likerId, photoId, message });
        await this.sendFcm(photoOwnerId, {
            title: '📸 Novo like!', body: message,
            data: { type: 'photo_liked', photoId, click_action: 'OPEN_PHOTO' },
        });
    }
    static async notifyStreamLiked(io, streamOwnerId, likerId, streamId) {
        if (streamOwnerId === likerId)
            return;
        const message = `Alguém curtiu sua transmissão`;
        await this.createLiveNotification({ userId: streamOwnerId, streamerId: likerId, streamId, message });
        this.emitSocket(io, streamOwnerId, { type: 'stream_liked', likerId, streamId, message });
        await this.sendFcm(streamOwnerId, {
            title: '👍 Novo like!', body: message,
            data: { type: 'stream_liked', streamId, click_action: 'OPEN_STREAM' },
        });
    }
    static async notifyCommentReceived(io, contentOwnerId, commenterId, commenterName, targetId, targetType) {
        if (contentOwnerId === commenterId)
            return;
        const labels = { photo: 'foto', video: 'vídeo', post: 'publicação' };
        const label = labels[targetType] || 'publicação';
        const message = `${commenterName} comentou em sua ${label}`;
        await this.createLiveNotification({ userId: contentOwnerId, streamerId: commenterId, streamId: '', message });
        this.emitSocket(io, contentOwnerId, {
            type: 'comment_received',
            commenterId,
            commenterName,
            targetId,
            targetType,
            message,
        });
        await this.sendFcm(contentOwnerId, {
            title: '💬 Novo comentário!',
            body: message,
            data: {
                type: 'comment_received',
                commenterId,
                commenterName,
                targetId,
                targetType,
                click_action: 'OPEN_CONTENT',
            },
        });
    }
    static async notifyNewMessage(io, toUserId, fromUserId, fromUserName, preview, conversationId) {
        if (toUserId === fromUserId)
            return;
        const isImage = preview.startsWith('http') || preview.startsWith('data:image');
        const displayPreview = isImage ? '[Imagem]' : preview.substring(0, 100);
        const message = `${fromUserName}: ${displayPreview}`;
        await this.createLiveNotification({ userId: toUserId, streamerId: fromUserId, streamId: '', message });
        this.emitSocket(io, toUserId, {
            type: 'new_message',
            fromUserId,
            fromUserName,
            preview: displayPreview,
            conversationId,
            message,
        });
        await this.sendFcm(toUserId, {
            title: fromUserName,
            body: displayPreview,
            data: {
                type: 'new_message',
                from: fromUserId,
                fromUserName: fromUserName,
                conversationId,
                click_action: 'OPEN_CHAT',
            },
        });
    }
    static async notifyFriendInvite(io, toUserId, fromUserId, fromUserName, fromUserAvatar, inviteId, message) {
        if (toUserId === fromUserId)
            return;
        const displayMessage = `${fromUserName} enviou um convite de amizade`;
        await this.createLiveNotification({ userId: toUserId, streamerId: fromUserId, streamId: '', message: displayMessage });
        this.emitSocket(io, toUserId, {
            type: 'friend_invite_received',
            fromUserId,
            fromUserName,
            fromUserAvatar: fromUserAvatar || '',
            inviteId,
            customMessage: message || '',
            message: displayMessage,
        });
        await this.sendFcm(toUserId, {
            title: '👥 Convite de amizade!',
            body: displayMessage,
            data: {
                type: 'friend_invite_received',
                fromUserId,
                fromUserName,
                fromUserAvatar: fromUserAvatar || '',
                inviteId,
                click_action: 'OPEN_FRIENDS',
            },
        });
    }
    static async notifyVideoLiked(io, videoOwnerId, likerId, videoId) {
        if (videoOwnerId === likerId)
            return;
        const message = `Alguém curtiu seu vídeo`;
        await this.createLiveNotification({ userId: videoOwnerId, streamerId: likerId, streamId: '', message });
        this.emitSocket(io, videoOwnerId, { type: 'video_liked', likerId, videoId, message });
        await this.sendFcm(videoOwnerId, {
            title: '🎬 Novo like no vídeo!', body: message,
            data: { type: 'video_liked', videoId, click_action: 'OPEN_VIDEO' },
        });
    }
    // ─── 6 novos métodos para migrar FCM inline ─────────────────────
    static async notifyCallInvitation(io, toUserId, fromUserId, fromUserName, invitationId, roomId, streamId, livekitRoom) {
        if (toUserId === fromUserId)
            return;
        const message = `${fromUserName} está te chamando!`;
        await this.createLiveNotification({ userId: toUserId, streamerId: fromUserId, streamId: '', message });
        this.emitSocket(io, toUserId, {
            type: 'call_invitation',
            action: 'invitation_received',
            invitationId,
            fromUserId,
            fromUserName,
            roomId,
            streamId,
            livekitRoom,
            message,
        });
        await this.sendFcm(toUserId, {
            title: message,
            body: 'Toque para abrir o convite de chamada',
            data: {
                type: 'call_invitation',
                action: 'invitation_received',
                invitationId,
                fromUserId,
                fromUserName,
                roomId,
                streamId,
                livekitRoom,
                click_action: 'OPEN_INVITE',
            },
        });
    }
    static async notifyCallResponded(io, toUserId, responderId, responderName, invitationId, response, roomId, livekitRoom) {
        if (toUserId === responderId)
            return;
        const responseLabel = response === 'accepted' ? 'aceitou' : 'recusou';
        const message = `${responderName} ${responseLabel} sua chamada`;
        const title = response === 'accepted'
            ? `${responderName} aceitou sua chamada!`
            : `${responderName} recusou sua chamada`;
        await this.createLiveNotification({ userId: toUserId, streamerId: responderId, streamId: '', message });
        this.emitSocket(io, toUserId, {
            type: 'call_invitation',
            action: response === 'accepted' ? 'invitation_accepted' : 'invitation_declined',
            invitationId,
            responderId,
            responderName,
            roomId: roomId || '',
            livekitRoom: livekitRoom || '',
            message,
        });
        await this.sendFcm(toUserId, {
            title,
            body: 'Toque para voltar à transmissão',
            data: {
                type: 'call_invitation',
                action: response === 'accepted' ? 'invitation_accepted' : 'invitation_declined',
                invitationId,
                responderId,
                responderName,
                roomId: roomId || '',
                livekitRoom: livekitRoom || '',
                click_action: 'OPEN_LIVE',
            },
        });
    }
    static async notifyLiveInvite(io, toUserId, fromUserId, fromUserName, inviteType, inviteId, streamId) {
        if (toUserId === fromUserId)
            return;
        const inviteLabel = inviteType === 'pk-battle' ? 'Batalha PK' : 'Co-Host';
        const message = `${fromUserName} te convidou para ${inviteLabel}!`;
        await this.createLiveNotification({ userId: toUserId, streamerId: fromUserId, streamId, message });
        this.emitSocket(io, toUserId, {
            type: 'live_invite',
            inviteType,
            inviteId,
            fromUserId,
            fromUserName,
            streamId,
            message,
        });
        await this.sendFcm(toUserId, {
            title: message,
            body: 'Toque para participar',
            data: {
                type: 'live_invite',
                inviteType,
                inviteId,
                fromUserId,
                fromUserName,
                streamId,
                click_action: 'OPEN_INVITE',
            },
        });
    }
    static async notifyLiveInviteResponded(io, toUserId, responderId, responderName, inviteType, response, inviteId, streamId) {
        if (toUserId === responderId)
            return;
        const inviteLabel = inviteType === 'pk-battle' ? 'Batalha PK' : 'Co-Host';
        const responseLabel = response === 'accepted' ? 'aceitou' : 'recusou';
        const message = `${responderName} ${responseLabel} seu convite de ${inviteLabel}`;
        const title = `${responderName || 'Convidado'} ${responseLabel} seu convite de ${inviteLabel}`;
        await this.createLiveNotification({ userId: toUserId, streamerId: responderId, streamId, message });
        this.emitSocket(io, toUserId, {
            type: 'live_invite_response',
            inviteId,
            status: response,
            inviteType,
            responderId,
            responderName,
            streamId,
            message,
        });
        await this.sendFcm(toUserId, {
            title,
            body: response === 'accepted' ? 'Toque para iniciar' : 'Toque para ver detalhes',
            data: {
                type: 'live_invite_response',
                inviteId,
                status: response,
                inviteType,
                responderId,
                responderName,
                streamId,
                click_action: response === 'accepted' ? 'OPEN_LIVE' : 'OPEN_INVITE',
            },
        });
    }
    static async notifyPrivateStreamInvite(io, toUserId, fromUserId, fromUserName, fromUserAvatar, streamId, streamName) {
        if (toUserId === fromUserId)
            return;
        const message = `${fromUserName} te convidou para uma transmissão privada!`;
        await this.createLiveNotification({ userId: toUserId, streamerId: fromUserId, streamId, message });
        this.emitSocket(io, toUserId, {
            type: 'private_stream_invite',
            streamId,
            streamName,
            fromUserId,
            fromUserName,
            fromUserAvatar: fromUserAvatar || '',
            message,
        });
        await this.sendFcm(toUserId, {
            title: message,
            body: 'Toque para entrar na sala',
            data: {
                type: 'private_stream_invite',
                streamId,
                fromUserId,
                fromUserName,
                fromUserAvatar: fromUserAvatar || '',
                click_action: 'OPEN_LIVE',
            },
        });
    }
    static async notifyViewerJoinedStream(io, hostId, viewerId, viewerName, streamId) {
        if (hostId === viewerId)
            return;
        const message = `${viewerName} entrou na sua live!`;
        await this.createLiveNotification({ userId: hostId, streamerId: viewerId, streamId, message });
        this.emitSocket(io, hostId, {
            type: 'user_joined_stream',
            streamId,
            viewerId,
            viewerName,
            message,
        });
        await this.sendFcm(hostId, {
            title: message,
            body: 'Toque para ver quem está assistindo',
            data: {
                type: 'user_joined_stream',
                streamId,
                viewerId,
                viewerName,
                click_action: 'OPEN_LIVE',
            },
        });
    }
}
exports.NotificationService = NotificationService;
