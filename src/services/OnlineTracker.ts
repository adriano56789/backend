import { StreamParticipant } from '../models/StreamParticipant';
import { Followers } from '../models';
import { Streamer } from '../models/Streamer';

class OnlineTracker {
    async userJoin(streamId: string, userId: string, hostId: string, userName: string, userAvatar: string): Promise<{ role: 'fan' | 'visitor' | 'host'; fans: number; visitors: number }> {
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

        const [fans, visitors] = await Promise.all([
            StreamParticipant.countDocuments({ streamId, role: 'fan' }),
            StreamParticipant.countDocuments({ streamId, role: 'visitor' })
        ]);

        // Persistir no documento da stream
        await Streamer.findOneAndUpdate(
            { id: streamId },
            { $set: { onlineFans: fans, onlineVisitors: visitors } }
        ).catch(() => {});

        return { role, fans, visitors };
    }

    async userLeave(streamId: string, userId: string): Promise<{ fans: number; visitors: number } | null> {
        await StreamParticipant.findOneAndDelete({ streamId, userId });

        const [fans, visitors] = await Promise.all([
            StreamParticipant.countDocuments({ streamId, role: 'fan' }),
            StreamParticipant.countDocuments({ streamId, role: 'visitor' })
        ]);

        await Streamer.findOneAndUpdate(
            { id: streamId },
            { $set: { onlineFans: fans, onlineVisitors: visitors } }
        ).catch(() => {});

        return { fans, visitors };
    }

    async getCounts(streamId: string): Promise<{ fans: number; visitors: number; total: number }> {
        const [fans, visitors] = await Promise.all([
            StreamParticipant.countDocuments({ streamId, role: 'fan' }),
            StreamParticipant.countDocuments({ streamId, role: 'visitor' })
        ]);
        return { fans, visitors, total: fans + visitors };
    }

    async getAllCounts(): Promise<{ fans: number; visitors: number; total: number }> {
        const [fans, visitors] = await Promise.all([
            StreamParticipant.countDocuments({ role: 'fan' }),
            StreamParticipant.countDocuments({ role: 'visitor' })
        ]);
        return { fans, visitors, total: fans + visitors };
    }

    async getStreams(): Promise<string[]> {
        const result = await StreamParticipant.distinct('streamId');
        return result;
    }
}

export const onlineTracker = new OnlineTracker();
