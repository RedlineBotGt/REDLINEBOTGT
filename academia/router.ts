
import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getUserProgressCollection } from './models';
import {
    generarRetoIA,
    evaluarRespuestaIA
} from './aiService';

const router = Router();

const SCHEMA_VERSION = 2;

const PROFILES: Record<string, string> = {
    leo: 'Leo',
    papa: 'Papá',
    mama: 'Mamá'
};

const SUBJECTS = [
    'lateral',
    'matematicas',
    'geografia'
] as const;

type Subject = typeof SUBJECTS[number];

interface SubjectProgress {
    currentLevel: number;
    score: number;
    totalAttempts: number;
    totalCorrect: number;
    totalIncorrect: number;
    history: any[];
    activeChallenge: any | null;
}

function createInitialSubjectProgress(): SubjectProgress {
    return {
        currentLevel: 1,
        score: 0,
        totalAttempts: 0,
        totalCorrect: 0,
        totalIncorrect: 0,
        history: [],
        activeChallenge: null
    };
}

function createInitialSubjects() {
    return {
        lateral: createInitialSubjectProgress(),
        matematicas: createInitialSubjectProgress(),
        geografia: createInitialSubjectProgress()
    };
}

function isValidUser(userId: any): userId is string {
    return typeof userId === 'string' &&
        Object.prototype.hasOwnProperty.call(PROFILES, userId);
}

function isValidSubject(subject: any): subject is Subject {
    return typeof subject === 'string' &&
        SUBJECTS.includes(subject as Subject);
}

function getSubject(body: any): Subject {
    return isValidSubject(body?.subject)
        ? body.subject
        : 'lateral';
}

function getAccuracy(progress: any): number {
    const attempts = Number(progress?.totalAttempts || 0);
    const correct = Number(progress?.totalCorrect || 0);

    if (attempts === 0) return 0;

    return Math.round((correct / attempts) * 100);
}

/**
 * Crea el documento del perfil o inicializa la nueva versión.
 * Los datos antiguos de pruebas no se utilizan en el sistema nuevo.
 */
async function ensureUserProgress(userId: string) {
    const collection = await getUserProgressCollection();

    await collection.updateOne(
        { userId },
        {
            $setOnInsert: {
                userId,
                createdAt: new Date()
            }
        },
        { upsert: true }
    );

    await collection.updateOne(
        {
            userId,
            schemaVersion: { $ne: SCHEMA_VERSION }
        },
        {
            $set: {
                schemaVersion: SCHEMA_VERSION,
                subjects: createInitialSubjects(),
                updatedAt: new Date()
            }
        }
    );

    const progress = await collection.findOne({ userId });

    if (!progress) {
        throw new Error('No se pudo inicializar el progreso del perfil.');
    }

    return progress;
}

function getSubjectProgress(document: any, subject: Subject) {
    const progress = document?.subjects?.[subject];

    return progress || createInitialSubjectProgress();
}

/**
 * POST /api/academia/challenge/next
 * Obtiene el reto activo o genera uno nuevo.
 */
router.post(
    '/api/academia/challenge/next',
    async (req: Request, res: Response) => {
        try {
            const { userId } = req.body;
            const subject = getSubject(req.body);

            if (!isValidUser(userId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Perfil no válido.'
                });
            }

            if (subject !== 'lateral') {
                return res.status(400).json({
                    success: false,
                    message: 'Esta asignatura todavía no está activada.'
                });
            }

            const collection = await getUserProgressCollection();
            const document = await ensureUserProgress(userId);

            const subjectProgress = getSubjectProgress(
                document,
                subject
            );

            if (subjectProgress.activeChallenge) {
                const active = subjectProgress.activeChallenge;

                return res.json({
                    success: true,
                    level: subjectProgress.currentLevel,
                    challenge: {
                        id: active.id,
                        prompt: active.prompt,
                        category: active.category,
                        hint: active.hint
                    }
                });
            }

            const history = (subjectProgress.history || [])
                .map((item: any) => item.prompt)
                .filter((prompt: any) => typeof prompt === 'string')
                .slice(-30);

            const reto = await generarRetoIA(
                subjectProgress.currentLevel || 1,
                history
            );

            if (
                !reto ||
                typeof reto.prompt !== 'string' ||
                typeof reto.solution !== 'string' ||
                !reto.prompt.trim() ||
                !reto.solution.trim()
            ) {
                throw new Error('Gemini no ha generado un reto válido.');
            }

            const challengeId = randomUUID();

            const activeChallenge = {
                id: challengeId,
                prompt: reto.prompt,
                category: reto.category || 'Pensamiento lateral',
                hint: reto.hint || '',
                solution: reto.solution,
                createdAt: new Date()
            };

            const activePath = `subjects.${subject}.activeChallenge`;

            const result = await collection.updateOne(
                {
                    userId,
                    schemaVersion: SCHEMA_VERSION,
                    $or: [
                        { [activePath]: null },
                        { [activePath]: { $exists: false } }
                    ]
                },
                {
                    $set: {
                        [activePath]: activeChallenge,
                        updatedAt: new Date()
                    }
                }
            );

            if (result.modifiedCount === 0) {
                const latest = await collection.findOne({ userId });
                const latestProgress = getSubjectProgress(latest, subject);
                const active = latestProgress.activeChallenge;

                if (active) {
                    return res.json({
                        success: true,
                        level: latestProgress.currentLevel,
                        challenge: {
                            id: active.id,
                            prompt: active.prompt,
                            category: active.category,
                            hint: active.hint
                        }
                    });
                }

                return res.status(409).json({
                    success: false,
                    message: 'No se pudo guardar el reto. Inténtalo de nuevo.'
                });
            }

            return res.json({
                success: true,
                level: subjectProgress.currentLevel || 1,
                challenge: {
                    id: challengeId,
                    prompt: activeChallenge.prompt,
                    category: activeChallenge.category,
                    hint: activeChallenge.hint
                }
            });

        } catch (error) {
            console.error('Error generando reto:', error);

            return res.status(500).json({
                success: false,
                message: 'No se pudo generar el reto. Inténtalo de nuevo.'
            });
        }
    }
);

