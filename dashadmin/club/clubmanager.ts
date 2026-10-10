import { MongoClient, Collection } from 'mongodb';

export interface ClubTimeEntry {
    userId: string;
    userName: string;
    timeStr: string;   // Formato original "mm:ss:xxx"
    ms: number;        // Tiempo en milisegundos para ordenación exacta
    points: number;    // Puntos obtenidos en este desafío
    timestamp: number;
}

export interface ClubChallenge {
    id: number;           // 1, 2, 3...
    title: string;        // Ej: Porsche 911 en Spa
    subtitle: string;     // Ej: Contrarreloj con neumáticos duros
    messageId?: string;   // ID del Embed enviado en Discord
    times: ClubTimeEntry[];
}

export interface ClubSession {
    guildId: string;
    channelId?: string;
    challenges: ClubChallenge[];
    active: boolean;
}

/**
 * Conexión centralizada a MongoDB para GT Club
 */
let cachedClubCollection: Collection | null = null;

async function getClubCollection(): Promise<Collection> {
    if (cachedClubCollection) return cachedClubCollection;

    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || process.env.MONGO_URL;
    if (!uri) {
        throw new Error('❌ No se encontró ninguna variable de entorno para MongoDB.');
    }

    const client = new MongoClient(uri);
    await client.connect();
    cachedClubCollection = client.db().collection('gt_club_sessions');
    return cachedClubCollection;
}

// Almacenamiento temporal en memoria por servidor (Guild)
const clubSessions = new Map<string, ClubSession>();

/**
 * Obtiene o crea una sesión activa de GT Club para el servidor (Memoria síncrona)
 */
export function getClubSession(guildId: string): ClubSession {
    if (!clubSessions.has(guildId)) {
        clubSessions.set(guildId, {
            guildId,
            challenges: [],
            active: false
        });
    }
    return clubSessions.get(guildId)!;
}

/**
 * Carga o inicializa la sesión asegurando sincronización con MongoDB
 */
export async function ensureClubSessionLoaded(guildId: string): Promise<ClubSession> {
    if (!clubSessions.has(guildId) || !clubSessions.get(guildId)?.active) {
        const loaded = await loadActiveSessionFromDB(guildId);
        if (!loaded && !clubSessions.has(guildId)) {
            const newSession: ClubSession = {
                guildId,
                challenges: [],
                active: false
            };
            clubSessions.set(guildId, newSession);
        }
    }
    return clubSessions.get(guildId)!;
}

/**
 * Reinicia la sesión para empezar a configurar nuevos desafíos desde cero
 */
export async function resetClubSession(guildId: string): Promise<ClubSession> {
    // Desactivar sesión previa en MongoDB si existía
    try {
        const collection = await getClubCollection();
        await collection.updateMany(
            { guildId, active: true },
            { $set: { active: false } }
        );
    } catch (err) {
        console.error('❌ Error desactivando sesiones anteriores en MongoDB:', err);
    }

    const newSession: ClubSession = {
        guildId,
        challenges: [],
        active: false
    };
    clubSessions.set(guildId, newSession);
    return newSession;
}

/**
 * Añade un nuevo desafío a la sesión actual
 */
export function addChallengeToSession(guildId: string, title: string, subtitle: string): ClubChallenge {
    const session = getClubSession(guildId);
    const newId = session.challenges.length + 1;
    const challenge: ClubChallenge = {
        id: newId,
        title,
        subtitle,
        times: []
    };
    session.challenges.push(challenge);
    return challenge;
}

/**
 * Edita un desafío existente (título y subtítulo)
 */
export async function editChallengeInSession(
    guildId: string,
    challengeId: number,
    newTitle: string,
    newSubtitle: string
): Promise<ClubChallenge | null> {
    const session = await ensureClubSessionLoaded(guildId);
    const challenge = session.challenges.find(c => c.id === challengeId);

    if (!challenge) return null;

    challenge.title = newTitle;
    challenge.subtitle = newSubtitle;

    if (session.active) {
        await saveSessionToDB(session);
    }

    return challenge;
}

/**
 * Elimina un desafío de la sesión y reordena los IDs restantes
 */
