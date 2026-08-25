import mongoose, { Schema, Document } from 'mongoose';

export interface IDeviceToken extends Document {
  userId: string;
  /** FCM legado: token bruto. Web Push nativo: JSON completo da PushSubscription. */
  token: string;
  /** Endpoint da subscription (Web Push) — identidade única do navegador. */
  endpoint?: string;
  platform: 'web' | 'android' | 'ios';
  createdAt: Date;
  updatedAt: Date;
}

const DeviceTokenSchema: Schema = new Schema({
  userId: { type: String, required: true, index: true },
  token: { type: String, required: true, unique: true },
  endpoint: { type: String, index: { unique: true, sparse: true } },
  platform: { type: String, enum: ['web', 'android', 'ios'], default: 'web' },
}, { timestamps: true, id: false });

export const DeviceToken = mongoose.model<IDeviceToken>('DeviceToken', DeviceTokenSchema);
