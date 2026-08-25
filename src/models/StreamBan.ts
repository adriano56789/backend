import { BaseModel } from '../db/BaseModel';

export interface IStreamBan {
    id: string;
    hostId: string;          // dono da sala que aplicou o ban
    bannedUserId: string;    // usuário bloqueado PRA SEMPRE das lives do host
    bannedUserName: string;
    reason: string;
    createdAt: Date;
}

export const COLLECTION = 'streambans';
export class StreamBan extends BaseModel<IStreamBan> {
    static collectionName = 'streambans';
}
