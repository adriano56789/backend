"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoEndStreamOnDisconnect = autoEndStreamOnDisconnect;
const models_1 = require("../models");
const streamKeyUtils_1 = require("../utils/streamKeyUtils");
async function autoEndStreamOnDisconnect(streamKey, io) {
    try {
        const normalizedId = (0, streamKeyUtils_1.normalizeStreamId)(streamKey);
        const stream = await models_1.Streamer.findOne({
            $or: [
                { id: normalizedId },
                { streamKey }
            ]
        }).lean();
        if (!stream) {
            console.log(`[AUTO-END] Stream ${streamKey} não encontrada — nada a encerrar`);
            return;
        }
        if (!stream.isLive) {
            console.log(`[AUTO-END] Stream ${streamKey} já está encerrada — ignorando`);
            return;
        }
        const streamId = stream.id || normalizedId;
        const hostId = stream.hostId;
        await models_1.Streamer.updateOne({ id: streamId }, { $set: {
                isLive: false,
                streamStatus: 'ended',
                endTime: new Date(),
                endedBy: 'disconnect'
            } });
        if (hostId) {
            await models_1.LiveCard.updateOne({ hostId }, { $set: {
                    isLive: false,
                    streamStatus: 'ended',
                    endTime: new Date(),
                    updatedAt: new Date()
                } });
            await models_1.User.updateOne({ id: hostId }, { $set: { isLive: false, currentStreamId: null } });
        }
        if (io) {
            const payload = {
                streamId: streamId,
                hostId: hostId || '',
                timestamp: new Date().toISOString()
            };
            io.emit('card_removed', payload);
            io.emit('stream_ended', payload);
            io.emit('stream_stopped', payload);
        }
        console.log(`[AUTO-END] Live ${streamKey} encerrada automaticamente (host desconectou)`);
    }
    catch (err) {
        console.error('[AUTO-END] Erro ao encerrar stream automaticamente:', err.message);
    }
}
