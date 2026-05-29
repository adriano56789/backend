import mongoose, { Schema, Document } from 'mongoose';

export interface IUserLevel extends Document {
    userId: string;
    currentLevel: number;
    currentExp: number;
    expForNextLevel: number;
    totalExp: number;
    levelHistory: {
        level: number;
        reachedAt: Date;
        expRequired: number;
    }[];
    lastExpGain: {
        amount: number;
        reason: string;
        timestamp: Date;
    };
    createdAt: Date;
    updatedAt: Date;
}

const UserLevelSchema: Schema = new Schema({
    userId: { type: String, required: true, unique: true, index: true },
    currentLevel: { type: Number, default: 1 },
    currentExp: { type: Number, default: 0 },
    expForNextLevel: { type: Number, default: 100 },
    totalExp: { type: Number, default: 0 },
    levelHistory: [{
        level: Number,
        reachedAt: { type: Date, default: Date.now },
        expRequired: Number
    }],
    lastExpGain: {
        amount: { type: Number, default: 0 },
        reason: { type: String, default: 'Initialization' },
        timestamp: { type: Date, default: Date.now }
    }
}, { timestamps: true });

export const UserLevel = mongoose.model<IUserLevel>('UserLevel', UserLevelSchema);
