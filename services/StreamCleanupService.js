"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamCleanupService = exports.StreamCleanupService = void 0;
const axios_1 = __importDefault(require("axios"));
const index_1 = require("../models/index");
const FfmpegService_1 = require("./FfmpegService");
const SRS_API_URL = process.env.SRS_API_URL || 'http://127.0.0.1:1985';
const CLEANUP_INTERVAL_MS = parseInt(process.env.STREAM_CLEANUP_INTERVAL || '60000', 10);
const MAX_STALE_MINUTES = parseInt(process.env.STREAM_STALE_MINUTES || '2', 10);
class StreamCleanupService {
    constructor() {
        this.intervalId = null;
        this.isRunning = false;
        this.io = null;
    }
    start(io) {
        // 🛑 DESATIVADO (decisão do dono): nenhuma lógica pode encerrar uma
        // transmissão ao vivo automaticamente. A live SÓ é encerrada pelo host.
        if (io)
            this.io = io;
        console.warn('[STREAM-CLEANUP] 🛑 Serviço de limpeza DESATIVADO — lives só encerram pelo próprio host. Nada será fechado automaticamente.');
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    async cleanup() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        try {
            const activeStreams = await index_1.Streamer.find({
                isLive: true,
                streamStatus: { $in: ['active'] }
            }).lean();
            if (activeStreams.length === 0)
                return;
            const srsStreams = await this.fetchSrsStreams();
            const srsStreamKeys = new Set(srsStreams.map(s => s.name));
            for (const stream of activeStreams) {
                const streamKey = stream.streamKey;
                const isOnSrs = streamKey ? srsStreamKeys.has(streamKey) : false;
                if (!isOnSrs) {
                    const streamAge = Date.now() - new Date(stream.startTime || stream.createdAt || Date.now()).getTime();
                    const staleMs = MAX_STALE_MINUTES * 60 * 1000;
                    if (streamAge > staleMs) {
                        console.log(`[STREAM-CLEANUP] Stream órfã detectada: ${streamKey || stream.id} (host: ${stream.hostId}, idade: ${Math.round(streamAge / 1000)}s)`);
                        await this.forceEndStream(stream);
                    }
                }
            }
        }
        catch (err) {
            console.error('[STREAM-CLEANUP] Erro:', err.message);
        }
        finally {
            this.isRunning = false;
        }
    }
    async fetchSrsStreams() {
        try {
            const res = await axios_1.default.get(`${SRS_API_URL}/api/v1/streams`, { timeout: 5000 });
            if (res.data?.streams) {
                return res.data.streams;
            }
            return [];
        }
        catch {
            return [];
        }
    }
    async forceEndStream(stream) {
        const storedId = stream.id || stream.streamKey;
        const hostId = stream.hostId;
        try {
            await index_1.Streamer.findOneAndUpdate({ id: storedId }, { $set: { isLive: false, streamStatus: 'ended', endTime: new Date() } });
            if (hostId) {
                await index_1.User.findOneAndUpdate({ id: hostId }, { $set: { isLive: false, currentStreamId: null } });
            }
            try {
                await index_1.LiveCard.findOneAndUpdate({ hostId }, { $set: { isLive: false, streamStatus: 'ended', endTime: new Date() } });
            }
            catch { }
            if (stream.streamKey) {
                await (0, FfmpegService_1.stopStreamTranscode)(stream.streamKey).catch(() => { });
            }
            if (this.io) {
                this.io.emit('card_removed', { streamId: storedId, hostId, timestamp: new Date().toISOString() });
                this.io.emit('stream_ended', { streamId: storedId, hostId, timestamp: new Date().toISOString() });
                this.io.emit('stream_stopped', { streamId: storedId, hostId, timestamp: new Date().toISOString() });
            }
            console.log(`[STREAM-CLEANUP] Stream ${storedId} finalizada forçadamente`);
        }
        catch (err) {
            console.error(`[STREAM-CLEANUP] Erro ao finalizar stream ${storedId}:`, err.message);
        }
    }
}
exports.StreamCleanupService = StreamCleanupService;
exports.streamCleanupService = new StreamCleanupService();
