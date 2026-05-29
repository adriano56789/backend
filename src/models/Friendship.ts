import mongoose, { Schema, Document } from 'mongoose';

export interface IFriendship extends Document {
    userId1: string;
    userId2: string;
    initiatedBy: string;
    friendshipStartedAt: Date;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const FriendshipSchema: Schema = new Schema({
    userId1: { type: String, required: true, index: true },
    userId2: { type: String, required: true, index: true },
    initiatedBy: { type: String, required: true },
    friendshipStartedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Create composite index (sorted IDs to avoid duplicates in either order)
FriendshipSchema.index({ userId1: 1, userId2: 1 }, { unique: true });

export const Friendship = mongoose.model<IFriendship>('Friendship', FriendshipSchema);