export async function deleteChallengeFromSession(
    guildId: string,
    challengeId: number
): Promise<{ success: boolean; deletedMessageId?: string }> {
    const session = await ensureClubSessionLoaded(guildId);
    const index = session.challenges.findIndex(c => c.id === challengeId);

    if (index === -1) return { success: false };

    const deletedMessageId = session.challenges[index].messageId;

    // Eliminar desafío
    session.challenges.splice(index, 1);

    // Reordenar IDs secuencialmente (#1, #2, #3...)
    session.challenges.forEach((ch, idx) => {
        ch.id = idx + 1;
    });

    if (session.active) {
        await saveSessionToDB(session);
    }

    return { success: true, deletedMessageId };
}

/**
 * Convierte una cadena mm:ss:xxx o m:ss:xxx a milisegundos totales
 */
export function parseTimeToMs(timeStr: string): number | null {
    const regex = /^(\d{1,2}):([0-5]\d):(\d{3})$/;
    const match = timeStr.trim().match(regex);
    if (!match) return null;

    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const milliseconds = parseInt(match[3], 10);

    return (minutes * 60 * 1000) + (seconds * 1000) + milliseconds;
}

/**
 * Recalcula los puntos de cada participante según su posición (5 - 3 - 2 - 1)
 */
function recalculateChallengePoints(challenge: ClubChallenge) {
    challenge.times.forEach((entry, index) => {
        if (index === 0) {
            entry.points = 5; // 1º puesto
        } else if (index === 1) {
            entry.points = 3; // 2º puesto
        } else if (index === 2) {
            entry.points = 2; // 3º puesto
        } else {
            entry.points = 1; // 4º puesto en adelante
        }
    });
}

/**
 * Registra o actualiza el tiempo de un usuario y guarda en MongoDB
 */
export async function recordUserTime(
    guildId: string,
    challengeId: number,
    userId: string,
    userName: string,
    timeStr: string
): Promise<{ success: boolean; isImprovement: boolean; challenge?: ClubChallenge }> {
    const session = await ensureClubSessionLoaded(guildId);
    const challenge = session.challenges.find(c => c.id === challengeId);

    if (!challenge) {
        return { success: false, isImprovement: false };
    }

    const ms = parseTimeToMs(timeStr);
    if (ms === null) {
        return { success: false, isImprovement: false };
    }

    const existingIndex = challenge.times.findIndex(t => t.userId === userId);
    let isImprovement = false;

    if (existingIndex !== -1) {
        const previousMs = challenge.times[existingIndex].ms;
        if (ms < previousMs) {
            challenge.times[existingIndex] = {
                userId,
                userName,
                timeStr,
                ms,
                points: 0,
                timestamp: Date.now()
            };
            isImprovement = true;
        }
    } else {
        challenge.times.push({
            userId,
            userName,
            timeStr,
            ms,
            points: 0,
            timestamp: Date.now()
        });
        isImprovement = true;
    }

    if (isImprovement) {
        // Ordenar tiempos de menor a mayor (más rápido primero)
        challenge.times.sort((a, b) => a.ms - b.ms);
        // Recalcular puntos con el nuevo ranking
        recalculateChallengePoints(challenge);

        // Guardar sesión actualizada en MongoDB
        if (session.active) {
            await saveSessionToDB(session);
        }
    }

    return { success: true, isImprovement, challenge };
}

/**
 * Guarda o actualiza la sesión activa en MongoDB
 */
export async function saveSessionToDB(session: ClubSession): Promise<void> {
    try {
        const collection = await getClubCollection();
        await collection.updateOne(
            { guildId: session.guildId, active: true },
            { $set: session },
            { upsert: true }
        );
    } catch (err) {
        console.error('❌ Error guardando sesión de GT Club en MongoDB:', err);
    }
}

/**
 * Carga la sesión activa desde MongoDB para memoria
 */
export async function loadActiveSessionFromDB(guildId: string): Promise<ClubSession | null> {
    try {
        const collection = await getClubCollection();
        const doc = await collection.findOne({ guildId, active: true });
        if (doc) {
            const session: ClubSession = {
                guildId: doc.guildId,
                channelId: doc.channelId,
                challenges: doc.challenges,
                active: doc.active
            };
            clubSessions.set(guildId, session);
            return session;
        }
    } catch (err) {
        console.error('❌ Error cargando sesión de GT Club desde MongoDB:', err);
    }
    return null;
}
