import mongoose, { Schema, Document } from 'mongoose';

export interface IGiftTransaction extends Document {
    id: string;
    fromUserId: string;
    fromUserName?: string;
    fromUserAvatar?: string;
    toUserId: string;
    toUserName?: string;
    streamId: string;
    giftId: mongoose.Types.ObjectId;
    giftName: string;
    giftIcon: string;
    giftPrice: number;
    quantity: number;
    totalValue: number;
    transactionHash?: string;
    createdAt: Date;
    updatedAt: Date;
}

const GiftTransactionSchema: Schema = new Schema({
    id: { type: String, required: true, unique: true },
    fromUserId: { type: String, required: true, index: true },
    fromUserName: { type: String },
    fromUserAvatar: { type: String },
    toUserId: { type: String, required: true, index: true },
    toUserName: { type: String },
    streamId: { type: String, required: true, index: true },
    giftId: { type: Schema.Types.ObjectId, ref: 'Gift', required: true },
    giftName: { type: String, required: true },
    giftIcon: { type: String, required: true },
    giftPrice: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    totalValue: { type: Number, required: true },
    transactionHash: { type: String, index: true }
}, { timestamps: true, id: false });

export const GiftTransaction = mongoose.model<IGiftTransaction>('GiftTransaction', GiftTransactionSchema);
