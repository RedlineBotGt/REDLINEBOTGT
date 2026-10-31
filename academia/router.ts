/* =====================================================
   ACADEMIA CAMPOS
   academia/router.ts
   ===================================================== */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getUserProgressCollection } from './models';
import {
    generarRetoIA,
    evaluarRespuestaIA
} from './aiService';

const router = Router();

const SCHEMA_VERSION = 2;
const POINTS_PER_CORRECT = 10;
const CORRECT_ANSWERS_PER_LEVEL = 5;
const MAX_HISTORY = 100;
const MAX_GENERATION_HISTORY = 30;

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

interface Challenge {
    id: string;
    prompt: string;
    category: string;
    hint: string;
    solution: string;
    createdAt: Date;
}

interface PublicChallenge {
    id: string;
    prompt: string;
    category: string;
    hint: string;
    createdAt: Date;
}

interface HistoryEntry {
    challengeId: string;
    prompt: string;
    answer: string;
    correct: boolean;
    feedback: string;
    createdAt: Date;
}

interface SubjectProgress {
    currentLevel: number;
    score: number;
    totalAttempts: number;
    totalCorrect: number;
    totalIncorrect: number;
    history: HistoryEntry[];
    activeChallenge: Challenge | null;
}

interface UserProgress {
    userId: string;
    schemaVersion: number;
    subjects: Record<Subject, SubjectProgress>;
    createdAt: Date;
    updatedAt: Date;
}

/* =====================================================
   UTILIDADES
   ===================================================== */

function isValidProfile(userId: unknown): userId is string {
    return (
        typeof userId === 'string' &&
        Object.prototype.hasOwnProperty.call(PROFILES, userId)
    );
}

function isValidSubject(value: unknown): value is Subject {
    return (
        typeof value === 'string' &&
        SUBJECTS.includes(value as Subject)
    );
}

function getSubject(body: any): Subject | null {
    if (!body || body.subject === undefined) {
        return 'lateral';
    }

    return isValidSubject(body.subject)
        ? body.subject
        : null;
}

/*
 * Esta función crea la versión pública del reto.
 * IMPORTANTE: nunca incluye la solución.
 */
