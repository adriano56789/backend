import mongoose, { Schema, Document } from 'mongoose';

export interface IFollowers extends Document {
    followerId: string;
    followingId: string;
    followedAt: Date;
    isActive: boolean;
    unfollowedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const FollowersSchema: Schema = new Schema({
    followerId: { type: String, required: true, index: true },
    followingId: { type: String, required: true, index: true },
    followedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    unfollowedAt: { type: Date }
}, { timestamps: true });

// Create composite index
FollowersSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

export const Followers = mongoose.model<IFollowers>('Followers', FollowersSchema);
