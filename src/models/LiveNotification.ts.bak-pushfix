import mongoose, { Schema, Document } from 'mongoose';

export interface ILiveNotification extends Document {
  userId: string;
  streamerId: string;
  streamId: string;
  read: boolean;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LiveNotificationSchema: Schema = new Schema({
  userId: { type: String, required: true, index: true },
  streamerId: { type: String, required: true, index: true },
  streamId: { type: String, required: true },
  read: { type: Boolean, default: false },
  message: { type: String }
}, { timestamps: true });

export const LiveNotification = mongoose.model<ILiveNotification>('LiveNotification', LiveNotificationSchema);
