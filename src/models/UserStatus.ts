import mongoose, { Schema, Document } from 'mongoose';

export interface IUserStatus extends Document {
    userId: string;
    isOnline: boolean;
    lastSeen: Date;
    createdAt: Date;
    updatedAt: Date;
}

const UserStatusSchema: Schema = new Schema({
    userId: { type: String, required: true, unique: true, index: true },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now }
}, { timestamps: true });

export const UserStatus = mongoose.model<IUserStatus>('UserStatus', UserStatusSchema);
