import mongoose, { Schema, Document } from 'mongoose';

export interface IReport extends Document {
  id: string;
  reporterId: string;
  reportedUserId: string;
  reason: string;
  description?: string;
  status: 'pending' | 'reviewed' | 'dismissed' | 'action_taken';
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  reporterId: { type: String, required: true, index: true },
  reportedUserId: { type: String, required: true, index: true },
  reason: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['pending', 'reviewed', 'dismissed', 'action_taken'], default: 'pending', index: true },
  reviewedBy: { type: String },
  reviewedAt: { type: Date }
}, { timestamps: true });

export const Report = mongoose.model<IReport>('Report', ReportSchema);
