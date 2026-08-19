import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

export interface ILiveCard extends Document {
    hostId: string;
    name: string;
    avatar: string;
    title: string;
    streamKey: string;
    playbackUrl: string | null;
    hlsUrl: string | null;
    webrtcUrl?: string | null;
    flvUrl?: string | null;
    whipUrl?: string | null;
    whepUrl?: string | null;
    country: string;
    isLive: boolean;
    streamStatus: 'active' | 'live' | 'ended';
    viewers: number;
    category: string;
    categoryList: string[];
    notice: string;
    metaData: Map<string, string>;
    isPrivate: boolean;
    invitedUsers: string[];
    startTime: Date | null;
    endTime?: Date | null;
}

const LiveCardSchema = new Schema<ILiveCard>({
    hostId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    avatar: { type: String, default: '' },
    title: { type: String, default: '' },
    streamKey: { type: String, required: true },
    playbackUrl: { type: String, default: null },
    hlsUrl: { type: String, default: null },
    webrtcUrl: { type: String, default: null },
    flvUrl: { type: String, default: null },
    whipUrl: { type: String, default: null },
    whepUrl: { type: String, default: null },
    country: { type: String, default: 'br', index: true },
    isLive: { type: Boolean, default: false },
    streamStatus: {
        type: String,
        enum: ['active', 'live', 'ended'],
        default: 'ended'
    },
    viewers: { type: Number, default: 0 },
    category: { type: String, default: 'popular' },
    categoryList: { type: [String], default: [] },
    notice: { type: String, default: '' },
    metaData: { type: Map, of: String, default: {} },
    isPrivate: { type: Boolean, default: false },
    invitedUsers: { type: [String], default: [] },
    startTime: { type: Date, default: null },
    endTime: { type: Date, default: null }
}, { timestamps: true });

LiveCardSchema.index({ isLive: 1, country: 1 });
LiveCardSchema.index({ streamStatus: 1 });

LiveCardSchema.pre('save', function (this: any, next: any) {
    if (!this.streamKey) {
        this.streamKey = crypto.randomBytes(16).toString('hex');
    }
    next();
});

export const LiveCard = mongoose.model<ILiveCard>('LiveCard', LiveCardSchema);
