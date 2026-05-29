import mongoose, { Schema, Document } from 'mongoose';

export interface IVisitor extends Document {
  id: string;
  visitorId: string;
  visitedId: string;
  visitedAt: Date;
  visitorName: string | null;
  visitorAvatar: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const VisitorSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  visitorId: { type: String, required: true, index: true },
  visitedId: { type: String, required: true, index: true },
  visitedAt: { type: Date, default: Date.now },
  visitorName: { type: String },
  visitorAvatar: { type: String }
}, { timestamps: true });

export const Visitor = mongoose.model<IVisitor>('Visitor', VisitorSchema);
