import { getDb } from '../config/db';

const COLLECTION = 'gifterankings';

interface TopViewerUser {
  userId: string;
  uniqueId: string;
  nickname: string;
  profilePictureUrl: string;
}

interface TopViewerEntry {
  user: TopViewerUser;
  coinCount: number;
}

interface RankDoc {
  streamId: string;
  userId: string;
  userName: string;
  avatarUrl: string;
  totalValue: number;
  giftCount: number;
  lastGiftAt: Date;
}

export class GiftRankingService {
  private static cache = new Map<string, { top3: TopViewerEntry[]; pin: string }>();

  private static _pin(top3: TopViewerEntry[]): string {
    return top3.slice(0, 3).map(r => `${r.user.userId}:${r.coinCount}`).join('|');
  }

  static async record(
    streamId: string,
    userId: string,
    userName: string,
    avatarUrl: string,
    totalValue: number,
    io: any,
  ) {
    if (!streamId || streamId === 'unknown') return;

    const db = getDb();
    const coll = db.collection(COLLECTION);
    const now = new Date();

    await coll.findOneAndUpdate(
      { streamId, userId },
      {
        $inc: { totalValue, giftCount: 1 },
        $set: { userName, avatarUrl, lastGiftAt: now },
        $setOnInsert: { streamId, userId },
      },
      { upsert: true, returnDocument: 'after' },
    );

    const topDocs = await coll
      .find({ streamId })
      .project<RankDoc>({
        userId: 1, userName: 1, avatarUrl: 1, totalValue: 1, giftCount: 1, lastGiftAt: 1,
      })
      .sort({ totalValue: -1 })
      .limit(3)
      .toArray();

    const topViewers: TopViewerEntry[] = topDocs.map(d => ({
      user: {
        userId: d.userId,
        uniqueId: d.userName,
        nickname: d.userName,
        profilePictureUrl: d.avatarUrl,
      },
      coinCount: d.totalValue,
    }));

    const newPin = this._pin(topViewers);
    const cached = this.cache.get(streamId);

    if (!cached || cached.pin !== newPin) {
      this.cache.set(streamId, { top3: topViewers, pin: newPin });

      io.to(streamId).emit('ranking_update', {
        roomId: streamId,
        topViewers,
        timestamp: now.toISOString(),
      });
    }
  }

  static async getTop(streamId: string, limit = 10): Promise<TopViewerEntry[]> {
    const db = getDb();
    const coll = db.collection(COLLECTION);
    const docs = await coll
      .find({ streamId })
      .project<RankDoc>({
        userId: 1, userName: 1, avatarUrl: 1, totalValue: 1, giftCount: 1, lastGiftAt: 1,
      })
      .sort({ totalValue: -1 })
      .limit(limit)
      .toArray();

    return docs.map(d => ({
      user: {
        userId: d.userId,
        uniqueId: d.userName,
        nickname: d.userName,
        profilePictureUrl: d.avatarUrl,
      },
      coinCount: d.totalValue,
    }));
  }

  static async clearStream(streamId: string) {
    const db = getDb();
    const coll = db.collection(COLLECTION);
    await coll.deleteMany({ streamId });
    this.cache.delete(streamId);
  }
}
