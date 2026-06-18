import mongoose, { Schema, Document } from 'mongoose';

export interface IEmptyApiLog extends Document {
    method: string;
    endpoint: string;
    query: string;
    requestBody: string;
    responseSummary: string;
    statusCode: number;
    userId?: string;
    userAgent: string;
    referer: string;
    ip: string;
    createdAt: Date;
}

const EmptyApiLogSchema = new Schema<IEmptyApiLog>({
    method: { type: String, required: true },
    endpoint: { type: String, required: true, index: true },
    query: { type: String, default: '' },
    requestBody: { type: String, default: '' },
    responseSummary: { type: String, default: '' },
    statusCode: { type: Number, required: true },
    userId: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    referer: { type: String, default: '' },
    ip: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

EmptyApiLogSchema.index({ createdAt: -1 });
EmptyApiLogSchema.index({ endpoint: 1, createdAt: -1 });

export const EmptyApiLog = mongoose.model<IEmptyApiLog>('EmptyApiLog', EmptyApiLogSchema);
