import mongoose, { Schema, Document } from 'mongoose';

export interface IEstornoRequest extends Document {
  id: string;
  requestedById: string;
  requestedByName?: string;
  targetType: 'order' | 'gift';
  targetId: string;
  targetDescription?: string;
  reasonCode: string;
  reasonDetail?: string;
  amountCoins: number;
  amountBRL: number;
  status: 'requested' | 'pending_review' | 'refunded' | 'rejected';
  underReviewUntil: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNote?: string;
  fraudConfirmed?: boolean;
  refundedAt?: Date;
  recovered?: number;
  userBanned?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EstornoRequestSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  requestedById: { type: String, required: true },
  requestedByName: { type: String },
  targetType: { type: String, enum: ['order', 'gift'], required: true },
  targetId: { type: String, required: true },
  targetDescription: { type: String },
  reasonCode: { type: String, required: true },
  reasonDetail: { type: String },
  amountCoins: { type: Number, required: true, default: 0 },
  amountBRL: { type: Number, required: true, default: 0 },
  status: {
    type: String,
    enum: ['requested', 'pending_review', 'refunded', 'rejected'],
    default: 'requested',
  },
  underReviewUntil: { type: Date },
  reviewedAt: { type: Date },
  reviewedBy: { type: String },
  reviewNote: { type: String },
  fraudConfirmed: { type: Boolean, default: false },
  refundedAt: { type: Date },
  recovered: { type: Number, default: 0 },
  userBanned: { type: Boolean, default: false },
}, { timestamps: true, id: false });

export const EstornoRequest = mongoose.model<IEstornoRequest>('EstornoRequest', EstornoRequestSchema);
