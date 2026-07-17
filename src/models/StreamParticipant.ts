import mongoose, { Schema, Document } from 'mongoose';

export interface IStreamParticipant extends Document {
    streamId: string;
    cleanStreamId?: string;
    userId: string;
    role: 'fan' | 'visitor' | 'host' | 'viewer' | 'live_viewer' | 'pk_participant' | 'call_participant';
    userName: string;
    userAvatar: string;
    joinedAt: Date;
}

const StreamParticipantSchema: Schema = new Schema({
    streamId: { type: String, required: true, index: true },
    cleanStreamId: { type: String, index: true },
    userId: { type: String, required: true },
    role: { type: String, enum: ['fan', 'visitor', 'host', 'viewer', 'live_viewer', 'pk_participant', 'call_participant'], required: true },
    userName: { type: String, default: '' },
    userAvatar: { type: String, default: '' },
    joinedAt: { type: Date, default: Date.now }
});

StreamParticipantSchema.index({ streamId: 1, userId: 1 }, { unique: true });
StreamParticipantSchema.index({ cleanStreamId: 1, userId: 1 });

export const StreamParticipant = mongoose.model<IStreamParticipant>('StreamParticipant', StreamParticipantSchema);
