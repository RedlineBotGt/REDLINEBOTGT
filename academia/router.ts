
// academia/router.ts

import express, { Router } from 'express';
import { getUserProgressCollection } from './models';
import {
    generarRetoIA,
    evaluarRespuestaIA
} from './aiService';

export const academiaRouter = Router();

academiaRouter.use(express.json());

const TIEMPO_MAXIMO = 25000;

function conTimeout<T>(
    promesa: Promise<T>,
    ms: number = TIEMPO_MAXIMO
): Promise<T> {
    return Promise.race([
        promesa,
        new Promise<T>((_, reject) => {
            setTimeout(
                () => reject(new Error('La operación ha tardado demasiado. Inténtalo de nuevo.')),
                ms
            );
        })
    ]);
}

function validarUsuario(userId: unknown): userId is string {
    return typeof userId === 'string' &&
        ['leo', 'papa', 'mama'].includes(userId);
}

// 1. Obtener el siguiente reto
academiaRouter.post('/api/academia/challenge/next', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!validarUsuario(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Perfil de usuario no válido.'
            });
        }

        const collection = await conTimeout(getUserProgressCollection());

        let progreso: any = await conTimeout(
            collection.findOne({ userId })
        );

        if (!progreso) {
            progreso = {
                userId,
                currentLevel: 1,
                completedChallenges: [],
                history: [],
                totalAttempts: 0,
                totalCorrect: 0,
                totalIncorrect: 0,
                score: 0,
                activeChallenge: null
            };

            await conTimeout(collection.insertOne(progreso));
        }

        // Si ya existe un reto pendiente, devolvemos el mismo.
        if (progreso.activeChallenge) {
            return res.json({
                success: true,
                level: progreso.currentLevel || 1,
                challenge: {
                    id: progreso.activeChallenge.id,
                    prompt: progreso.activeChallenge.prompt,
                    category: progreso.activeChallenge.category,
                    hint: progreso.activeChallenge.hint
                }
            });
        }

        const historial = Array.isArray(progreso.history)
            ? progreso.history
            : [];

        const temasAnteriores = historial
            .slice(-15)
            .map((item: any) => item.prompt || '');

        console.log(`🤖 [Academia] Generando reto IA para ${userId}`);

        const reto = await conTimeout(
            generarRetoIA(
                progreso.currentLevel || 1,
                temasAnteriores
            )
        );

        const challengeId =
            `lateral_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const retoGuardado = {
            id: challengeId,
            prompt: reto.prompt,
            hint: reto.hint,
            solution: reto.solution,
            category: reto.category,
            createdAt: new Date()
        };

        await conTimeout(
            collection.updateOne(
                { userId },
                {
                    $set: {
                        activeChallenge: retoGuardado
                    }
                }
            )
        );

        console.log(`✅ [Academia] Reto generado para ${userId}`);

        return res.json({
            success: true,
            level: progreso.currentLevel || 1,
            challenge: {
                id: challengeId,
                prompt: reto.prompt,
                category: reto.category,
                hint: reto.hint
            }
        });

    } catch (error: any) {
        console.error(
            '❌ [Academia /next]:',
            error.message || error
        );

        return res.status(500).json({
            success: false,
            error: error.message || 'No se pudo generar el reto.'
        });
    }
});

// 2. Evaluar la respuesta del alumno
academiaRouter.post('/api/academia/challenge/submit', async (req, res) => {
    try {
        const { userId, challengeId, userAnswer } = req.body;

        if (!validarUsuario(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Perfil de usuario no válido.'
            });
        }

        if (
            typeof challengeId !== 'string' ||
            typeof userAnswer !== 'string' ||
            !userAnswer.trim()
        ) {
            return res.status(400).json({
                success: false,
                error: 'Faltan datos para evaluar la respuesta.'
            });
        }

        const collection = await conTimeout(getUserProgressCollection());

        const progreso: any = await conTimeout(
            collection.findOne({ userId })
        );

        if (!progreso) {
            return res.status(404).json({
                success: false,
                error: 'No se ha encontrado el progreso del usuario.'
            });
        }

        const reto = progreso.activeChallenge;

        if (!reto || reto.id !== challengeId) {
            return res.status(409).json({
                success: false,
                error: 'Este reto ya no está activo o ya ha sido respondido.'
            });
        }

        console.log(`🧠 [Academia] Evaluando respuesta de ${userId}`);

        const evaluacion = await conTimeout(
            evaluarRespuestaIA(
                reto.prompt,
                userAnswer.trim(),
                reto.solution
            )
        );

        const ahora = new Date();

        const resultado = {
            challengeId,
            prompt: reto.prompt,
            answer: userAnswer.trim(),
            correct: evaluacion.correct,
            feedback: evaluacion.feedback,
            explanation: evaluacion.explanation,
            answeredAt: ahora
        };

        const historial = Array.isArray(progreso.history)
            ? progreso.history
            : [];

        const nivelAnterior = progreso.currentLevel || 1;

        const nuevosIntentos = (progreso.totalAttempts || 0) + 1;
        const nuevosAciertos =
            (progreso.totalCorrect || 0) + (evaluacion.correct ? 1 : 0);
        const nuevosErrores =
            (progreso.totalIncorrect || 0) + (evaluacion.correct ? 0 : 1);

        // Puntuación inicial: 10 puntos por acierto.
        const nuevaPuntuacion =
            (progreso.score || 0) + (evaluacion.correct ? 10 : 0);

        // Subida de nivel cada cinco aciertos.
        const nuevoNivel =
            1 + Math.floor(nuevosAciertos / 5);

        await conTimeout(
            collection.updateOne(
                {
                    userId,
                    'activeChallenge.id': challengeId
                },
                {
                    $set: {
                        currentLevel: nuevoNivel,
                        totalAttempts: nuevosIntentos,
                        totalCorrect: nuevosAciertos,
                        totalIncorrect: nuevosErrores,
                        score: nuevaPuntuacion,
                        history: [
                            ...historial,
                            resultado
                        ].slice(-100),
                        activeChallenge: null
                    },
                    ...(evaluacion.correct
                        ? {
                            $addToSet: {
                                completedChallenges: challengeId
                            }
                        }
                        : {})
                }
            )
        );

        console.log(
            `📊 [Academia] ${userId}: ${evaluacion.correct ? 'ACIERTO' : 'ERROR'} | Nivel ${nivelAnterior} → ${nuevoNivel}`
        );

        return res.json({
            success: true,
            correct: evaluacion.correct,
            feedback: evaluacion.feedback,
            explanation: evaluacion.explanation,
            level: nuevoNivel,
            score: nuevaPuntuacion,
            totalCorrect: nuevosAciertos,
            totalAttempts: nuevosIntentos
        });

    } catch (error: any) {
        console.error(
            '❌ [Academia /submit]:',
            error.message || error
        );

        return res.status(500).json({
            success: false,
            error: error.message || 'No se pudo evaluar la respuesta.'
        });
    }
});

// 3. Consultar estadísticas individuales
academiaRouter.post('/api/academia/progress', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!validarUsuario(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Perfil de usuario no válido.'
            });
        }

        const collection = await conTimeout(getUserProgressCollection());

        const progreso: any = await conTimeout(
            collection.findOne({ userId })
        );

        if (!progreso) {
            return res.json({
                success: true,
                progress: {
                    level: 1,
                    score: 0,
                    totalAttempts: 0,
                    totalCorrect: 0,
                    totalIncorrect: 0
                }
            });
        }

        return res.json({
            success: true,
            progress: {
                level: progreso.currentLevel || 1,
                score: progreso.score || 0,
                totalAttempts: progreso.totalAttempts || 0,
                totalCorrect: progreso.totalCorrect || 0,
                totalIncorrect: progreso.totalIncorrect || 0
            }
        });

    } catch (error: any) {
        console.error(
            '❌ [Academia /progress]:',
            error.message || error
        );

        return res.status(500).json({
            success: false,
            error: 'No se pudieron consultar las estadísticas.'
        });
    }
});
