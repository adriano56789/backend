import mongoose, { Schema, Document } from 'mongoose';

export interface IChat extends Document {
    id: string;
    participants: string[];
    type: 'private' | 'group' | 'stream';
    title?: string;
    lastMessage?: {
        content: string;
        senderId: string;
        timestamp: Date;
        messageType: 'text' | 'image' | 'gift' | 'system';
    };
    isActive: boolean;
    metadata?: {
        streamId?: string;
        groupId?: string;
        isPinned?: boolean;
        isMuted?: boolean;
    };
    createdAt: Date;
    updatedAt: Date;
}

const ChatSchema: Schema = new Schema({
    id: { type: String, required: true, unique: true },
    participants: [{ type: String, required: true, index: true }],
    type: { type: String, enum: ['private', 'group', 'stream'], default: 'private' },
    title: { type: String },
    lastMessage: {
        content: String,
        senderId: String,
        timestamp: Date,
        messageType: { type: String, enum: ['text', 'image', 'gift', 'system'], default: 'text' }
    },
    isActive: { type: Boolean, default: true },
    metadata: {
        streamId: String,
        groupId: String,
        isPinned: Boolean,
        isMuted: Boolean
    }
}, { timestamps: true });

export const Chat = mongoose.model<IChat>('Chat', ChatSchema);