function toPublicChallenge(
    challenge: Challenge
): PublicChallenge {
    return {
        id: challenge.id,
        prompt: challenge.prompt,
        category: challenge.category,
        hint: challenge.hint,
        createdAt: challenge.createdAt
    };
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

function createInitialSubjects(): Record<Subject, SubjectProgress> {
    return {
        lateral: createInitialSubjectProgress(),
        matematicas: createInitialSubjectProgress(),
        geografia: createInitialSubjectProgress()
    };
}

function getAccuracy(progress: SubjectProgress): number {
    if (progress.totalAttempts === 0) {
        return 0;
    }

    return Math.round(
        (progress.totalCorrect / progress.totalAttempts) * 100
    );
}

function getSafeSubjectProgress(
    document: any,
    subject: Subject
): SubjectProgress {
    const saved = document?.subjects?.[subject];

    if (!saved) {
        return createInitialSubjectProgress();
    }

    return {
        currentLevel: Number(saved.currentLevel) || 1,
        score: Number(saved.score) || 0,
        totalAttempts: Number(saved.totalAttempts) || 0,
        totalCorrect: Number(saved.totalCorrect) || 0,
        totalIncorrect: Number(saved.totalIncorrect) || 0,
        history: Array.isArray(saved.history) ? saved.history : [],
        activeChallenge: saved.activeChallenge || null
    };
}

/*
 * Inicializa los perfiles y las asignaturas.
 * Si hay dos peticiones simultáneas al crear un perfil,
 * controla el posible error de clave duplicada.
 */
async function ensureUserProgress(userId: string): Promise<any> {
    const collection = await getUserProgressCollection();

    try {
        await collection.updateOne(
            { userId },
            {
                $setOnInsert: {
                    userId,
                    schemaVersion: SCHEMA_VERSION,
                    subjects: createInitialSubjects(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );
    } catch (error: any) {
        // Otra petición pudo crear el mismo perfil simultáneamente.
        if (error?.code !== 11000) {
            throw error;
        }
    }

    const document = await collection.findOne({ userId });

    if (!document) {
        throw new Error(
            'No se ha podido crear el progreso del usuario.'
        );
    }

    /*
     * Migración única al esquema 2.
     * El filtro condicional evita que dos peticiones
     * reinicien el progreso simultáneamente.
     */
    if (document.schemaVersion !== SCHEMA_VERSION) {
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
    }

    const updated = await collection.findOne({ userId });

    if (!updated) {
        throw new Error(
            'No se ha podido recuperar el progreso del usuario.'
        );
    }

    return updated;
}

function sendError(
    response: Response,
    status: number,
    message: string
): void {
    response.status(status).json({
        success: false,
        message
    });
}

/* =====================================================
   SIGUIENTE RETO
   POST /api/academia/challenge/next
   ===================================================== */

router.post(
    '/api/academia/challenge/next',
    async (req: Request, res: Response) => {
        try {
            const { userId } = req.body;
            const subject = getSubject(req.body);

            if (!isValidProfile(userId)) {
                sendError(res, 400, 'Perfil no válido.');
                return;
            }

            if (!subject) {
                sendError(res, 400, 'Asignatura no válida.');
                return;
            }

            if (subject !== 'lateral') {
                sendError(
                    res,
                    400,
                    'Esta asignatura todavía no está disponible.'
                );
                return;
            }

            const collection = await getUserProgressCollection();
            const document = await ensureUserProgress(userId);
            const progress = getSafeSubjectProgress(
                document,
                subject
            );

            // Si ya hay un reto activo, se reutiliza sin revelar solución.
            if (progress.activeChallenge) {
                res.json({
                    success: true,
                    challenge: toPublicChallenge(
                        progress.activeChallenge
                    ),
                    level: progress.currentLevel,
                    reused: true
                });
                return;
            }

            const history = progress.history
                .slice(-MAX_GENERATION_HISTORY)
                .map((entry: HistoryEntry) => entry.prompt);

            const generated = await generarRetoIA(
                progress.currentLevel,
                history
            );

            if (
                !generated ||
                typeof generated.prompt !== 'string' ||
                !generated.prompt.trim() ||
                typeof generated.solution !== 'string' ||
                !generated.solution.trim()
            ) {
                sendError(
                    res,
                    502,
                    'Gemini no ha generado un reto válido. Inténtalo de nuevo.'
                );
                return;
            }

            const challenge: Challenge = {
                id: randomUUID(),
                prompt: generated.prompt.trim(),
                category: generated.category || 'Pensamiento lateral',
                hint: generated.hint || '',
                solution: generated.solution.trim(),
                createdAt: new Date()
            };

            const activePath =
                `subjects.${subject}.activeChallenge`;

            const saved = await collection.updateOne(
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
                        [activePath]: challenge,
                        updatedAt: new Date()
                    }
                }
            );

            if (saved.modifiedCount !== 1) {
                const latest = await collection.findOne({ userId });

                const latestProgress = getSafeSubjectProgress(
                    latest,
                    subject
                );

                if (latestProgress.activeChallenge) {
                    res.json({
                        success: true,
                        challenge: toPublicChallenge(
                            latestProgress.activeChallenge
                        ),
                        level: latestProgress.currentLevel,
                        reused: true
                    });
                    return;
                }

                sendError(
                    res,
                    409,
                    'No se ha podido guardar el reto. Vuelve a intentarlo.'
                );
                return;
            }

            res.json({
                success: true,
                challenge: toPublicChallenge(challenge),
                level: progress.currentLevel,
                reused: false
            });

        } catch (error) {
            console.error(
                'Error generando reto de Academia:',
                error
            );

            sendError(
                res,
                500,
                'No se ha podido preparar el reto. Inténtalo de nuevo.'
            );
        }
    }
);
/* =====================================================
   ENVÍO Y EVALUACIÓN
   POST /api/academia/challenge/submit
   ===================================================== */

router.post(
    '/api/academia/challenge/submit',
    async (req: Request, res: Response) => {
        try {
            const { userId, challengeId, userAnswer } = req.body;
            const subject = getSubject(req.body);

            if (!isValidProfile(userId)) {
                sendError(res, 400, 'Perfil no válido.');
                return;
            }

            if (!subject) {
                sendError(res, 400, 'Asignatura no válida.');
                return;
            }

            if (
                typeof challengeId !== 'string' ||
                typeof userAnswer !== 'string' ||
                !userAnswer.trim()
            ) {
                sendError(
                    res,
                    400,
                    'Falta el identificador del reto o la respuesta.'
                );
                return;
            }

            const collection = await getUserProgressCollection();
            const document = await ensureUserProgress(userId);
            const progress = getSafeSubjectProgress(
                document,
                subject
            );

            const active = progress.activeChallenge;

            if (!active || active.id !== challengeId) {
                sendError(
                    res,
                    409,
                    'Este reto ya no está activo. Carga uno nuevo.'
                );
                return;
            }

            let evaluation;

            try {
                evaluation = await evaluarRespuestaIA(
                    active.prompt,
                    userAnswer.trim(),
                    active.solution
                );
            } catch (error) {
                console.error(
                    'Error evaluando con Gemini:',
                    error
                );

                sendError(
                    res,
                    502,
                    'No se ha podido evaluar la respuesta. No se han sumado puntos.'
                );
                return;
            }

            if (
                !evaluation ||
                typeof evaluation.correct !== 'boolean'
            ) {
                sendError(
                    res,
                    502,
                    'Gemini ha devuelto una evaluación no válida.'
                );
                return;
            }

            const correct = evaluation.correct;
            const points = correct ? POINTS_PER_CORRECT : 0;

            const historyEntry: HistoryEntry = {
                challengeId,
                prompt: active.prompt,
                answer: userAnswer.trim(),
                correct,
                feedback: evaluation.feedback || '',
                createdAt: new Date()
            };

            const subjectPath = `subjects.${subject}`;
            const attemptsPath = `${subjectPath}.totalAttempts`;
            const correctPath = `${subjectPath}.totalCorrect`;
            const incorrectPath = `${subjectPath}.totalIncorrect`;
            const scorePath = `${subjectPath}.score`;
            const historyPath = `${subjectPath}.history`;
            const activePath = `${subjectPath}.activeChallenge`;
            const levelPath = `${subjectPath}.currentLevel`;

            /*
             * Actualización atómica:
             * el reto solo puede puntuarse una vez.
             */
            const updateResult = await collection.updateOne(
                {
                    userId,
                    schemaVersion: SCHEMA_VERSION,
                    [`${activePath}.id`]: challengeId
                },
                [
                    {
                        $set: {
                            [attemptsPath]: {
                                $add: [
                                    { $ifNull: [`$${attemptsPath}`, 0] },
                                    1
                                ]
                            },
                            [correctPath]: {
                                $add: [
                                    { $ifNull: [`$${correctPath}`, 0] },
                                    correct ? 1 : 0
                                ]
                            },
                            [incorrectPath]: {
                                $add: [
                                    { $ifNull: [`$${incorrectPath}`, 0] },
                                    correct ? 0 : 1
                                ]
                            },
                            [scorePath]: {
                                $add: [
                                    { $ifNull: [`$${scorePath}`, 0] },
                                    points
                                ]
                            },
                            [levelPath]: {
                                $add: [
                                    1,
                                    {
                                        $floor: {
                                            $divide: [
                                                {
                                                    $add: [
                                                        {
                                                            $ifNull: [
                                                                `$${correctPath}`,
                                                                0
                                                            ]
                                                        },
                                                        correct ? 1 : 0
                                                    ]
                                                },
                                                CORRECT_ANSWERS_PER_LEVEL
                                            ]
                                        }
                                    }
                                ]
                            },
                            [historyPath]: {
                                $slice: [
                                    {
                                        $concatArrays: [
                                            {
                                                $ifNull: [
                                                    `$${historyPath}`,
                                                    []
                                                ]
                                            },
                                            {
                                                $literal: [historyEntry]
                                            }
                                        ]
                                    },
                                    -MAX_HISTORY
                                ]
                            },
                            [activePath]: null,
                            updatedAt: '$$NOW'
                        }
                    }
                ]
            );

            if (updateResult.modifiedCount !== 1) {
                sendError(
                    res,
                    409,
                    'La respuesta ya se ha procesado o el reto ha caducado.'
                );
                return;
            }

            const updatedDocument = await collection.findOne({
                userId
            });

            const updatedProgress = getSafeSubjectProgress(
                updatedDocument,
                subject
            );

            res.json({
                success: true,
                correct,
                feedback: evaluation.feedback || '',
                explanation: evaluation.explanation || '',
                pointsAwarded: points,
                level: updatedProgress.currentLevel,
                score: updatedProgress.score,
                totalAttempts: updatedProgress.totalAttempts,
                totalCorrect: updatedProgress.totalCorrect,
                totalIncorrect: updatedProgress.totalIncorrect,
                accuracy: getAccuracy(updatedProgress)
            });

        } catch (error) {
            console.error(
                'Error enviando respuesta de Academia:',
                error
            );

            sendError(
                res,
                500,
                'Ha ocurrido un error al procesar la respuesta.'
            );
        }
    }
);

/* =====================================================
   CONSULTAR PROGRESO
   POST /api/academia/progress
   ===================================================== */

router.post(
    '/api/academia/progress',
    async (req: Request, res: Response) => {
        try {
            const { userId } = req.body;
            const subject = getSubject(req.body);

            if (!isValidProfile(userId)) {
                sendError(res, 400, 'Perfil no válido.');
                return;
            }

            if (!subject) {
                sendError(res, 400, 'Asignatura no válida.');
                return;
            }

            const document = await ensureUserProgress(userId);
            const progress = getSafeSubjectProgress(
                document,
                subject
            );

            res.json({
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
            console.error(
                'Error consultando progreso:',
                error
            );

            sendError(
                res,
                500,
                'No se ha podido consultar el progreso.'
            );
        }
    }
);

/* =====================================================
   RANKING GENERAL Y POR ASIGNATURA
   POST /api/academia/ranking
   ===================================================== */

router.post(
    '/api/academia/ranking',
    async (req: Request, res: Response) => {
        try {
            const requestedSubject = req.body?.subject;

            if (
                requestedSubject !== undefined &&
                !isValidSubject(requestedSubject)
            ) {
                sendError(
                    res,
                    400,
                    'Asignatura no válida.'
                );
                return;
            }

            const collection = await getUserProgressCollection();

            const documents = await collection.find({
                schemaVersion: SCHEMA_VERSION,
                userId: {
                    $in: Object.keys(PROFILES)
                }
            }).toArray();

            const ranking = Object.keys(PROFILES).map(userId => {
                const document = documents.find(
                    item => item.userId === userId
                );

                let score = 0;
                let totalAttempts = 0;
                let totalCorrect = 0;
                let totalIncorrect = 0;

                if (requestedSubject) {
                    const progress = getSafeSubjectProgress(
                        document,
                        requestedSubject
                    );

                    score = progress.score;
                    totalAttempts = progress.totalAttempts;
                    totalCorrect = progress.totalCorrect;
                    totalIncorrect = progress.totalIncorrect;

                } else {
                    for (const subject of SUBJECTS) {
                        const progress = getSafeSubjectProgress(
                            document,
                            subject
                        );

                        score += progress.score;
                        totalAttempts += progress.totalAttempts;
                        totalCorrect += progress.totalCorrect;
                        totalIncorrect += progress.totalIncorrect;
                    }
                }

                const accuracy = totalAttempts > 0
                    ? Math.round(
                        (totalCorrect / totalAttempts) * 100
                    )
                    : 0;

                return {
                    userId,
                    name: PROFILES[userId],
                    score,
                    totalAttempts,
                    totalCorrect,
                    totalIncorrect,
                    accuracy
                };
            });

            ranking.sort((a, b) => {
                if (b.score !== a.score) {
                    return b.score - a.score;
                }

                if (b.accuracy !== a.accuracy) {
                    return b.accuracy - a.accuracy;
                }

                return b.totalCorrect - a.totalCorrect;
            });

            res.json({
                success: true,
                subject: requestedSubject || 'general',
                ranking
            });

        } catch (error) {
            console.error(
                'Error generando ranking:',
                error
            );

            sendError(
                res,
                500,
                'No se ha podido cargar el ranking.'
            );
        }
    }
);

export default router;