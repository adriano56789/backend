import mongoose, { Schema, Document } from 'mongoose';

export interface IStreamHistory extends Document {
  id: string;
  streamId: string;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  title: string;
  startTime: Date;
  endTime: Date;
  duration: string;
  peakViewers: number;
  totalCoins: number;
  totalFollowers: number;
  totalMembers: number;
  totalFans: number;
  category: string;
  tags: string[];
  country: string;
  createdAt: Date;
  updatedAt: Date;
}

const StreamHistorySchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  streamId: { type: String, required: true, index: true },
  hostId: { type: String, required: true, index: true },
  hostName: { type: String },
  hostAvatar: { type: String },
  title: { type: String },
  startTime: { type: Date },
  endTime: { type: Date },
  duration: { type: String },
  peakViewers: { type: Number, default: 0 },
  totalCoins: { type: Number, default: 0 },
  totalFollowers: { type: Number, default: 0 },
  totalMembers: { type: Number, default: 0 },
  totalFans: { type: Number, default: 0 },
  category: { type: String },
  tags: [{ type: String }],
  country: { type: String }
}, { timestamps: true, id: false });

export const StreamHistory = mongoose.model<IStreamHistory>('StreamHistory', StreamHistorySchema);
