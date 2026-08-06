import { LiveNotification, DeviceToken } from '../models/index';
import { sendPushNotificationToMultiple } from './firebaseService';
import { getDb } from '../config/db';

interface NotificationPayload {
  userId: string;
  streamerId?: string;
  streamId?: string;
  message: string;
}

interface FcmPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export class NotificationService {

  private static async createLiveNotification(payload: NotificationPayload): Promise<void> {
    await LiveNotification.create({
      userId: payload.userId,
      streamerId: payload.streamerId || '',
      streamId: payload.streamId || '',
      message: payload.message,
      read: false,
      createdAt: new Date(),
    });
  }

  private static emitSocket(io: any, userId: string, eventData: Record<string, any>): void {
    if (!io) return;
    io.to(`user_${userId}`).emit('unread_notification', {
      ...eventData,
      timestamp: new Date().toISOString(),
    });
  }

  private static async sendFcm(userId: string, fcm: FcmPayload): Promise<void> {
    try {
      const tokens = await DeviceToken.find({ userId }).select('token').lean();
      const tokenList = tokens.map((t: any) => t.token);
      if (tokenList.length > 0) {
        await sendPushNotificationToMultiple(tokenList, {
          title: fcm.title,
          body: fcm.body,
          data: fcm.data || {},
        });
        console.log(`[NOTIFICATION] FCM enviado para ${tokenList.length} dispositivos de ${userId}`);
      }
    } catch (err) {
      console.warn('[NOTIFICATION] Erro FCM:', err);
    }
  }

  private static async sendFcmBatch(userIds: string[], fcm: FcmPayload): Promise<void> {
    try {
      const tokens = await DeviceToken.find({ userId: { $in: userIds } }).select('token').lean();
      const tokenList = tokens.map((t: any) => t.token);
      if (tokenList.length > 0) {
        await sendPushNotificationToMultiple(tokenList, {
          title: fcm.title,
          body: fcm.body,
          data: fcm.data || {},
        });
        console.log(`[NOTIFICATION] FCM batch enviado para ${tokenList.length} dispositivos`);
      }
    } catch (err) {
      console.warn('[NOTIFICATION] Erro FCM batch:', err);
    }
  }

  private static async isGiftNotificationEnabled(userId: string, giftId: string): Promise<boolean> {
    try {
      const db = getDb();
      const settings = await db.collection('giftnotificationsettings').findOne(
        { userId },
        { projection: { gifts: 1 } }
      );
      if (settings?.gifts && settings.gifts[giftId] === false) {
        return false;
      }
      return true;
    } catch {
      return true;
    }
  }

