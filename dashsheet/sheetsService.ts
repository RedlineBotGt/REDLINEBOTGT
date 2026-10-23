import { getSheetData, updateSheetData } from '../sheetsService';
import { calcularEloSesion, ParticipanteResultado } from './eloEngine';

/**
 * Procesa dinámicamente todas las sesiones (Qx y Cx) registradas en 'Ingreso2',
 * calcula el Elo acumulado jornada a jornada y sobrescribe la columna P en 'PQ2'.
 */
export async function procesarYActualizarEloGeneral(): Promise<void> {
    // 1. Obtener los pilotos y su Elo Semilla/Inicial de 'PQ2' (Columnas M, N, O)
    const pq2Data = await getSheetData('PQ2!M2:O22') || [];
    
    if (pq2Data.length === 0) {
        console.error('❌ No se encontraron datos de pilotos en PQ2.');
        return;
    }

    const eloAcumuladoMap = new Map<string, number>();
    const ordenPilotos: string[] = [];

    for (const row of pq2Data) {
        const piloto = row[0] ? row[0].toString().trim() : '';
        const eloInicial = row[2] ? parseFloat(row[2].toString()) : 1200;

        if (piloto) {
            const clave = piloto.toLowerCase();
            eloAcumuladoMap.set(clave, eloInicial);
            ordenPilotos.push(clave);
        }
    }

    // 2. Leer un rango amplio de 'Ingreso2' para cubrir todas las jornadas registradas
    const ingreso2Data = await getSheetData('Ingreso2!A2:C1000') || [];
    
    if (ingreso2Data.length === 0) {
        console.log('⚠️ No hay sesiones registradas en Ingreso2.');
        return;
    }

    // Agrupar los resultados por identificador de sesión respetando el orden de entrada
    const sesionesMap = new Map<string, ParticipanteResultado[]>();

    for (const row of ingreso2Data) {
        const sesion = row[0] ? row[0].toString().trim().toUpperCase() : ''; // Columna A: Q1, C1, Q2, C2...
        const posicion = row[1] ? parseInt(row[1].toString(), 10) : NaN;      // Columna B: Posición
        const piloto = row[2] ? row[2].toString().trim() : '';               // Columna C: Piloto

        if (!sesion || isNaN(posicion) || !piloto) continue;

        if (!sesionesMap.has(sesion)) {
            sesionesMap.set(sesion, []);
        }

        sesionesMap.get(sesion)!.push({
            piloto,
            posicion
        });
    }

    // 3. Procesar secuencialmente todas las tandas (Q1 -> C1 -> Q2 -> C2...)
    for (const [nombreSesion, participantes] of sesionesMap.entries()) {
        const esQualy = nombreSesion.startsWith('Q');
        
        // Recalcular Elo de la tanda usando los valores acumulados hasta este punto
        const nuevosElos = calcularEloSesion(participantes, eloAcumuladoMap, esQualy);

        // Actualizar el estado del mapa acumulado
        for (const [pilotoKey, nuevoElo] of nuevosElos.entries()) {
            eloAcumuladoMap.set(pilotoKey, nuevoElo);
        }
    }

    // 4. Preparar la salida final para la Columna P de PQ2
    const columnaEloFinalOutput: (number)[][] = ordenPilotos.map(clavePiloto => {
        const eloFinal = eloAcumuladoMap.get(clavePiloto) ?? 1200;
        return [eloFinal];
    });

    // 5. Sobrescribir la columna P con el Elo tras la última carrera procesada
    await updateSheetData('PQ2!P2:P22', columnaEloFinalOutput);

    console.log(`✅ Elo recalculado exitosamente tras procesar ${sesionesMap.size} sesiones de Ingreso2.`);
}
