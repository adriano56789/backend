import { Collection } from 'mongodb';
import { BaseModel } from '../db/BaseModel';

export interface ILiveMessage {
    streamId: string;
    userId: string;
    userName: string;
    avatarUrl: string;
    level: number;
    activeFrameId: string | null;
    text: string;
    timestamp: Date;
}

export const COLLECTION = 'livemessages';
export class LiveMessage extends BaseModel<ILiveMessage> {
  static collectionName = 'livemessages';
}
