import mongoose, { Schema, Document } from 'mongoose';

export interface IProfilePhoto extends Document {
    userId: string;
    obraId: string;
    photoUrl: string;
    photoType: 'avatar' | 'cover' | 'gallery' | 'video';
    isActive: boolean;
    isMain: boolean;
    order: number;
    metadata?: {
        originalName?: string;
        filename?: string;
        size?: number;
        mimeType?: string;
        width?: number;
        height?: number;
        uploadedAt: Date;
        source?: string;
        isAvatar?: boolean;
    };
    createdAt: Date;
    updatedAt: Date;
}

const ProfilePhotoSchema: Schema = new Schema({
    userId: { type: String, required: true, index: true },
    obraId: { type: String, required: true, unique: true },
    photoUrl: { type: String, required: true },
    photoType: { type: String, enum: ['avatar', 'cover', 'gallery', 'video'], default: 'gallery' },
    isActive: { type: Boolean, default: true },
    isMain: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    metadata: {
        originalName: String,
        filename: String,
        size: Number,
        mimeType: String,
        width: Number,
        height: Number,
        uploadedAt: { type: Date, default: Date.now },
        source: String,
        isAvatar: Boolean
    }
}, { timestamps: true });

// Create indexes (obraId unique index é criado via unique:true no schema)
ProfilePhotoSchema.index({ userId: 1, photoType: 1, isActive: 1 });

export const ProfilePhoto = mongoose.model<IProfilePhoto>('ProfilePhoto', ProfilePhotoSchema);
