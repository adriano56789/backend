import { Streamer, User, LiveCard, LiveMessage, Battle } from '../models';
import { normalizeStreamId } from '../utils/streamKeyUtils';

/**
 * ═══════════════════════════════════════════════════════════════════
 * CENTRAL STREAM SERVICE — Rodada 2+3: Anti-duplicidade + Encerramento
 * ═══════════════════════════════════════════════════════════════════
 *
 * Todas as operações de encerramento de live passam por aqui.
 * Rotas (/live/end, /live/clear, on_unpublish) chamam endLive()
 * que garante consistência no banco (Streamer + LiveCard + User).
 */

// ─── Rodada 2: Anti-duplicidade ─────────────────────────────────────
// Prevenir que o mesmo host tenha mais de uma live ativa ao mesmo tempo.
// Retorna { ok, streamId } ou { ok: false, reason }.
export async function guardDuplicateLive(hostId: string): Promise<{ ok: boolean; streamId?: string; reason?: string }> {
  const existing: any = await Streamer.findOne({
    hostId,
    isLive: true,
    streamStatus: { $in: ['active', 'preparing'] }
  }).lean();

  if (existing) {
    const sid = existing.id || existing.streamKey || '';
    console.log(`[ANTI-DUP] Host ${hostId} já tem live ativa: ${sid} (status=${existing.streamStatus})`);
    return { ok: false, streamId: sid, reason: 'User already has an active stream' };
  }
  return { ok: true };
}

/**
 * Rodada 3: Centralizar encerramento — única função que modifica o banco e emite eventos.
 * Todas as rotas (/live/end, /live/clear, on_unpublish, on_unpublish hook)
 * devem chamar esta função.
 *
 * @param endedBy Quem encerrou: 'owner' | 'disconnect' | 'admin' | 'clear'
 */
export async function endLive(
  streamKeyOrId: string,
  io?: any,
  endedBy: 'owner' | 'disconnect' | 'admin' | 'clear' = 'owner'
): Promise<{ ok: boolean; streamId?: string; error?: string }> {
  try {
    const normalizedId = normalizeStreamId(streamKeyOrId);

    const stream: any = await Streamer.findOne({
      $or: [
        { id: normalizedId },
        { streamKey: streamKeyOrId }
      ]
    }).lean();

    if (!stream) {
      console.log(`[END-LIVE] Stream ${streamKeyOrId} não encontrada — nada a encerrar`);
      return { ok: false, error: 'Stream not found' };
    }
    if (!stream.isLive) {
      console.log(`[END-LIVE] Stream ${streamKeyOrId} já está encerrada — ignorando`);
      return { ok: true, streamId: stream.id }; // Idempotente
    }

    const streamId = stream.id || normalizedId;
    const hostId = stream.hostId;

    // ── 1. Atualizar Streamer ──
    await Streamer.updateOne(
      { id: streamId },
      {
        $set: {
          isLive: false,
          streamStatus: 'ended',
          endTime: new Date(),
          endedBy
        }
      }
    );

    // ── 2. Atualizar LiveCard ──
    if (hostId) {
      await LiveCard.updateOne(
        { hostId },
        {
          $set: {
            isLive: false,
            streamStatus: 'ended',
            endTime: new Date(),
            updatedAt: new Date()
          }
        }
      );
    }

    // ── 3. Atualizar User (host) ──
    if (hostId) {
      await User.updateOne(
        { id: hostId },
        {
          $set: {
            isLive: false,
            currentStreamId: null,
            lastSeen: new Date()
          }
        }
      );
    }

    // ── 4. 🧹 Chat morre com a transmissão ──
    try {
      const result = await LiveMessage.deleteMany({ streamId: String(streamId) });
      console.log(`[END-LIVE] 🧹 Chat apagado: ${result?.deletedCount ?? 0} mensagens`);
    } catch (_) {}

    // ── 5. Limpar currentStreamId de TODOS os espectadores ──
    try {
      await User.updateMany(
        { currentStreamId: streamId },
        { $set: { currentStreamId: null } }
      );
    } catch (_) {}

    // ── 6. Encerrar PK battle ativa ──
    try {
      const activeBattle: any = await Battle.findOne({
        $or: [
          { streamerA: hostId },
          { streamerB: hostId },
          { streamerA: streamId },
          { streamerB: streamId }
        ],
        status: 'active'
      }).lean();
      if (activeBattle) {
        await Battle.findOneAndUpdate(
          { _id: activeBattle._id },
          { $set: { status: 'finished', endedAt: new Date(), winner: null } }
        );
      }
    } catch (_) {}

    // ── 7. Emitir eventos Socket.IO (trio completo) ──
    if (io) {
      const payload = {
        streamId,
        hostId: hostId || '',
        timestamp: new Date().toISOString()
      };
      // Eventos globais (removem card da lista)
      io.emit('card_removed', payload);
      io.emit('stream_ended', payload);
      io.emit('stream_stopped', payload);
      // Eventos na sala específica (espectadores dentro da live)
      io.to(String(streamId)).emit('stream_ended', payload);
      io.to(String(streamId)).emit('live_stream_ended', payload);
    }

    console.log(`[END-LIVE] ✅ Live ${streamKeyOrId} encerrada (endedBy=${endedBy})`);
    return { ok: true, streamId };
  } catch (err: any) {
    console.error('[END-LIVE] Erro ao encerrar stream:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Rodada 1: Auto-encerramento por desconexão (mantido para compatibilidade)
 * Delega para endLive() com endedBy='disconnect'
 */
export async function autoEndStreamOnDisconnect(streamKey: string, io?: any): Promise<void> {
  await endLive(streamKey, io, 'disconnect');
}

/**
 * Rodada 4: Reconciliar banco vs SRS
 * Verifica streams marcadas como "isLive=true" no banco mas que não têm
 * publicação ativa no SRS. Limpa essas streams "fantasma".
 *
 * Retorna o número de streams limpas.
 */
export async function reconcileDeadStreams(io?: any): Promise<number> {
  try {
    // Buscar streams marcadas como ativas no banco
    const liveStreams: any[] = await Streamer.find({
      isLive: true,
      streamStatus: { $in: ['active', 'preparing'] }
    }).lean();

    if (liveStreams.length === 0) return 0;

    let cleaned = 0;

    for (const stream of liveStreams) {
      const streamId = stream.id;
      const streamKey = stream.streamKey || streamId;

      // Verificar se o host ainda está marcado como live
      const host: any = await User.findOne({ id: stream.hostId }).lean();
      if (!host || !host.isLive) {
        // Host não está mais live — stream fantasma
        console.log(`[RECONCILE] 🧹 Stream ${streamId} (hostId=${stream.hostId}) marcada como live mas host offline → limpando`);
        await endLive(streamKey, io, 'disconnect');
        cleaned++;
        continue;
      }

      // Verificar lastHeartbeat: se >30s sem heartbeat, considerar morta
      if (stream.lastHeartbeat) {
        const elapsed = Date.now() - new Date(stream.lastHeartbeat).getTime();
        if (elapsed > 30000) {
          console.log(`[RECONCILE] 🧹 Stream ${streamId} sem heartbeat há ${Math.round(elapsed / 1000)}s → limpando`);
          await endLive(streamKey, io, 'disconnect');
          cleaned++;
        }
      }
    }

    console.log(`[RECONCILE] Reconciliação concluída: ${cleaned}/${liveStreams.length} streams limpas`);
    return cleaned;
  } catch (err: any) {
    console.error('[RECONCILE] Erro na reconciliação:', err.message);
    return 0;
  }
}
