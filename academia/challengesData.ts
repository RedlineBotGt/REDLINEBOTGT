
// academia/challengesData.ts

/**
 * Estructura común de un reto de Academia Campos.
 *
 * Los retos nuevos se generan mediante Gemini.
 * Este tipo se conserva para mantener compatibilidad
 * con otros módulos que puedan utilizar Challenge.
 */
export interface Challenge {
    id: string;
    level: number;
    category: string;
    prompt: string;
    explanation: string;
}

/**
 * No se utiliza un banco fijo de preguntas.
 *
 * Los retos se generan dinámicamente mediante IA
 * y se guardan individualmente en MongoDB.
 */
export const initialChallenges: Challenge[] = [];
