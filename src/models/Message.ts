import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
    chatId: string;
    fromUserId: string;
    toUserId: string;
    text: string;
    imageUrl?: string;
    status: 'sent' | 'delivered' | 'read' | 'sending' | 'failed';
    type: 'text' | 'image' | 'gift' | 'system' | 'friend-notification' | 'stream-notification';
    messageId?: string;
    createdAt: Date;
    updatedAt: Date;
}

const MessageSchema: Schema = new Schema({
    chatId: { type: String, required: true, index: true },
    fromUserId: { type: String, required: true, index: true },
    toUserId: { type: String, required: true, index: true },
    text: { type: String, required: true },
    imageUrl: { type: String },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read', 'sending', 'failed'],
        default: 'sent'
    },
    type: {
        type: String,
        enum: ['text', 'image', 'gift', 'system', 'friend-notification', 'stream-notification'],
        default: 'text'
    },
    messageId: { type: String, unique: true, sparse: true }
}, { timestamps: true });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