/**
 * POST /api/academia/challenge/submit
 *
 * Evalúa la respuesta y actualiza el progreso de forma atómica.
 */
router.post(
    '/api/academia/challenge/submit',
    async (req: Request, res: Response) => {
        try {
            const { userId, challengeId, userAnswer } = req.body;
            const subject = getSubject(req.body);

            if (!isValidUser(userId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Perfil no válido.'
                });
            }

            if (!isValidSubject(subject)) {
                return res.status(400).json({
                    success: false,
                    message: 'Asignatura no válida.'
                });
            }

            if (
                typeof challengeId !== 'string' ||
                typeof userAnswer !== 'string' ||
                !userAnswer.trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Falta el reto o la respuesta.'
                });
            }

            const collection = await getUserProgressCollection();
            const document = await ensureUserProgress(userId);

            const subjectProgress = getSubjectProgress(
                document,
                subject
            );

            const active = subjectProgress.activeChallenge;

            if (!active || active.id !== challengeId) {
                return res.status(409).json({
                    success: false,
                    message: 'Este reto ya no está activo. Carga el siguiente reto.'
                });
            }

            let evaluation;

            try {
                evaluation = await evaluarRespuestaIA(
                    active.prompt,
                    userAnswer.trim(),
                    active.solution
                );
            } catch (aiError) {
                console.error('Error evaluando respuesta:', aiError);

                return res.status(502).json({
                    success: false,
                    message: 'No se pudo evaluar la respuesta. Puedes intentarlo de nuevo.'
                });
            }

            if (
                !evaluation ||
                typeof evaluation.correct !== 'boolean'
            ) {
                return res.status(502).json({
                    success: false,
                    message: 'La evaluación recibida no es válida. Inténtalo de nuevo.'
                });
            }

            const prefix = `subjects.${subject}`;

            const oldCorrect = {
                $ifNull: [`$${prefix}.totalCorrect`, 0]
            };

            const oldAttempts = {
                $ifNull: [`$${prefix}.totalAttempts`, 0]
            };

            const oldIncorrect = {
                $ifNull: [`$${prefix}.totalIncorrect`, 0]
            };

            const oldScore = {
                $ifNull: [`$${prefix}.score`, 0]
            };

            const newCorrect = {
                $add: [
                    oldCorrect,
                    evaluation.correct ? 1 : 0
                ]
            };

            const historyEntry = {
                prompt: active.prompt,
                category: active.category,
                answeredAt: new Date(),
                correct: evaluation.correct
            };

            const result = await collection.updateOne(
                {
                    userId,
                    schemaVersion: SCHEMA_VERSION,
                    [`${prefix}.activeChallenge.id`]: challengeId
                },
                [
                    {
                        $set: {
                            [`${prefix}.totalAttempts`]: {
                                $add: [oldAttempts, 1]
                            },
                            [`${prefix}.totalCorrect`]: newCorrect,
                            [`${prefix}.totalIncorrect`]: {
                                $add: [
                                    oldIncorrect,
                                    evaluation.correct ? 0 : 1
                                ]
                            },
                            [`${prefix}.score`]: {
                                $add: [
                                    oldScore,
                                    evaluation.correct ? 10 : 0
                                ]
                            },
                            [`${prefix}.currentLevel`]: {
                                $add: [
                                    1,
                                    {
                                        $floor: {
                                            $divide: [newCorrect, 5]
                                        }
                                    }
                                ]
                            },
                            [`${prefix}.activeChallenge`]: null,
                            [`${prefix}.history`]: {
                                $slice: [
                                    {
                                        $concatArrays: [
                                            {
                                                $ifNull: [
                                                    `$${prefix}.history`,
                                                    []
                                                ]
                                            },
                                            {
                                                $literal: [historyEntry]
                                            }
                                        ]
                                    },
                                    -100
                                ]
                            },
                            updatedAt: '$$NOW'
                        }
                    }
                ] as any
            );

            if (result.modifiedCount !== 1) {
                return res.status(409).json({
                    success: false,
                    message: 'El reto ya se ha enviado o ha dejado de estar activo.'
                });
            }

            const updatedDocument = await collection.findOne({ userId });

            const updatedProgress = getSubjectProgress(
                updatedDocument,
                subject
            );

            return res.json({
                success: true,
                correct: evaluation.correct,
                feedback: evaluation.feedback,
                explanation: evaluation.explanation,
                level: updatedProgress.currentLevel,
                score: updatedProgress.score,
                totalCorrect: updatedProgress.totalCorrect,
                totalAttempts: updatedProgress.totalAttempts,
                totalIncorrect: updatedProgress.totalIncorrect
            });

        } catch (error) {
            console.error('Error enviando respuesta:', error);

            return res.status(500).json({
                success: false,
                message: 'No se pudo procesar la respuesta.'
            });
        }
    }
);

