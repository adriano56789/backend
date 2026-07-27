import mongoose, { Schema, Document } from 'mongoose';

export interface ILiveKitWebhookLog extends Document {
  eventId: string;          // WebhookEvent.id (UUID) — used for deduplication
  event: string;
  roomName?: string;
  roomSid?: string;
  participantIdentity?: string;
  participantName?: string;
  success: boolean;
  duplicate: boolean;       // true if this event was already processed
  error?: string;
  rawEvent: any;
  processedAt: Date;
  createdAt: Date;
}

const LiveKitWebhookLogSchema = new Schema<ILiveKitWebhookLog>({
  eventId: { type: String, required: true, index: true },
  event: { type: String, required: true, index: true },
  roomName: { type: String, index: true },
  roomSid: { type: String },
  participantIdentity: { type: String },
  participantName: { type: String },
  success: { type: Boolean, required: true },
  duplicate: { type: Boolean, default: false },
  error: { type: String },
  rawEvent: { type: Schema.Types.Mixed },
  processedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// Unique index on eventId for idempotency — prevents duplicate processing
LiveKitWebhookLogSchema.index({ eventId: 1 }, { unique: true });

// Compound indexes for common queries
LiveKitWebhookLogSchema.index({ createdAt: -1 });
LiveKitWebhookLogSchema.index({ event: 1, createdAt: -1 });
LiveKitWebhookLogSchema.index({ roomName: 1, createdAt: -1 });

// TTL: auto-delete logs after 96 hours (4 days)
// LiveKit retries for several hours, so 96h gives ample margin
LiveKitWebhookLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 345600 });

export const LiveKitWebhookLog = mongoose.model<ILiveKitWebhookLog>('LiveKitWebhookLog', LiveKitWebhookLogSchema);
