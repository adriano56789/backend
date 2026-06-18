import mongoose, { Schema, Document } from 'mongoose';

export interface ILiveCard extends Document {
    hostId: string;
    name: string;
    avatar: string;
    title: string;
    streamKey: string;
    playbackUrl: string;
    hlsUrl: string;
    country: string;
    isLive: boolean;
    streamStatus: 'active' | 'live' | 'ended';
    viewers: number;
    category: string;
    isPrivate: boolean;
    startTime: Date;
    endTime?: Date;
    updatedAt: Date;
}

const LiveCardSchema = new Schema<ILiveCard>({
    hostId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    avatar: { type: String, default: '' },
    title: { type: String, default: '' },
    streamKey: { type: String, default: '' },
    playbackUrl: { type: String, default: '' },
    hlsUrl: { type: String, default: '' },
    country: { type: String, default: 'br', index: true },
    isLive: { type: Boolean, default: false },
    streamStatus: { type: String, enum: ['active', 'live', 'ended'], default: 'ended' },
    viewers: { type: Number, default: 0 },
    category: { type: String, default: 'popular' },
    isPrivate: { type: Boolean, default: false },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

LiveCardSchema.index({ isLive: 1, country: 1 });
LiveCardSchema.index({ streamStatus: 1 });

export const LiveCard = mongoose.model<ILiveCard>('LiveCard', LiveCardSchema);
