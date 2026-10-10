export interface ClubTimeEntry {
    userId: string;
    userName: string;
    timeStr: string;   // Formato original "mm:ss:xxx"
    ms: number;        // Tiempo en milisegundos para ordenación exacta
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

// Almacenamiento temporal en memoria por servidor (Guild)
const clubSessions = new Map<string, ClubSession>();

/**
 * Obtiene o crea una sesión activa de GT Club para el servidor
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
 * Reinicia la sesión para empezar a configurar nuevos desafíos desde cero
 */
export function resetClubSession(guildId: string): ClubSession {
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
 * Convierte una cadena mm:ss:xxx o m:ss:xxx a milisegundos totales
 * Ejemplo: "01:23:456" -> 83456 ms
 */
export function parseTimeToMs(timeStr: string): number | null {
    // Regex flexible para m:ss:xxx o mm:ss:xxx
    const regex = /^(\d{1,2}):([0-5]\d):(\d{3})$/;
    const match = timeStr.trim().match(regex);
    if (!match) return null;

    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const milliseconds = parseInt(match[3], 10);

    return (minutes * 60 * 1000) + (seconds * 1000) + milliseconds;
}

/**
 * Registra o actualiza el tiempo de un usuario en un desafío específico.
 * Si el usuario ya tenía tiempo, solo se actualiza si el nuevo es mejor (menor ms).
 */
export function recordUserTime(
    guildId: string,
    challengeId: number,
    userId: string,
    userName: string,
    timeStr: string
): { success: boolean; isImprovement: boolean; challenge?: ClubChallenge } {
    const session = getClubSession(guildId);
    const challenge = session.challenges.find(c => c.id === challengeId);

    if (!challenge) {
        return { success: false, isImprovement: false };
    }

    const ms = parseTimeToMs(timeStr);
    if (ms === null) {
        return { success: false, isImprovement: false };
    }

    const existingIndex = challenge.times.findIndex(t => t.userId === userId);

    if (existingIndex !== -1) {
        const previousMs = challenge.times[existingIndex].ms;
        if (ms < previousMs) {
            // Mejoró su tiempo anterior
            challenge.times[existingIndex] = {
                userId,
                userName,
                timeStr,
                ms,
                timestamp: Date.now()
            };
            // Reordenar tiempos de menor a mayor
            challenge.times.sort((a, b) => a.ms - b.ms);
            return { success: true, isImprovement: true, challenge };
        } else {
            // El tiempo registrado no supera a su marca previa
            return { success: true, isImprovement: false, challenge };
        }
    } else {
        // Nuevo registro de participante
        challenge.times.push({
            userId,
            userName,
            timeStr,
            ms,
            timestamp: Date.now()
        });
        // Reordenar tiempos de menor a mayor
        challenge.times.sort((a, b) => a.ms - b.ms);
        return { success: true, isImprovement: true, challenge };
    }
}
