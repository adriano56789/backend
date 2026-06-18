import mongoose, { Schema, Document } from 'mongoose';

export interface IPurchaseAuditTrail extends Document {
    eventType: 'order_created' | 'payment_approved' | 'diamonds_delivered' | 'refund' | 'cancellation' | 'fraud_attempt';
    orderId: string;
    userId: string;
    ip: string;
    userAgent: string;
    metadata: any;
    createdAt: Date;
}

const PurchaseAuditTrailSchema: Schema = new Schema({
    eventType: {
        type: String,
        required: true,
        enum: ['order_created', 'payment_approved', 'diamonds_delivered', 'refund', 'cancellation', 'fraud_attempt']
    },
    orderId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    metadata: { type: Schema.Types.Mixed }
}, { timestamps: { createdAt: true, updatedAt: false } });

export const PurchaseAuditTrail = mongoose.model<IPurchaseAuditTrail>('PurchaseAuditTrail', PurchaseAuditTrailSchema);