  static async notifyGiftReceived(
    io: any,
    toUserId: string,
    fromUserId: string,
    fromUserName: string,
    giftId: string,
    giftName: string,
    giftIcon: string,
    quantity: number,
    totalValue: number,
    streamId?: string,
  ): Promise<void> {
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

  static async notifyNewFollower(
    io: any,
    toUserId: string,
    followerId: string,
    followerName: string,
    followerAvatar: string,
  ): Promise<void> {
    const message = `${followerName} começou a seguir você`;

    await this.createLiveNotification({ userId: toUserId, streamerId: followerId, streamId: '', message });

    this.emitSocket(io, toUserId, {
      type: 'new_follower', followerId, followerName, followerAvatar, message,
    });

    // 🚫 Push FCM: SÓ título + corpo + rota (sem avatar — Firebase não carrega imagem).
    // O avatar segue apenas pelo socket (tempo real com o app aberto).
    await this.sendFcm(toUserId, {
      title: '👤 Novo seguidor!',
      body: message,
      data: {
        type: 'new_follower', followerId, followerName,
        click_action: 'OPEN_PROFILE',
      },
    });
  }

  static async notifyLiveStarted(
    io: any,
    hostId: string,
    hostName: string,
    hostAvatar: string,
    streamId: string,
    followerIds: string[],
  ): Promise<void> {
    if (!followerIds.length) return;

    const message = `${hostName || 'Alguém'} está ao vivo!`;

    const notifications = followerIds.map((uid: string) => ({
      userId: uid, streamerId: hostId, streamId,
      message, read: false, createdAt: new Date(),
    }));
    await LiveNotification.insertMany(notifications);

    if (io) {
      followerIds.forEach((fid: string) => {
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

  /**
   * Envia notificação push de live_started para TODOS os usuários que têm device token,
   * independente de seguir o streamer.
   * Usado pelo socket.on('live_started') para notificar todos os usuários do app.
   */
  static async notifyLiveStartedToAll(
    hostId: string,
    hostName: string,
    hostAvatar: string,
    streamId: string,
    streamTitle?: string,
  ): Promise<void> {
    const message = `${hostName || 'Alguém'} está ao vivo!`;

    try {
      // Buscar TODOS os device tokens (não apenas de seguidores)
      const allTokens = await DeviceToken.find({}).select('token userId').lean();
      const tokenList: string[] = allTokens.map((t: any) => t.token);

      if (tokenList.length === 0) {
        console.log('[NOTIFICATION] Nenhum device token encontrado para push de live_started');
        return;
      }

      console.log(`[NOTIFICATION] Enviando live_started push para ${tokenList.length} dispositivos`);

      // Firebase sendEachForMulticast aceita no máximo 500 tokens por chamada
      const CHUNK_SIZE = 500;
      for (let i = 0; i < tokenList.length; i += CHUNK_SIZE) {
        const chunk = tokenList.slice(i, i + CHUNK_SIZE);
        await sendPushNotificationToMultiple(chunk, {
          title: hostName || 'LiveGO',
          body: streamTitle || message,
          data: {
            type: 'live_started',
            streamKey: streamId,
            streamId,
            hostId,
            hostName: hostName || '',
            click_action: 'OPEN_STREAM',
          },
        });
        console.log(`[NOTIFICATION] Lote ${Math.floor(i / CHUNK_SIZE) + 1} de ${Math.ceil(tokenList.length / CHUNK_SIZE)} enviado`);
      }
    } catch (err) {
      console.warn('[NOTIFICATION] Erro ao enviar live_started push para todos:', err);
    }
  }

  static async notifyPhotoLiked(
    io: any,
    photoOwnerId: string,
    likerId: string,
    photoId: string,
  ): Promise<void> {
    if (photoOwnerId === likerId) return;
    const message = `Alguém curtiu sua foto`;

    await this.createLiveNotification({ userId: photoOwnerId, streamerId: likerId, streamId: '', message });
    this.emitSocket(io, photoOwnerId, { type: 'photo_liked', likerId, photoId, message });

    await this.sendFcm(photoOwnerId, {
      title: '📸 Novo like!', body: message,
      data: { type: 'photo_liked', photoId, click_action: 'OPEN_PHOTO' },
    });
  }

  static async notifyStreamLiked(
    io: any,
    streamOwnerId: string,
    likerId: string,
    streamId: string,
  ): Promise<void> {
    if (streamOwnerId === likerId) return;
    const message = `Alguém curtiu sua transmissão`;

    await this.createLiveNotification({ userId: streamOwnerId, streamerId: likerId, streamId, message });
    this.emitSocket(io, streamOwnerId, { type: 'stream_liked', likerId, streamId, message });

    await this.sendFcm(streamOwnerId, {
      title: '👍 Novo like!', body: message,
      data: { type: 'stream_liked', streamId, click_action: 'OPEN_STREAM' },
    });
  }

  static async notifyCommentReceived(
    io: any,
    contentOwnerId: string,
    commenterId: string,
    commenterName: string,
    targetId: string,
    targetType: 'photo' | 'video' | 'post',
  ): Promise<void> {
    if (contentOwnerId === commenterId) return;

    const labels: Record<string, string> = { photo: 'foto', video: 'vídeo', post: 'publicação' };
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

  static async notifyNewMessage(
    io: any,
    toUserId: string,
    fromUserId: string,
    fromUserName: string,
    preview: string,
    conversationId: string,
  ): Promise<void> {
    if (toUserId === fromUserId) return;

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

  static async notifyFriendInvite(
    io: any,
    toUserId: string,
    fromUserId: string,
    fromUserName: string,
    fromUserAvatar: string,
    inviteId: string,
    message?: string,
  ): Promise<void> {
    if (toUserId === fromUserId) return;

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

    // 🚫 Push FCM: sem avatar (Firebase não carrega imagem) — avatar só no socket.
    await this.sendFcm(toUserId, {
      title: '👥 Convite de amizade!',
      body: displayMessage,
      data: {
        type: 'friend_invite_received',
        fromUserId,
        fromUserName,
        inviteId,
        click_action: 'OPEN_FRIENDS',
      },
    });
  }

  static async notifyVideoLiked(
    io: any,
    videoOwnerId: string,
    likerId: string,
    videoId: string,
  ): Promise<void> {
    if (videoOwnerId === likerId) return;
    const message = `Alguém curtiu seu vídeo`;

    await this.createLiveNotification({ userId: videoOwnerId, streamerId: likerId, streamId: '', message });
    this.emitSocket(io, videoOwnerId, { type: 'video_liked', likerId, videoId, message });

    await this.sendFcm(videoOwnerId, {
      title: '🎬 Novo like no vídeo!', body: message,
      data: { type: 'video_liked', videoId, click_action: 'OPEN_VIDEO' },
    });
  }

  // ─── 6 novos métodos para migrar FCM inline ─────────────────────

  static async notifyCallInvitation(
    io: any,
    toUserId: string,
    fromUserId: string,
    fromUserName: string,
    invitationId: string,
    roomId: string,
    streamId: string,
  ): Promise<void> {
    if (toUserId === fromUserId) return;
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
        click_action: 'OPEN_INVITE',
      },
    });
  }

  static async notifyCallResponded(
    io: any,
    toUserId: string,
    responderId: string,
    responderName: string,
    invitationId: string,
    response: 'accepted' | 'declined',
    roomId?: string,
  ): Promise<void> {
    if (toUserId === responderId) return;

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
        click_action: 'OPEN_LIVE',
      },
    });
  }

  static async notifyLiveInvite(
    io: any,
    toUserId: string,
    fromUserId: string,
    fromUserName: string,
    inviteType: string,
    inviteId: string,
    streamId: string,
  ): Promise<void> {
    if (toUserId === fromUserId) return;

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

  static async notifyLiveInviteResponded(
    io: any,
    toUserId: string,
    responderId: string,
    responderName: string,
    inviteType: string,
    response: 'accepted' | 'declined',
    inviteId: string,
    streamId: string,
  ): Promise<void> {
    if (toUserId === responderId) return;

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

  static async notifyPrivateStreamInvite(
    io: any,
    toUserId: string,
    fromUserId: string,
    fromUserName: string,
    fromUserAvatar: string,
    streamId: string,
    streamName: string,
  ): Promise<void> {
    if (toUserId === fromUserId) return;
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

    // 🚫 Push FCM: sem avatar (Firebase não carrega imagem) — avatar só no socket.
    await this.sendFcm(toUserId, {
      title: message,
      body: 'Toque para entrar na sala',
      data: {
        type: 'private_stream_invite',
        streamId,
        fromUserId,
        fromUserName,
        click_action: 'OPEN_LIVE',
      },
    });
  }

  static async notifyViewerJoinedStream(
    io: any,
    hostId: string,
    viewerId: string,
    viewerName: string,
    streamId: string,
  ): Promise<void> {
    if (hostId === viewerId) return;
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
