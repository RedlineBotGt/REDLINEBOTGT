// academia/routers.ts
import express, { Router, Request, Response } from 'express';
import path from 'path';
import { getUserProgressCollection } from './models';
import { generarRetoIA, evaluarRespuestaIA } from './aiService';

export const academiaRouter = Router();

const publicPath = path.join(__dirname, 'public');
academiaRouter.use(express.static(publicPath));

academiaRouter.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Endpoint: Obtener el siguiente reto generado por la IA
academiaRouter.post('/api/academia/challenge/next', async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, error: "Usuario no especificado" });
        }

        const collection = await getUserProgressCollection();
        let progress = await collection.findOne({ userId });

        if (!progress) {
            progress = { userId, currentLevel: 1, streak: 0, history: [] };
            await collection.insertOne(progress);
        }

        const historialPrompts = (progress.history || []).map((h: any) => h.challengePrompt);
        const nuevoReto = await generarRetoIA(progress.currentLevel, historialPrompts);

        res.json({
            success: true,
            level: progress.currentLevel,
            challenge: {
                id: "ai_gen_" + Date.now(),
                prompt: nuevoReto.prompt,
                hint: nuevoReto.hint
            }
        });
    } catch (error) {
        console.error("Error al obtener reto con IA:", error);
        res.status(500).json({ success: false, error: "Error al generar el reto de la IA" });
    }
});

// Endpoint: Evaluar la respuesta usando la IA y actualizar MongoDB
academiaRouter.post('/api/academia/challenge/submit', async (req: Request, res: Response) => {
    try {
        const { userId, userAnswer, challengePrompt } = req.body;
        if (!userId || !userAnswer) {
            return res.status(400).json({ success: false, error: "Datos incompletos" });
        }

        const collection = await getUserProgressCollection();
        let progress = await collection.findOne({ userId });

        if (!progress) {
            progress = { userId, currentLevel: 1, streak: 0, history: [] };
        }

        const evaluacion = await evaluarRespuestaIA(challengePrompt || "Reto lógico", userAnswer);

        const nuevoHistorialItem = {
            challengePrompt: challengePrompt || "Reto lógico",
            userAnswer,
            aiFeedback: evaluacion.feedback,
            solvedAt: new Date()
        };

        const newLevel = evaluacion.correct ? (progress.currentLevel + 1) : progress.currentLevel;
        const newStreak = evaluacion.correct ? (progress.streak + 1) : 0;

        await collection.updateOne(
            { userId },
            { 
                $set: { currentLevel: newLevel, streak: newStreak },
                $push: { history: nuevoHistorialItem as any }
            },
            { upsert: true }
        );

        res.json({
            success: true,
            correct: evaluacion.correct,
            feedback: evaluacion.feedback
        });
    } catch (error) {
        console.error("Error al procesar respuesta con IA:", error);
        res.status(500).json({ success: false, error: "Error al procesar la respuesta con la IA" });
    }
});
