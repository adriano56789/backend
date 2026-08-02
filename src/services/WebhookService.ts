interface WebhookRequest {
  event?: string;
  action?: string; // SRS compatible
  streamId?: string;
  stream?: string; // SRS compatible
  hostId?: string;
  payload?: any;
}

export class WebhookService {
  /**
   * Processes live webhook events and triggers appropriate platform logic.
   */
  public static async handleEvent(
    body: WebhookRequest,
    context: {
      users: any[];
      streamers: any[];
      chatMessages: any[];
      giftTransactions: any[];
      saveCollection: (name: string, data: any) => void;
      startFfmpegStream?: (streamId: string) => void;
      stopFfmpegStream?: (streamId: string) => void;
    }
  ): Promise<{ success: boolean; message: string; data?: any }> {
    const { users, streamers, chatMessages, giftTransactions, saveCollection, startFfmpegStream, stopFfmpegStream } = context;

    // Normalize input keys (handle custom platform payload AND SRS webhook style)
    const eventName = (body.event || body.action || '').trim();
    const streamId = (body.streamId || body.stream || 'test').trim();
    const hostId = (body.hostId || '').trim();
    const payload = body.payload || {};

    const cleanStreamId = streamId.startsWith('stream_') ? streamId.replace('stream_', '') : streamId;

    console.log(`📡 [SRS-Webhook-Recebimento] Recebido evento: \"${eventName}\" para a streamId: \"${streamId}\" (limpa: \"${cleanStreamId}\")`);

    if (!eventName) {
      console.warn('⚠️ [WebhookService] Evento nulo ou vazio recebido.');
      return { success: false, message: 'Event name is required' };
    }

    // Find stream in database using both raw and cleaned formats
    let streamIndex = streamers.findIndex(
      (s: any) => s.id === streamId || s.streamKey === streamId || s.hostId === streamId ||
                  s.id === cleanStreamId || s.streamKey === cleanStreamId || s.hostId === cleanStreamId
    );

    const generateUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };

    // Helper to get or create stream
    const getOrCreateStream = () => {
      if (streamIndex !== -1) {
        return streamers[streamIndex];
      }

      // Create a default stream record using the cleaned stream ID to link with a real user
      const finalHostId = hostId || cleanStreamId || '98501723';
      const hostUser = users.find((u: any) => u.id === finalHostId) || users[0];
      const hostName = hostUser ? (hostUser.name || hostUser.username || `Streamer ${finalHostId}`) : `Streamer ${finalHostId}`;
      const hostAvatar = hostUser?.avatarUrl || hostUser?.avatar || 'https://picsum.photos/200/200';
      const hostLocation = hostUser?.residence || hostUser?.country || 'Brasil';

      const newStream = {
        id: cleanStreamId,
        hostId: finalHostId,
        name: payload.name || `Live de ${hostName}`,
        message: payload.message || 'Vem que a live tá on!',
        category: payload.category || 'popular',
        isPrivate: payload.isPrivate || false,
        tags: hostUser?.tags || ['Aconchego'],
        avatar: hostAvatar,
        location: hostLocation,
        country: hostUser?.country?.toLowerCase() || 'br',
        isLive: true,
        viewers: 1,
        startTime: new Date().toISOString(),
        hlsUrl: `/api/video/http/live/${cleanStreamId}.m3u8`,
        webrtcUrl: `${(process.env.SRS_WEBRTC_URL || 'webrtc://livego.store').includes(':8000') || (process.env.SRS_WEBRTC_URL || 'webrtc://livego.store').includes(':7800') ? (process.env.SRS_WEBRTC_URL || 'webrtc://livego.store') : (process.env.SRS_WEBRTC_URL || 'webrtc://livego.store') + ':8000'}/live/${cleanStreamId}`,
        playbackUrl: `/api/video/http/live/${cleanStreamId}.flv`,
      };

      streamers.push(newStream);
      streamIndex = streamers.length - 1;
      
      console.log(`🗄️ [WebhookService-DB] Salvando nova stream no banco: streamers.json`);
      saveCollection('streamers', streamers);
      return streamers[streamIndex];
    };

    // Process event types
    const normalizedEvent = eventName.toLowerCase().replace(/_/g, ' ');

