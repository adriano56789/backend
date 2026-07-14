import { useState, useEffect, useRef, useCallback } from 'react';
import { Room, RoomEvent, RemoteParticipant } from 'livekit-client';
import { livekitApi } from '../services/livekit/livekitApi';

// Maximum message size for LiveKit DataPacket (~16KB)
const MAX_MESSAGE_SIZE = 16384;
const MAX_RETRIES = 3;

interface LiveKitChatOptions {
  streamId: string;
  userId: string;
  onMessage?: (data: any) => void;
  onParticipantConnected?: (participant: RemoteParticipant) => void;
  onParticipantDisconnected?: (participant: RemoteParticipant) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onReconnecting?: () => void;
  onReconnected?: () => void;
}

function getRetryDelay(attempt: number): number {
  // Exponential backoff: 2s, 4s, 8s
  return Math.min(2000 * Math.pow(2, attempt - 1), 8000);
}

export function useLiveKitChat(options: LiveKitChatOptions) {
  const { streamId, userId } = options;
  const roomRef = useRef<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const optionsRef = useRef(options);
  const destroyedRef = useRef(false);
  const onMessageRef = useRef(options.onMessage);

  useEffect(() => {
    optionsRef.current = options;
    onMessageRef.current = options.onMessage;
  }, [options]);

  useEffect(() => {
    let destroyed = false;
    let retryCount = 0;

    const connectWithRetry = async () => {
      while (retryCount <= MAX_RETRIES && !destroyed) {
        try {
          const { token, serverUrl } = await livekitApi.getChatToken(streamId);
          if (destroyed) return;

          const room = new Room({
            adaptiveStream: false,
            dynacast: false,
          });

          // Register ALL listeners BEFORE connect() — per LiveKit best practices
          room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant, kind, topic?: string) => {
            try {
              if (topic && topic !== 'livechat') return;

              const decoder = new TextDecoder();
              const text = decoder.decode(payload);
              const data = JSON.parse(text);
              if (onMessageRef.current && data) {
                onMessageRef.current(data);
              }
            } catch (err) {
              console.warn('[LiveKitChat] Erro ao decodificar mensagem:', err);
            }
          });

          room.on(RoomEvent.Connected, () => {
            if (destroyed) return;
            retryCount = 0;
            setConnected(true);
            optionsRef.current.onConnected?.();
            console.log('[LiveKitChat] Conectado à sala live_' + streamId);
          });

          room.on(RoomEvent.Disconnected, () => {
            if (destroyed) return;
            setConnected(false);
            optionsRef.current.onDisconnected?.();
          });

          room.on(RoomEvent.Reconnecting, () => {
            if (destroyed) return;
            console.log('[LiveKitChat] Reconectando...');
            optionsRef.current.onReconnecting?.();
          });

          room.on(RoomEvent.Reconnected, () => {
            if (destroyed) return;
            setConnected(true);
            optionsRef.current.onReconnected?.();
            console.log('[LiveKitChat] Reconectado à sala live_' + streamId);
          });

          room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
            if (destroyed) return;
            console.log('[LiveKitChat] Participante entrou:', participant.identity);
            optionsRef.current.onParticipantConnected?.(participant);
          });

          room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
            if (destroyed) return;
            console.log('[LiveKitChat] Participante saiu:', participant.identity);
            optionsRef.current.onParticipantDisconnected?.(participant);
          });

          await room.connect(serverUrl, token);
          roomRef.current = room;
          return;

        } catch (err) {
          retryCount++;
          if (destroyed) return;
          
          if (retryCount <= MAX_RETRIES) {
            const delay = getRetryDelay(retryCount);
            console.warn(
              `[LiveKitChat] Erro ao conectar (tentativa ${retryCount}/${MAX_RETRIES}), tentando novamente em ${delay}ms:`,
              err
            );
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            console.warn('[LiveKitChat] Erro ao conectar após', MAX_RETRIES, 'tentativas:', err);
          }
        }
      }
    };

    connectWithRetry();

    return () => {
      destroyed = true;
      destroyedRef.current = true;
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, [streamId, userId]);

  const sendMessage = useCallback((payload: any) => {
    if (!roomRef.current || roomRef.current.state !== 'connected') return;
    
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify({
        type: 'chat_message',
        ...payload
      }));

      if (data.byteLength > MAX_MESSAGE_SIZE) {
        console.warn('[LiveKitChat] Mensagem muito grande (' + data.byteLength + ' bytes, máximo ' + MAX_MESSAGE_SIZE + ')');
        return;
      }

      roomRef.current.localParticipant.publishData(data, { reliable: true });
    } catch (err) {
      console.warn('[LiveKitChat] Erro ao enviar mensagem:', err);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setConnected(false);
  }, []);

  return {
    connected,
    sendMessage,
    disconnect,
  };
}
