export interface ParticipanteResultado {
    piloto: string;
    posicion: number;
}

export interface VariacionElo {
    piloto: string;
    eloAnterior: number;
    eloNuevo: number;
    diferencia: number;
}

// Factor K: Impacto diferenciado entre Sesiones
const K_CARRERA = 32;
const K_QUALY = 16;

/**
 * Calcula el cambio de Elo para un conjunto de participantes en una sesión dada.
 * Utiliza el modelo de duelos multijugador (todos contra todos) ajustado por el tamaño de la parrilla.
 * 
 * @param participantes Lista de participantes con su nombre y posición de llegada.
 * @param elosActuales Mapa con el Elo actual de cada piloto (clave en minúsculas).
 * @param esQualy Booleano que indica si la sesión es Clasificación (Q) o Carrera (C).
 * @returns Un mapa con los nuevos valores de Elo recalculados.
 */
export function calcularEloSesion(
    participantes: ParticipanteResultado[],
    elosActuales: Map<string, number>,
    esQualy: boolean
): Map<string, number> {
    const kFactor = esQualy ? K_QUALY : K_CARRERA;
    const nuevosElos = new Map<string, number>(elosActuales);
    const numParticipantes = participantes.length;

    if (numParticipantes < 2) return nuevosElos;

    // Normalizador para evitar que el tamaño de la parrilla escale el K-Factor de forma desproporcionada
    const divisorParrilla = numParticipantes - 1;

    for (let i = 0; i < numParticipantes; i++) {
        const pilotoA = participantes[i];
        const claveA = pilotoA.piloto.toLowerCase();
        const eloA = elosActuales.get(claveA) ?? 1200;

        let cambioTotal = 0;

        for (let j = 0; j < numParticipantes; j++) {
            if (i === j) continue;

            const pilotoB = participantes[j];
            const claveB = pilotoB.piloto.toLowerCase();
            const eloB = elosActuales.get(claveB) ?? 1200;

            // Resultado real (S): 1 si A queda por delante de B, 0.5 si empatan, 0 si queda detrás
            let resultadoReal = 0.5;
            if (pilotoA.posicion < pilotoB.posicion) {
                resultadoReal = 1.0;
            } else if (pilotoA.posicion > pilotoB.posicion) {
                resultadoReal = 0.0;
            }

            // Expectativa de victoria de A sobre B según la fórmula estándar de Elo
            const expectativaA = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));

            // Sumatoria de variaciones contra el resto de pilotos
            cambioTotal += kFactor * (resultadoReal - expectativaA);
        }

        // Promediamos el cambio según los rivales enfrentados
        const eloAjustado = Math.round(eloA + (cambioTotal / divisorParrilla));
        nuevosElos.set(claveA, eloAjustado);
    }

    return nuevosElos;
}
