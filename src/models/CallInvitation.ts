import { BaseModel } from '../db/BaseModel';
export interface ICallInvitation {
  hostId: string;
  hostName: string;
  guestId: string;
  guestName: string;
  roomId: string;
  streamId: string;
  streamKey: string;
  status: 'pending' | 'accepted' | 'declined' | 'ended';
  signalingUrl?: string;
  livekitRoom?: string;
  hostLiveKitToken?: string;
  guestLiveKitToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const COLLECTION = 'callinvitations';
export class CallInvitation extends BaseModel<ICallInvitation> {
  static collectionName = 'callinvitations';
}
