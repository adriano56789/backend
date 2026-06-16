import mongoose, { Schema, Document } from 'mongoose';

export interface IStreamer extends Document {
  id: string;
  hostId: string;
  name: string;
  avatar: string;
  location: string;
  time: string;
  message: string;
  tags: string[];
  isHot?: boolean;
  icon?: string;
  country?: string;
  viewers?: number;
  isPrivate?: boolean;
  quality?: string;
  demoVideoUrl?: string;
  rtmpIngestUrl?: string;
  srtIngestUrl?: string;
  streamKey?: string;
  playbackUrl?: string;
  streamServerUrl?: string;
  webrtcUrl?: string;
  hlsUrl?: string;
  flvUrl?: string;
  title?: string;
  description?: string;
  roomId?: string;
  endedBy?: string;
  endedAt?: Date;
  isLive?: boolean;
  startTime?: Date;
  endTime?: Date;
  streamStatus?: 'active' | 'ended' | 'preparing' | 'paused';
  category?: string;
  language?: string;
  maxViewers?: number;
  recordingEnabled?: boolean;
  chatEnabled?: boolean;
  giftsEnabled?: boolean;
  privateGiftId?: string;
  isAutoPrivateInviteEnabled?: boolean;
  password?: string;
  heartsCount?: number;
  microphoneEnabled?: boolean;
  soundEnabled?: boolean;
  autoFollowEnabled?: boolean;
  autoInviteEnabled?: boolean;
  moderators?: string[];
  kickedUsers?: string[];
  diamonds?: number;
  likes?: number;
  cover?: string;
  liveId?: string;
  rtmpUrl?: string;
  heartbeatCount?: number;
  webrtcSessionId?: string;
  srsClientId?: string;
  srsPublishData?: object;
  srsUnpublishData?: object;
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  candidates?: string;
  streamUrl?: string;
  pushUrl?: string;
  distance?: string;
  token?: string;
  vhost?: string;
  app?: string;
  stream?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StreamerSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  hostId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  avatar: { type: String, required: true },
  location: { type: String },
  time: { type: String },
  message: { type: String },
  tags: [{ type: String }],
  isHot: { type: Boolean, default: false },
  icon: { type: String },
  country: { type: String },
  viewers: { type: Number, default: 0 },
  onlineFans: { type: Number, default: 0 },
  onlineVisitors: { type: Number, default: 0 },
  isPrivate: { type: Boolean, default: false },
  quality: { type: String, default: 'HD' },
  demoVideoUrl: { type: String },
  rtmpIngestUrl: { type: String },
  srtIngestUrl: { type: String },
  streamKey: { type: String },
  playbackUrl: { type: String },
  streamServerUrl: { type: String },
  webrtcUrl: { type: String },
  hlsUrl: { type: String },
  flvUrl: { type: String },
  title: { type: String },
  description: { type: String },
  roomId: { type: String },
  endedBy: { type: String },
  endedAt: { type: Date },
  isLive: { type: Boolean, default: false },
  startTime: { type: Date },
  endTime: { type: Date },
  streamStatus: { type: String, enum: ['active', 'ended', 'preparing', 'paused'], default: 'preparing' },
  category: { type: String, default: 'popular' },
  language: { type: String, default: 'pt' },
  maxViewers: { type: Number, default: 1000 },
  recordingEnabled: { type: Boolean, default: false },
  chatEnabled: { type: Boolean, default: true },
  giftsEnabled: { type: Boolean, default: true },
  privateGiftId: { type: String },
  isAutoPrivateInviteEnabled: { type: Boolean, default: false },
  password: { type: String },
  heartsCount: { type: Number, default: 0 },
  microphoneEnabled: { type: Boolean, default: true },
  soundEnabled: { type: Boolean, default: true },
  autoFollowEnabled: { type: Boolean, default: false },
  autoInviteEnabled: { type: Boolean, default: false },
  moderators: [{ type: String }],
  kickedUsers: [{ type: String }],
  diamonds: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  cover: { type: String },
  liveId: { type: String },
  rtmpUrl: { type: String },
  heartbeatCount: { type: Number, default: 0 },
  webrtcSessionId: { type: String },
  srsClientId: { type: String },
  srsPublishData: { type: Object },
  srsUnpublishData: { type: Object },
  latitude: { type: Number },
  longitude: { type: Number },
  city: { type: String },
  state: { type: String },
  candidates: { type: String },
  streamUrl: { type: String },
  pushUrl: { type: String },
  distance: { type: String },
  token: { type: String },
  vhost: { type: String },
  app: { type: String },
  stream: { type: String }
}, { timestamps: true });

// Create indexes
StreamerSchema.index({ isLive: 1, category: 1 });
StreamerSchema.index({ isLive: 1, viewers: -1 });

export const Streamer = mongoose.model<IStreamer>('Streamer', StreamerSchema);
