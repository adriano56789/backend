import mongoose, { Schema, Document } from 'mongoose';

export interface IStreamRoom extends Document {
    roomId: string;
    hostId: string;
    streamKey: string;
    app: string;
    createdAt: Date;
    updatedAt: Date;
}

const StreamRoomSchema = new Schema<IStreamRoom>({
    roomId: { type: String, required: true, unique: true, index: true },
    hostId: { type: String, required: true, index: true },
    streamKey: { type: String, required: true },
    app: { type: String, default: 'live' }
}, { timestamps: true });

export const StreamRoom = mongoose.model<IStreamRoom>('StreamRoom', StreamRoomSchema);
