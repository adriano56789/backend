import mongoose, { Schema, Document } from 'mongoose';

export interface IGift extends Document {
    id: string;
    name: string;
    price: number;
    icon: string;
    category: 'Popular' | 'Luxo' | 'Atividade' | 'VIP' | 'Efeito' | 'Entrada';
    videoUrl?: string;
    audioUrl?: string;
    duration?: number; // em milissegundos
    noBlend?: boolean; // se true, reproduz o video em tela cheia com bordas sem transparência mix-blend-screen
    triggersAutoFollow: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const GiftSchema: Schema = new Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    icon: { type: String, required: true },
    category: {
        type: String,
        enum: ['Popular', 'Luxo', 'Atividade', 'VIP', 'Efeito', 'Entrada'],
        required: true
    },
    videoUrl: { type: String },
    audioUrl: { type: String },
    duration: { type: Number },
    noBlend: { type: Boolean, default: false },
    triggersAutoFollow: { type: Boolean, default: false }
}, { timestamps: true, id: false });

GiftSchema.index({ category: 1 });

export const Gift = mongoose.model<IGift>('Gift', GiftSchema);
