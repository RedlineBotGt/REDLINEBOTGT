import { Schema, model, models } from 'mongoose';

const attendanceSchema = new Schema({
    eventId: { type: String, required: true }, // Identificador del mensaje/evento de asistencia
    userId: { type: String, required: true },
    username: { type: String, required: true },
    status: { type: String, enum: ['asistire', 'duda', 'no_voy'], required: true },
    updatedAt: { type: Date, default: Date.now }
});

// Índice único para que un usuario solo pueda tener un estado activo por evento (si cambia de opinión, se actualiza)
attendanceSchema.index({ eventId: 1, userId: 1 }, { unique: true });

export const AttendanceModel = models.Attendance || model('Attendance', attendanceSchema);
