import mongoose, { Schema, Document } from 'mongoose';

export interface IPhoto extends Document {
    id: string;
    userId: string;
    photoUrl: string;
    caption?: string;
    tags?: string[];
    isPublic: boolean;
    likes: number;
    comments: number;
    createdAt: Date;
    updatedAt: Date;
}

const PhotoSchema: Schema = new Schema({
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    photoUrl: { type: String, required: true },
    caption: { type: String },
    tags: [{ type: String }],
    isPublic: { type: Boolean, default: true },
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 }
}, { timestamps: true });

export const Photo = mongoose.model<IPhoto>('Photo', PhotoSchema);
