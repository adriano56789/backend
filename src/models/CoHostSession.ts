import { ObjectId } from 'mongodb';
import { getDb } from '../config/db';

export interface ICoHostSession {
  _id?: ObjectId;
  hostId: string;
  streamId: string;
  status: 'waiting' | 'pending' | 'connected' | 'rejected' | 'disconnected';
  coHostId: string | null;
  isMuted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION = 'cohostsessions';

export class CoHostSession {
  static async create(hostId: string, streamId: string) {
    const db = getDb();
    const session: Omit<ICoHostSession, '_id'> = {
      hostId,
      streamId,
      status: 'waiting',
      coHostId: null,
      isMuted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await db.collection(COLLECTION).insertOne(session);
    return { sessionId: result.insertedId, ...session };
  }

  static async request(sessionId: string, coHostId: string) {
    const db = getDb();
    return db.collection(COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(sessionId) },
      { $set: { coHostId, status: 'pending', updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
  }

  static async accept(sessionId: string) {
    const db = getDb();
    return db.collection(COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(sessionId) },
      { $set: { status: 'connected', updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
  }

  static async reject(sessionId: string) {
    const db = getDb();
    return db.collection(COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(sessionId) },
      { $set: { status: 'rejected', coHostId: null, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
  }

  static async exit(sessionId: string) {
    const db = getDb();
    return db.collection(COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(sessionId) },
      { $set: { status: 'disconnected', updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
  }

  static async mute(sessionId: string, muted: boolean) {
    const db = getDb();
    return db.collection(COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(sessionId) },
      { $set: { isMuted: muted, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
  }

  static async getSessions(hostId: string) {
    const db = getDb();
    return db.collection(COLLECTION)
      .find({ hostId, status: { $in: ['waiting', 'pending', 'connected'] } })
      .sort({ createdAt: -1 })
      .toArray();
  }

  static async delete(sessionId: string) {
    const db = getDb();
    return db.collection(COLLECTION).deleteOne({ _id: new ObjectId(sessionId) });
  }
}
