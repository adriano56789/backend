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

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const relation = await Followers.findOne({ followerId, followingId, isActive: true }).lean();
    return !!relation;
}

export async function createFollow(followerId: string, followingId: string) {
    return Followers.findOneAndUpdate(
        { followerId, followingId },
        { $set: { isActive: true, followedAt: new Date(), unfollowedAt: null } },
        { upsert: true, new: true }
    );
}
