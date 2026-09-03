"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoHostSession = void 0;
const mongodb_1 = require("mongodb");
const db_1 = require("../config/db");
const COLLECTION = 'cohostsessions';
class CoHostSession {
    static async create(hostId, streamId) {
        const db = (0, db_1.getDb)();
        const session = {
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
    static async request(sessionId, coHostId) {
        const db = (0, db_1.getDb)();
        return db.collection(COLLECTION).findOneAndUpdate({ _id: new mongodb_1.ObjectId(sessionId) }, { $set: { coHostId, status: 'pending', updatedAt: new Date() } }, { returnDocument: 'after' });
    }
    static async accept(sessionId) {
        const db = (0, db_1.getDb)();
        return db.collection(COLLECTION).findOneAndUpdate({ _id: new mongodb_1.ObjectId(sessionId) }, { $set: { status: 'connected', updatedAt: new Date() } }, { returnDocument: 'after' });
    }
    static async reject(sessionId) {
        const db = (0, db_1.getDb)();
        return db.collection(COLLECTION).findOneAndUpdate({ _id: new mongodb_1.ObjectId(sessionId) }, { $set: { status: 'rejected', coHostId: null, updatedAt: new Date() } }, { returnDocument: 'after' });
    }
    static async exit(sessionId) {
        const db = (0, db_1.getDb)();
        return db.collection(COLLECTION).findOneAndUpdate({ _id: new mongodb_1.ObjectId(sessionId) }, { $set: { status: 'disconnected', updatedAt: new Date() } }, { returnDocument: 'after' });
    }
    static async mute(sessionId, muted) {
        const db = (0, db_1.getDb)();
        return db.collection(COLLECTION).findOneAndUpdate({ _id: new mongodb_1.ObjectId(sessionId) }, { $set: { isMuted: muted, updatedAt: new Date() } }, { returnDocument: 'after' });
    }
    static async getSessions(hostId) {
        const db = (0, db_1.getDb)();
        return db.collection(COLLECTION)
            .find({ hostId, status: { $in: ['waiting', 'pending', 'connected'] } })
            .sort({ createdAt: -1 })
            .toArray();
    }
    static async delete(sessionId) {
        const db = (0, db_1.getDb)();
        return db.collection(COLLECTION).deleteOne({ _id: new mongodb_1.ObjectId(sessionId) });
    }
}
exports.CoHostSession = CoHostSession;
