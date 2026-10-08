import { Schema, model, models } from 'mongoose';

const sheetStateSchema = new Schema({
    userId: { type: String, required: true, unique: true },
    content: { type: String, default: '' },
    title: { type: String, default: '' },
    channelId: { type: String, default: null },
    roleId: { type: String, default: null },
    updatedAt: { type: Date, default: Date.now, expires: 86400 } // Expira automáticamente en 24h por limpieza
});

export const SheetStateModel = models.SheetState || model('SheetState', sheetStateSchema);
