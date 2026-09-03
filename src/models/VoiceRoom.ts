import mongoose, { Schema, Document } from 'mongoose';

export interface IVoiceSlot {
    index: number;
    userId: string | null;
    userName: string;
    avatar: string;
    level: number;
    isSpeaking: boolean;
    isMuted: boolean;
    joinedAt: Date | null;
}

export interface IVoiceRoom extends Document {
    _id: mongoose.Types.ObjectId;
    roomId: string;
    hostId: string;
    hostName: string;
    hostAvatar: string;
    name: string;
    category: string;
    slots: IVoiceSlot[];
    maxSlots: number;
    minLevelToSpeak: number;
    isLive: boolean;
    viewers: number;
    viewerIds: string[];
    startTime: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const VoiceSlotSchema = new Schema<IVoiceSlot>({
    index: { type: Number, required: true },
    userId: { type: String, default: null },
    userName: { type: String, default: '' },
    avatar: { type: String, default: '' },
    level: { type: Number, default: 1 },
    isSpeaking: { type: Boolean, default: false },
    isMuted: { type: Boolean, default: false },
    joinedAt: { type: Date, default: null },
}, { _id: false });

const VoiceRoomSchema = new Schema<IVoiceRoom>({
    roomId: { type: String, required: true, unique: true, index: true },
    hostId: { type: String, required: true, index: true },
    hostName: { type: String, default: '' },
    hostAvatar: { type: String, default: '' },
    name: { type: String, default: '' },
    category: { type: String, default: 'voice_chat' },
    slots: { type: [VoiceSlotSchema], default: [] },
    maxSlots: { type: Number, default: 6 },
    minLevelToSpeak: { type: Number, default: 1 },
    isLive: { type: Boolean, default: false },
    viewers: { type: Number, default: 0 },
    viewerIds: { type: [String], default: [] },
    startTime: { type: Date, default: null },
}, { timestamps: true });

VoiceRoomSchema.index({ isLive: 1, category: 1 });
VoiceRoomSchema.index({ isLive: 1, viewers: -1 });

export const VoiceRoom = mongoose.model<IVoiceRoom>('VoiceRoom', VoiceRoomSchema);
