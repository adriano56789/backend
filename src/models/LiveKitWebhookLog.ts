import mongoose, { Schema, Document } from 'mongoose';

export interface ILiveKitWebhookLog extends Document {
  event: string;
  roomName?: string;
  roomSid?: string;
  participantIdentity?: string;
  participantName?: string;
  success: boolean;
  error?: string;
  rawEvent: any;
  processedAt: Date;
  createdAt: Date;
}

const LiveKitWebhookLogSchema = new Schema<ILiveKitWebhookLog>({
  event: { type: String, required: true, index: true },
  roomName: { type: String, index: true },
  roomSid: { type: String },
  participantIdentity: { type: String },
  participantName: { type: String },
  success: { type: Boolean, required: true },
  error: { type: String },
  rawEvent: { type: Schema.Types.Mixed },
  processedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

LiveKitWebhookLogSchema.index({ createdAt: -1 });
LiveKitWebhookLogSchema.index({ event: 1, createdAt: -1 });
LiveKitWebhookLogSchema.index({ roomName: 1, createdAt: -1 });

export const LiveKitWebhookLog = mongoose.model<ILiveKitWebhookLog>('LiveKitWebhookLog', LiveKitWebhookLogSchema);
