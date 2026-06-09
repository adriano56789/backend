import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  id: string;
  email?: string;
  password?: string;
  token?: string;
  identification: string;
  name: string;
  displayName?: string;
  avatar?: string;
  avatarUrl: string;
  coverUrl?: string;
  streamServerUrl?: string;
  rtmpIngestUrl?: string;
  srtIngestUrl?: string;
  streamKey?: string;
  playbackUrl?: string;
  roomId?: string;
  photos?: string[];
  avatarImages?: string[];
  country?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other' | 'not_specified';
  level: number;
  xp?: number;
  rank?: number;
  location?: { type: string; coordinates: [number, number] }; // GeoJSON [longitude, latitude]
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  distance?: string;
  fans: number;
  following: number;
  followingList: string[];
  followersList: string[];
  blockedUsers: string[];
  friendsList: string[];
  receptores: number;
  enviados: number;
  topFansAvatars?: string[];
  accountStatus?: 'active' | 'inactive' | 'blocked' | 'suspended';
  isLive?: boolean;
  isOnline?: boolean;
  lastSeen?: Date;
  currentStreamId?: string;
  diamonds: number;
  earnings: number;
  earnings_withdrawn: number;
  diamonds_purchased: number;
  withdrawal_method?: { method: string; details: any };
  bio?: string;
  obras?: Array<{ id: string; url: string }>;
  curtidas?: string[];
  birthday?: string;
  residence?: string;
  emotional_status?: string;
  tags?: string[];
  profession?: string;
  isVIP?: boolean;
  vipSubscriptionDate?: string;
  vipExpirationDate?: string;
  isAvatarProtected?: boolean;
  activeFrameId?: string | null;
  ownedFrames: { frameId: string; expirationDate: string }[];
  chatPermission?: 'all' | 'followers' | 'none';
  pipEnabled?: boolean;
  locationPermission?: 'granted' | 'denied' | 'prompt';
  cameraPermissionStatus?: 'granted' | 'denied' | 'prompt';
  microphonePermissionStatus?: 'granted' | 'denied' | 'prompt';
  showActivityStatus?: boolean;
  showLocation?: boolean;
  privateStreamSettings?: { privateInvite: boolean; followersOnly: boolean; fansOnly: boolean; friendsOnly: boolean };
  platformEarnings?: number;
  adminWithdrawalMethod?: { email: string };
  withdrawal_requests?: any[];
  frameExpiration?: Date | null;
  loginCount?: number;
  lastLogin?: Date;
  profileViews?: number;
  totalLives?: number;
  livesJoined?: number;
  messagesSent?: number;
  searchesPerformed?: number;
  recentActivities?: Array<{ action: string; resource?: string; timestamp?: Date; endpoint?: string }>;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  email: { type: String, unique: true, sparse: true },
  password: { type: String },
  token: { type: String },
  identification: { type: String, required: true },
  name: { type: String, required: true },
  displayName: { type: String },
  avatar: { type: String },
  avatarUrl: { type: String, default: '' },
  coverUrl: { type: String },
  streamServerUrl: { type: String },
  rtmpIngestUrl: { type: String },
  srtIngestUrl: { type: String },
  streamKey: { type: String },
  playbackUrl: { type: String },
  roomId: { type: String },
  photos: [{ type: String }],
  avatarImages: [{ type: String }],
  country: { type: String, default: 'br' },
  age: { type: Number, default: 25 },
  gender: { type: String, enum: ['male', 'female', 'other', 'not_specified'], default: 'not_specified' },
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  rank: { type: Number },
  location: { type: Schema.Types.Mixed },
  latitude: { type: Number },
  longitude: { type: Number },
  city: { type: String },
  state: { type: String },
  distance: { type: String },
  fans: { type: Number, default: 0 },
  following: { type: Number, default: 0 },
  followingList: [{ type: String }],
  followersList: [{ type: String }],
  blockedUsers: [{ type: String }],
  friendsList: [{ type: String }],
  receptores: { type: Number, default: 0 },
  enviados: { type: Number, default: 0 },
  topFansAvatars: [{ type: String }],
  accountStatus: { type: String, enum: ['active', 'inactive', 'blocked', 'suspended'], default: 'active' },
  isLive: { type: Boolean, default: false },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date },
  currentStreamId: { type: String },
  diamonds: { type: Number, default: 0 },
  earnings: { type: Number, default: 0 },
  earnings_withdrawn: { type: Number, default: 0 },
  diamonds_purchased: { type: Number, default: 0 },
  withdrawal_method: { type: Object },
  bio: { type: String },
  obras: [{ id: String, url: String }],
  curtidas: [{ type: String }],
  birthday: { type: String },
  residence: { type: String },
  emotional_status: { type: String },
  tags: [{ type: String }],
  profession: { type: String },
  isVIP: { type: Boolean, default: false },
  vipSubscriptionDate: { type: String },
  vipExpirationDate: { type: String },
  isAvatarProtected: { type: Boolean, default: false },
  activeFrameId: { type: String, default: null },
  ownedFrames: [{ frameId: String, expirationDate: String }],
  chatPermission: { type: String, enum: ['all', 'followers', 'none'], default: 'all' },
  pipEnabled: { type: Boolean, default: true },
  locationPermission: { type: String, enum: ['granted', 'denied', 'prompt'], default: 'prompt' },
  cameraPermissionStatus: { type: String, enum: ['granted', 'denied', 'prompt'], default: 'prompt' },
  microphonePermissionStatus: { type: String, enum: ['granted', 'denied', 'prompt'], default: 'prompt' },
  showActivityStatus: { type: Boolean, default: true },
  showLocation: { type: Boolean, default: true },
  privateStreamSettings: {
    privateInvite: { type: Boolean, default: false },
    followersOnly: { type: Boolean, default: false },
    fansOnly: { type: Boolean, default: false },
    friendsOnly: { type: Boolean, default: false }
  },
  platformEarnings: { type: Number, default: 0 },
  adminWithdrawalMethod: { email: String },
  withdrawal_requests: [{ type: Schema.Types.Mixed }],
  frameExpiration: { type: Date },
  loginCount: { type: Number, default: 0 },
  lastLogin: { type: Date },
  profileViews: { type: Number, default: 0 },
  totalLives: { type: Number, default: 0 },
  livesJoined: { type: Number, default: 0 },
  messagesSent: { type: Number, default: 0 },
  searchesPerformed: { type: Number, default: 0 },
  recentActivities: [{ action: String, resource: String, timestamp: Date, endpoint: String }]
}, { timestamps: true });

// Create text index for search
UserSchema.index({ name: 'text', displayName: 'text', bio: 'text', profession: 'text' });
// Create 2dsphere index for geospatial queries
UserSchema.index({ location: '2dsphere' });

export const User = mongoose.model<IUser>('User', UserSchema);
