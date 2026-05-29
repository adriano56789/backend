import mongoose, { Schema, Document } from 'mongoose';

export interface IPurchaseRecord extends Document {
    id: string;
    userId: string;
    type: 'purchase_diamonds' | 'withdraw_earnings' | 'withdraw_platform_earnings' | 'purchase_frame' | 'platform_fee_income' | 'withdrawal' | 'commission';
    description: string;
    amountBRL: number;
    amountCoins: number;
    status: 'Concluído' | 'Pendente' | 'Cancelado' | 'Processando' | 'Aprovado' | 'Recusado';
    externalReference?: string;
    paymentId?: string;
    metadata?: any;
    createdAt: Date;
    updatedAt: Date;
}

const PurchaseRecordSchema: Schema = new Schema({
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    type: {
        type: String,
        required: true,
        enum: ['purchase_diamonds', 'withdraw_earnings', 'withdraw_platform_earnings', 'purchase_frame', 'platform_fee_income', 'withdrawal', 'commission']
    },
    description: { type: String, required: true },
    amountBRL: { type: Number, required: true },
    amountCoins: { type: Number, default: 0 },
    status: {
        type: String,
        required: true,
        enum: ['Concluído', 'Pendente', 'Cancelado', 'Processando', 'Aprovado', 'Recusado'],
        default: 'Pendente'
    },
    externalReference: { type: String, index: true },
    paymentId: { type: String, index: true },
    metadata: { type: Schema.Types.Mixed }
}, { timestamps: true });

export const PurchaseRecord = mongoose.model<IPurchaseRecord>('PurchaseRecord', PurchaseRecordSchema);
