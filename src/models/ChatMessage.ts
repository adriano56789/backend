import mongoose, { Schema, Document } from 'mongoose';

export interface IChatMessage extends Document {
    id: string;
    conversationId: string;
    senderId: string;
    receiverId: string;
    content: string;
    messageType: 'text' | 'image' | 'gift' | 'system';
    isRead: boolean;
    readAt?: Date;
    sentAt: Date;
    metadata?: {
        imageUrl?: string;
        giftId?: string;
        giftValue?: number;
        systemType?: string;
    };
    createdAt: Date;
    updatedAt: Date;
}

const ChatMessageSchema: Schema = new Schema({
    id: { type: String, required: true, unique: true },
    conversationId: { type: String, required: true, index: true },
    senderId: { type: String, required: true, index: true },
    receiverId: { type: String, required: true, index: true },
    content: { type: String, required: true },
    messageType: { type: String, enum: ['text', 'image', 'gift', 'system'], default: 'text' },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    sentAt: { type: Date, default: Date.now },
    metadata: {
        imageUrl: String,
        giftId: String,
        giftValue: Number,
        systemType: String
    }
}, { timestamps: true });

export const ChatMessage = mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);
