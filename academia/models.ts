// academia/models.ts
import mongoose, { Schema, Document } from 'mongoose';

// Interfaz para el Progreso del Usuario
IUserProgress extends Document {
    userId: string; // 'leo', 'papa', 'mama'
    currentLevel: number; // Nivel actual de dificultad
    streak: number; // Aciertos consecutivos
    history: {
        challengePrompt: string;
        userAnswer: string;
        aiFeedback: string;
        solvedAt: Date;
    }[];
}

const UserProgressSchema = new Schema<IUserProgress>({
    userId: { type: String, required: true, unique: true },
    currentLevel: { type: Number, default: 1 },
    streak: { type: Number, default: 0 },
    history: [
        {
            challengePrompt: String,
            userAnswer: String,
            aiFeedback: String,
            solvedAt: { type: Date, default: Date.now }
        }
    ]
});

export const UserProgress = mongoose.models.UserProgress || mongoose.model<IUserProgress>('UserProgress', UserProgressSchema);
