import mongoose, { Schema, Document } from 'mongoose';

export interface IPKInvite extends Document {
  inviterId: mongoose.Types.ObjectId;
  invitedId: mongoose.Types.ObjectId;
  battleId?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  respondedAt?: Date;
}

const PKInviteSchema = new Schema<IPKInvite>({
  inviterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  invitedId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  battleId: { type: String },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  respondedAt: { type: Date }
});

PKInviteSchema.index({ invitedId: 1, status: 1 });
PKInviteSchema.index({ inviterId: 1, createdAt: -1 });

export const PKInvite = mongoose.model<IPKInvite>('PKInvite', PKInviteSchema);