    switch (normalizedEvent) {
      // 1. Stream Started
      case 'stream started':
      case 'on publish': {
        const stream = getOrCreateStream();
        stream.isLive = true;
        
        // Update user state
        const hostUser = users.find((u: any) => u.id === stream.hostId);
        if (hostUser) {
          hostUser.isLive = true;
          console.log(`🗄️ [WebhookService-DB] Atualizando isLive=true para o hostUser: \"${hostUser.id}\"`);
          saveCollection('users', users);
        }

        console.log(`🗄️ [WebhookService-DB] Atualizando isLive=true para a stream \"${stream.id}\" no banco`);
        saveCollection('streamers', streamers);

        // Trigger real FFmpeg processing (transcoding and recording) on SRS media receipt
        if (startFfmpegStream) {
          console.log(`🎬 [WebhookService-FFMPEG] Starting FFmpeg transcoding and recording for stream: ${stream.id}`);
          startFfmpegStream(stream.id);
        }


        console.log(`✅ [WebhookService] Stream \"${stream.id}\" iniciada com sucesso via Webhook.`);
        return { success: true, message: 'Stream started successfully', data: stream };
      }

      // 2. Stream Ended / Live Stream Ended / Stream Stopped
      case 'stream ended':
      case 'live stream ended':
      case 'stream stopped':
      case 'on unpublish': {
        if (streamIndex !== -1) {
          const stream = streamers[streamIndex];
          stream.isLive = false;

          // Update user state
          const hostUser = users.find((u: any) => u.id === stream.hostId);
          if (hostUser) {
            hostUser.isLive = false;
            console.log(`🗄️ [WebhookService-DB] Atualizando isLive=false para o hostUser: \"${hostUser.id}\"`);
            saveCollection('users', users);
          }

          console.log(`🗄️ [WebhookService-DB] Atualizando isLive=false para a stream \"${stream.id}\" no banco`);
          saveCollection('streamers', streamers);

          // Stop FFmpeg stream processing
          if (stopFfmpegStream) {
            console.log(`🎬 [WebhookService-FFMPEG] Stopping FFmpeg process for stream: ${stream.id}`);
            stopFfmpegStream(stream.id);
          }

          const eventData = { streamId: stream.id, hostId: stream.hostId, timestamp: new Date().toISOString() };


          console.log(`✅ [WebhookService] Stream \"${stream.id}\" encerrada.`);
          return { success: true, message: `Stream ended successfully via event ${eventName}`, data: eventData };
        }
        return { success: false, message: 'Stream not found' };
      }

      // 2B. Audience connected (Play started)
      case 'on play': {
        if (streamIndex !== -1) {
          const stream = streamers[streamIndex];
          stream.viewers = (stream.viewers || 0) + 1;
          
          console.log(`🗄️ [WebhookService-DB] Incrementando espectadores para \"${stream.id}\": ${stream.viewers}`);
          saveCollection('streamers', streamers);

          
          return { success: true, message: 'Play event registered', data: { streamId: stream.id, viewers: stream.viewers } };
        }
        return { success: false, message: 'Stream not found for play event' };
      }

      // 2C. Audience disconnected (Play stopped)
      case 'on stop': {
        if (streamIndex !== -1) {
          const stream = streamers[streamIndex];
          stream.viewers = Math.max(0, (stream.viewers || 1) - 1);
          
          console.log(`🗄️ [WebhookService-DB] Decrementando espectadores para \"${stream.id}\": ${stream.viewers}`);
          saveCollection('streamers', streamers);

          
          return { success: true, message: 'Stop event registered', data: { streamId: stream.id, viewers: stream.viewers } };
        }
        return { success: false, message: 'Stream not found for stop event' };
      }

      // 3. New Live Created
      case 'new live created':
      case 'new live': {
        const stream = getOrCreateStream();
        console.log(`🗄️ [WebhookService-DB] Salvando nova live criada: \"${stream.id}\"`);
        saveCollection('streamers', streamers);


        console.log(`✅ [WebhookService] Nova live criada: \"${stream.id}\"`);
        return { success: true, message: 'New live created successfully', data: stream };
      }

      // 4. Card Removed
      case 'card removed': {
        if (streamIndex !== -1) {
          const stream = streamers[streamIndex];
          const hostIdToDelete = stream.hostId;
          const streamIdToDelete = stream.id;

          // Filter out stream completely
          streamers.splice(streamIndex, 1);
          saveCollection('streamers', streamers);

          // Update user state
          const hostUser = users.find((u: any) => u.id === hostIdToDelete);
          if (hostUser) {
            hostUser.isLive = false;
            saveCollection('users', users);
          }

          const eventData = { streamId: streamIdToDelete, hostId: hostIdToDelete, timestamp: new Date().toISOString() };


          console.log(`✅ [WebhookService] Card da stream \"${streamIdToDelete}\" removido do sistema.`);
          return { success: true, message: 'Card removed successfully', data: eventData };
        }
        return { success: false, message: 'Stream not found for card removal' };
      }

      // 5. Social Interactions (Chat, reactions, likes, gifts)
      case 'social interaction':
      case 'chat':
      case 'like':
      case 'reaction':
      case 'gift':
      case 'chat message': {
        const type = (payload.type || eventName).toLowerCase();
        
        // A. Chat Message
        if (type.includes('chat') || type.includes('message')) {
          const userId = payload.userId || 'system';
          const userName = payload.userName || 'Sistema';
          const userAvatar = payload.userAvatar || 'https://picsum.photos/200/200';
          const messageText = payload.message || '';

          const newMessage = {
            id: `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            roomId: streamId,
            from: userId,
            to: streamId,
            text: messageText,
            imageUrl: '',
            timestamp: Date.now(),
            status: 'sent'
          };

          chatMessages.push(newMessage);
          saveCollection('chatmessages', chatMessages);


          console.log(`💬 [WebhookService] Chat na sala \"${streamId}\": ${userName}: ${messageText}`);
          return { success: true, message: 'Chat message processed successfully', data: newMessage };
        }

        // B. Reação / Like
        if (type.includes('like') || type.includes('reaction')) {
          const userName = payload.userName || 'Alguém';
          const count = payload.count || 1;

          // Increment in streamers database
          if (streamIndex !== -1) {
            streamers[streamIndex].likes = (streamers[streamIndex].likes || 0) + count;
            saveCollection('streamers', streamers);
          }


          console.log(`❤️ [WebhookService] Like recebido na sala \"${streamId}\" de: ${userName}`);
          return { success: true, message: 'Reaction processed successfully' };
        }

        // C. Presente / Gift
        if (type.includes('gift')) {
          const fromUserId = payload.fromUserId || '98501723';
          const toUserId = payload.toUserId || hostId || 'host';
          const giftId = payload.giftId || 'gold_rose';
          const giftName = payload.giftName || 'Rosa de Ouro';
          const price = payload.price || 10;
          const quantity = payload.quantity || 1;
          const totalValue = price * quantity;

          // Database transaction
          const transaction = {
            id: `gift_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            fromUserId,
            toUserId,
            giftId,
            giftName,
            price,
            quantity,
            totalValue,
            timestamp: Date.now()
          };

          giftTransactions.push(transaction);
          saveCollection('gift_transactions', giftTransactions);

          // Balance transfer
          const sender = users.find((u: any) => u.id === fromUserId);
          const receiver = users.find((u: any) => u.id === toUserId);

          if (sender) {
            sender.diamonds = Math.max(0, (sender.diamonds || 0) - totalValue);
          }
          if (receiver) {
            receiver.earnings = (receiver.earnings || 0) + totalValue;
          }
          saveCollection('users', users);


          // 📡 Notas: eventos user-specific (diamonds_updated, earnings_updated)
          // são gerenciados pelo frontend via polling (useCurrentUserPolling)
          // não se conecta a salas de notificação individuais.

          console.log(`🎁 [WebhookService] Presente na sala \"${streamId}\": ${giftName} x${quantity} de ${sender?.name || fromUserId}`);
          return { success: true, message: 'Gift transaction completed successfully', data: transaction };
        }

        return { success: false, message: `Unknown social interaction type: ${type}` };
      }

      default: {
        console.log(`⚠️ [WebhookService] Evento não tratado: \"${eventName}\"`);
        return { success: false, message: `Event type \"${eventName}\" is not supported` };
      }
    }
  }
}
