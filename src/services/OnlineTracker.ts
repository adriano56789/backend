import { Followers } from '../models';

interface StreamCounts {
    fans: Set<string>;
    visitors: Set<string>;
}

class OnlineTracker {
    private streams = new Map<string, StreamCounts>();

    async userJoin(streamId: string, userId: string, hostId: string): Promise<{ role: 'fan' | 'visitor'; fans: number; visitors: number }> {
        if (!this.streams.has(streamId)) {
            this.streams.set(streamId, { fans: new Set(), visitors: new Set() });
        }

        const stream = this.streams.get(streamId)!;

        let isFan = false;
        if (hostId && userId !== hostId) {
            isFan = !!(await Followers.exists({
                followerId: userId,
                followingId: hostId,
                isActive: true
            }));
        }

        stream.fans.delete(userId);
        stream.visitors.delete(userId);

        if (isFan) {
            stream.fans.add(userId);
        } else {
            stream.visitors.add(userId);
        }

        return {
            role: isFan ? 'fan' : 'visitor',
            fans: stream.fans.size,
            visitors: stream.visitors.size
        };
    }

    userLeave(streamId: string, userId: string): { fans: number; visitors: number } | null {
        const stream = this.streams.get(streamId);
        if (!stream) return null;

        stream.fans.delete(userId);
        stream.visitors.delete(userId);

        if (stream.fans.size === 0 && stream.visitors.size === 0) {
            this.streams.delete(streamId);
        }

        return {
            fans: stream.fans.size,
            visitors: stream.visitors.size
        };
    }

    getCounts(streamId: string): { fans: number; visitors: number; total: number } {
        const stream = this.streams.get(streamId);
        if (!stream) return { fans: 0, visitors: 0, total: 0 };
        return {
            fans: stream.fans.size,
            visitors: stream.visitors.size,
            total: stream.fans.size + stream.visitors.size
        };
    }

    getAllCounts(): { fans: number; visitors: number; total: number } {
        let fans = 0;
        let visitors = 0;
        for (const stream of this.streams.values()) {
            fans += stream.fans.size;
            visitors += stream.visitors.size;
        }
        return { fans, visitors, total: fans + visitors };
    }

    getStreams(): string[] {
        return Array.from(this.streams.keys());
    }
}

export const onlineTracker = new OnlineTracker();
