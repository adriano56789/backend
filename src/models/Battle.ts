import mongoose, { Schema, Document } from 'mongoose';

export interface IBattle extends Document {
  streamerA: mongoose.Types.ObjectId;
  streamerB: mongoose.Types.ObjectId;
  scoreA: number;
  scoreB: number;
  status: 'pending' | 'active' | 'finished';
  winner?: mongoose.Types.ObjectId;
  durationSeconds: number;
  startedAt?: Date;
  endedAt?: Date;
  roomId?: string;
  opponentId?: string;
  heartsA: number;
  heartsB: number;
}

const BattleSchema = new Schema<IBattle>({
  streamerA: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  streamerB: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  scoreA: { type: Number, default: 0 },
  scoreB: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'active', 'finished'], default: 'pending' },
  winner: { type: Schema.Types.ObjectId, ref: 'User' },
  durationSeconds: { type: Number, default: 300 },
  startedAt: { type: Date },
  endedAt: { type: Date },
  roomId: { type: String },
  opponentId: { type: String },
  heartsA: { type: Number, default: 0 },
  heartsB: { type: Number, default: 0 }
}, { timestamps: true });

export const Battle = mongoose.model<IBattle>('Battle', BattleSchema);
