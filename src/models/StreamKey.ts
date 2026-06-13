import mongoose, { Schema, Document } from 'mongoose';

export interface IStreamKey extends Document {
  streamKey: string;
  rtmpIngestUrl?: string;
  srtIngestUrl?: string;
  streamServerUrl?: string;
  playbackUrl?: string;
  hlsUrl?: string;
  webrtcUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StreamKeySchema: Schema = new Schema({
  streamKey: { type: String, required: true, unique: true },
  rtmpIngestUrl: { type: String },
  srtIngestUrl: { type: String },
  streamServerUrl: { type: String },
  playbackUrl: { type: String },
  hlsUrl: { type: String },
  webrtcUrl: { type: String }
}, { timestamps: true });

export const StreamKey = mongoose.model('StreamKey', StreamKeySchema);
