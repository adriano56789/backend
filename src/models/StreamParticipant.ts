import mongoose, { Schema, Document } from 'mongoose';

export interface IStreamParticipant extends Document {
    streamId: string;
    userId: string;
    role: 'fan' | 'visitor' | 'host';
    userName: string;
    userAvatar: string;
    joinedAt: Date;
}

const StreamParticipantSchema: Schema = new Schema({
    streamId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    role: { type: String, enum: ['fan', 'visitor', 'host'], required: true },
    userName: { type: String, default: '' },
    userAvatar: { type: String, default: '' },
    joinedAt: { type: Date, default: Date.now }
});

StreamParticipantSchema.index({ streamId: 1, userId: 1 }, { unique: true });

export const StreamParticipant = mongoose.model<IStreamParticipant>('StreamParticipant', StreamParticipantSchema);
