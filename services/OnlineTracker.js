"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onlineTracker = void 0;
const StreamParticipant_1 = require("../models/StreamParticipant");
const models_1 = require("../models");
const Streamer_1 = require("../models/Streamer");
class OnlineTracker {
    async userJoin(streamId, userId, hostId, userName, userAvatar) {
        let role = 'visitor';
        if (userId === hostId) {
            role = 'host';
        }
        else {
            const isFan = !!(await models_1.Followers.exists({
                followerId: userId,
                followingId: hostId,
                isActive: true
            }));
            role = isFan ? 'fan' : 'visitor';
        }
        await StreamParticipant_1.StreamParticipant.findOneAndUpdate({ streamId, userId }, {
            $set: { streamId, userId, role, userName, userAvatar, joinedAt: new Date() }
        }, { upsert: true, returnDocument: 'after' });
        const [fans, visitors, viewers, liveViewers] = await Promise.all([
            StreamParticipant_1.StreamParticipant.countDocuments({ streamId, role: 'fan' }),
            StreamParticipant_1.StreamParticipant.countDocuments({ streamId, role: 'visitor' }),
            StreamParticipant_1.StreamParticipant.countDocuments({ streamId, role: 'viewer' }),
            StreamParticipant_1.StreamParticipant.countDocuments({ streamId, role: 'live_viewer' })
        ]);
        const total = fans + visitors + viewers + liveViewers;
        // Persistir no documento da stream
        await Streamer_1.Streamer.findOneAndUpdate({ id: streamId }, { $set: { onlineFans: fans, onlineVisitors: visitors, onlineViewers: viewers, onlineLiveKitViewers: liveViewers, onlineTotal: total } }).catch(() => { });
        return { role, fans, visitors, viewers, liveViewers, total };
    }
    async userLeave(streamId, userId) {
        await StreamParticipant_1.StreamParticipant.findOneAndDelete({ streamId, userId });
        const [fans, visitors, viewers, liveViewers] = await Promise.all([
            StreamParticipant_1.StreamParticipant.countDocuments({ streamId, role: 'fan' }),
            StreamParticipant_1.StreamParticipant.countDocuments({ streamId, role: 'visitor' }),
            StreamParticipant_1.StreamParticipant.countDocuments({ streamId, role: 'viewer' }),
            StreamParticipant_1.StreamParticipant.countDocuments({ streamId, role: 'live_viewer' })
        ]);
        const total = fans + visitors + viewers + liveViewers;
        await Streamer_1.Streamer.findOneAndUpdate({ id: streamId }, { $set: { onlineFans: fans, onlineVisitors: visitors, onlineViewers: viewers, onlineLiveKitViewers: liveViewers, onlineTotal: total } }).catch(() => { });
        return { fans, visitors, viewers, liveViewers, total };
    }
    async getCounts(streamId) {
        const [fans, visitors, viewers, liveViewers] = await Promise.all([
            StreamParticipant_1.StreamParticipant.countDocuments({ streamId, role: 'fan' }),
            StreamParticipant_1.StreamParticipant.countDocuments({ streamId, role: 'visitor' }),
            StreamParticipant_1.StreamParticipant.countDocuments({ streamId, role: 'viewer' }),
            StreamParticipant_1.StreamParticipant.countDocuments({ streamId, role: 'live_viewer' })
        ]);
        return { fans, visitors, viewers, liveViewers, total: fans + visitors + viewers + liveViewers };
    }
    async getAllCounts() {
        const [fans, visitors, viewers, liveViewers] = await Promise.all([
            StreamParticipant_1.StreamParticipant.countDocuments({ role: 'fan' }),
            StreamParticipant_1.StreamParticipant.countDocuments({ role: 'visitor' }),
            StreamParticipant_1.StreamParticipant.countDocuments({ role: 'viewer' }),
            StreamParticipant_1.StreamParticipant.countDocuments({ role: 'live_viewer' })
        ]);
        return { fans, visitors, viewers, liveViewers, total: fans + visitors + viewers + liveViewers };
    }
    async getStreams() {
        const result = await StreamParticipant_1.StreamParticipant.distinct('streamId');
        return result;
    }
}
exports.onlineTracker = new OnlineTracker();
