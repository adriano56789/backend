import mongoose, { Schema, Document } from 'mongoose';

export interface IUserPhoto extends Document {
    id: string;
    userId: string;
    photoUrl: string;
    caption?: string;
    tags: string[];
    likes: number;
    comments: number;
    isPublic: boolean;
    postedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const UserPhotoSchema: Schema = new Schema({
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    photoUrl: { type: String, required: true },
    caption: { type: String },
    tags: [{ type: String }],
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    isPublic: { type: Boolean, default: true },
    postedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export const UserPhoto = mongoose.model<IUserPhoto>('UserPhoto', UserPhotoSchema);
