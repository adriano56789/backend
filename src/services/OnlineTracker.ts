import { StreamParticipant } from '../models/StreamParticipant';
import { Followers } from '../models';
import { Streamer } from '../models/Streamer';

class OnlineTracker {
    async userJoin(streamId: string, userId: string, hostId: string, userName: string, userAvatar: string): Promise<{ role: 'fan' | 'visitor' | 'host'; fans: number; visitors: number; viewers: number; liveViewers: number; total: number }> {
        let role: 'fan' | 'visitor' | 'host' = 'visitor';

        if (userId === hostId) {
            role = 'host';
        } else {
            const isFan = !!(await Followers.exists({
                followerId: userId,
                followingId: hostId,
                isActive: true
            }));
            role = isFan ? 'fan' : 'visitor';
        }

        await StreamParticipant.findOneAndUpdate(
            { streamId, userId },
            {
                $set: { streamId, userId, role, userName, userAvatar, joinedAt: new Date() }
            },
            { upsert: true, returnDocument: 'after' }
        );

        const [fans, visitors, viewers, liveViewers] = await Promise.all([
            StreamParticipant.countDocuments({ streamId, role: 'fan' }),
            StreamParticipant.countDocuments({ streamId, role: 'visitor' }),
            StreamParticipant.countDocuments({ streamId, role: 'viewer' }),
            StreamParticipant.countDocuments({ streamId, role: 'live_viewer' })
        ]);
        const total = fans + visitors + viewers + liveViewers;

        // Persistir no documento da stream
        await Streamer.findOneAndUpdate(
            { id: streamId },
            { $set: { onlineFans: fans, onlineVisitors: visitors, onlineViewers: viewers, onlineLiveKitViewers: liveViewers, onlineTotal: total } }
        ).catch(() => {});

        return { role, fans, visitors, viewers, liveViewers, total };
    }

    async userLeave(streamId: string, userId: string): Promise<{ fans: number; visitors: number; viewers: number; liveViewers: number; total: number } | null> {
        await StreamParticipant.findOneAndDelete({ streamId, userId });

        const [fans, visitors, viewers, liveViewers] = await Promise.all([
            StreamParticipant.countDocuments({ streamId, role: 'fan' }),
            StreamParticipant.countDocuments({ streamId, role: 'visitor' }),
            StreamParticipant.countDocuments({ streamId, role: 'viewer' }),
            StreamParticipant.countDocuments({ streamId, role: 'live_viewer' })
        ]);
        const total = fans + visitors + viewers + liveViewers;

        await Streamer.findOneAndUpdate(
            { id: streamId },
            { $set: { onlineFans: fans, onlineVisitors: visitors, onlineViewers: viewers, onlineLiveKitViewers: liveViewers, onlineTotal: total } }
        ).catch(() => {});

        return { fans, visitors, viewers, liveViewers, total };
    }

    async getCounts(streamId: string): Promise<{ fans: number; visitors: number; viewers: number; liveViewers: number; total: number }> {
        const [fans, visitors, viewers, liveViewers] = await Promise.all([
            StreamParticipant.countDocuments({ streamId, role: 'fan' }),
            StreamParticipant.countDocuments({ streamId, role: 'visitor' }),
            StreamParticipant.countDocuments({ streamId, role: 'viewer' }),
            StreamParticipant.countDocuments({ streamId, role: 'live_viewer' })
        ]);
        return { fans, visitors, viewers, liveViewers, total: fans + visitors + viewers + liveViewers };
    }

    async getAllCounts(): Promise<{ fans: number; visitors: number; viewers: number; liveViewers: number; total: number }> {
        const [fans, visitors, viewers, liveViewers] = await Promise.all([
            StreamParticipant.countDocuments({ role: 'fan' }),
            StreamParticipant.countDocuments({ role: 'visitor' }),
            StreamParticipant.countDocuments({ role: 'viewer' }),
            StreamParticipant.countDocuments({ role: 'live_viewer' })
        ]);
        return { fans, visitors, viewers, liveViewers, total: fans + visitors + viewers + liveViewers };
    }

    async getStreams(): Promise<string[]> {
        const result = await StreamParticipant.distinct('streamId');
        return result;
    }
}

export const onlineTracker = new OnlineTracker();
