// academia/routers.ts
import express, { Router, Request, Response } from 'express';
import path from 'path';
import { UserProgress } from './models';
import { generarRetoIA, evaluarRespuestaIA } from './aiService';

export const academiaRouter = Router();

const publicPath = path.join(__dirname, 'public');
academiaRouter.use(express.static(publicPath));

academiaRouter.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Endpoint: Obtener el siguiente reto generado por la IA según el nivel en MongoDB
academiaRouter.post('/api/academia/challenge/next', async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, error: "Usuario no especificado" });
        }

        let progress = await UserProgress.findOne({ userId });
        if (!progress) {
            progress = await UserProgress.create({ userId, currentLevel: 1, streak: 0, history: [] });
        }

        // Extraer historiales previos para dar contexto a la IA
        const historialPrompts = progress.history.map(h => h.challengePrompt);

        // Llamada real a la IA para generar un reto único y adaptado
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

        let progress = await UserProgress.findOne({ userId });
        if (!progress) {
            progress = await UserProgress.create({ userId, currentLevel: 1, streak: 0, history: [] });
        }

        // Evaluar la respuesta mediante la IA
        const evaluacion = await evaluarRespuestaIA(challengePrompt || "Reto lógico", userAnswer);

        // Guardar en el historial
        progress.history.push({
            challengePrompt: challengePrompt || "Reto lógico",
            userAnswer,
            aiFeedback: evaluacion.feedback,
            solvedAt: new Date()
        });

        if (evaluacion.correct) {
            progress.currentLevel += 1; // Sube de nivel si el razonamiento es acertado
            progress.streak += 1;
        } else {
            progress.streak = 0;
        }

        await progress.save();

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