/**
 * POST /api/academia/progress
 *
 * Devuelve las estadísticas de una asignatura concreta.
 */
router.post(
    '/api/academia/progress',
    async (req: Request, res: Response) => {
        try {
            const { userId } = req.body;
            const subject = getSubject(req.body);

            if (!isValidUser(userId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Perfil no válido.'
                });
            }

            const document = await ensureUserProgress(userId);

            const progress = getSubjectProgress(
                document,
                subject
            );

            return res.json({
                success: true,
                subject,
                progress: {
                    level: progress.currentLevel,
                    score: progress.score,
                    totalAttempts: progress.totalAttempts,
                    totalCorrect: progress.totalCorrect,
                    totalIncorrect: progress.totalIncorrect,
                    accuracy: getAccuracy(progress)
                }
            });

        } catch (error) {
            console.error('Error cargando progreso:', error);

            return res.status(500).json({
                success: false,
                message: 'No se pudo cargar el progreso.'
            });
        }
    }
);

/**
 * POST /api/academia/ranking
 *
 * Sin subject: ranking general.
 * Con subject: ranking de esa asignatura.
 */
router.post(
    '/api/academia/ranking',
    async (req: Request, res: Response) => {
        try {
            const requestedSubject = req.body?.subject;

            if (
                requestedSubject !== undefined &&
                !isValidSubject(requestedSubject)
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Asignatura no válida.'
                });
            }

            const collection = await getUserProgressCollection();

            const documents = await collection
                .find({
                    userId: { $in: Object.keys(PROFILES) },
                    schemaVersion: SCHEMA_VERSION
                })
                .toArray();

            const ranking = Object.keys(PROFILES).map(userId => {
                const document = documents.find(
                    item => item.userId === userId
                );

                if (requestedSubject) {
                    const progress = getSubjectProgress(
                        document,
                        requestedSubject
                    );

                    return {
                        userId,
                        name: PROFILES[userId],
                        subject: requestedSubject,
                        level: progress.currentLevel,
                        score: progress.score,
                        totalAttempts: progress.totalAttempts,
                        totalCorrect: progress.totalCorrect,
                        totalIncorrect: progress.totalIncorrect,
                        accuracy: getAccuracy(progress)
                    };
                }

                let score = 0;
                let totalAttempts = 0;
                let totalCorrect = 0;
                let totalIncorrect = 0;

                const subjectLevels: Record<string, number> = {};

                for (const subject of SUBJECTS) {
                    const progress = getSubjectProgress(
                        document,
                        subject
                    );

                    score += Number(progress.score || 0);
                    totalAttempts += Number(progress.totalAttempts || 0);
                    totalCorrect += Number(progress.totalCorrect || 0);
                    totalIncorrect += Number(progress.totalIncorrect || 0);

                    subjectLevels[subject] = Number(
                        progress.currentLevel || 1
                    );
                }

                return {
                    userId,
                    name: PROFILES[userId],
                    score,
                    totalAttempts,
                    totalCorrect,
                    totalIncorrect,
                    accuracy: totalAttempts === 0
                        ? 0
                        : Math.round(
                            (totalCorrect / totalAttempts) * 100
                        ),
                    subjectLevels
                };
            });

            ranking.sort((a, b) =>
                b.score - a.score ||
                b.accuracy - a.accuracy ||
                b.totalCorrect - a.totalCorrect
            );

            return res.json({
                success: true,
                scope: requestedSubject ? 'subject' : 'general',
                subject: requestedSubject || null,
                ranking
            });

        } catch (error) {
            console.error('Error cargando ranking:', error);

            return res.status(500).json({
                success: false,
                message: 'No se pudo cargar el ranking.'
            });
        }
    }
);

export default router;
