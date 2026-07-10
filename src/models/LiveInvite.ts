import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILiveUser extends Document {
    userId: string;
    username: string;
    name: string;
    avatarUrl: string;
    status: 'idle' | 'broadcasting' | 'viewing' | 'co-host' | 'pk-battle';
    currentStreamId: string | null;
    socketId: string | null;
    isMuted: boolean;
    joinedAt: Date;
    lastActive: Date;
}

const LiveUserSchema = new Schema<ILiveUser>(
    {
        userId: { type: String, required: true, index: true },
        username: { type: String, required: true, unique: true, index: true },
        name: { type: String, required: true },
        avatarUrl: { type: String, default: '' },
        status: {
            type: String,
            enum: ['idle', 'broadcasting', 'viewing', 'co-host', 'pk-battle'],
            default: 'idle'
        },
        currentStreamId: { type: String, default: null, index: true },
        socketId: { type: String, default: null },
        isMuted: { type: Boolean, default: false },
        joinedAt: { type: Date, default: Date.now },
        lastActive: { type: Date, default: Date.now } // index TTL definido abaixo
    },
    { timestamps: true }
);

LiveUserSchema.index({ lastActive: 1 }, { expireAfterSeconds: 7200 });

export interface ISrsSfuConfig {
    whipUrl: string;
    whepUrl: string;
    streamKey: string;
    rtcRoomId: string;
}

export interface ILiveInvite extends Document {
    inviterUsername: string;
    inviterName: string;
    inviteeUsername: string;
    inviteeName: string;
    inviteType: 'co-host' | 'pk-battle';
    status: 'pending' | 'accepted' | 'declined' | 'expired';
    streamId: string;
    inviteLink: string;
    srsSfuConfig: ISrsSfuConfig;
    createdAt: Date;
    updatedAt: Date;
}

const SrsSfuConfigSchema = new Schema<ISrsSfuConfig>(
    {
        whipUrl: { type: String, required: true },
        whepUrl: { type: String, required: true },
        streamKey: { type: String, required: true },
        rtcRoomId: { type: String, required: true }
    },
    { _id: false }
);

const LiveInviteSchema = new Schema<ILiveInvite>(
    {
        inviterUsername: { type: String, required: true, index: true },
        inviterName: { type: String, required: true },
        inviteeUsername: { type: String, required: true, index: true },
        inviteeName: { type: String, required: true },
        inviteType: {
            type: String,
            enum: ['co-host', 'pk-battle'],
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'declined', 'expired'],
            default: 'pending',
            index: true
        },
        streamId: { type: String, required: true, index: true },
        inviteLink: { type: String, required: true },
        srsSfuConfig: { type: SrsSfuConfigSchema, required: true }
    },
    { timestamps: true }
);

LiveInviteSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 });

export const LiveUser: Model<ILiveUser> =
    mongoose.models.LiveUser || mongoose.model<ILiveUser>('LiveUser', LiveUserSchema);

export const LiveInvite: Model<ILiveInvite> =
    mongoose.models.LiveInvite || mongoose.model<ILiveInvite>('LiveInvite', LiveInviteSchema);
