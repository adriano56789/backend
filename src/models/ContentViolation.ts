import { BaseModel } from '../db/BaseModel';

export interface IContentViolation {
    id: string;
    userId: string;          // quem tentou capturar
    userName: string;
    streamId: string;        // sala onde aconteceu ('' se fora de live)
    hostId: string;          // dono da transmissão
    type: 'print' | 'record' | 'capture' | 'contextmenu';
    userAgent?: string;
    timestamp: Date;
}

export const COLLECTION = 'contentviolations';
export class ContentViolation extends BaseModel<IContentViolation> {
    static collectionName = 'contentviolations';
}
