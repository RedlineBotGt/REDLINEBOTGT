import { getSheetData, updateSheetData } from '../sheetsService';
import { calcularEloSesion, ParticipanteResultado } from './eloEngine';

/**
 * Procesa dinámicamente todas las sesiones (Qx y Cx) registradas en 'Ingreso2',
 * calcula el Elo acumulado jornada a jornada y sobrescribe la columna P en 'PQ2'.
 */
export async function procesarYActualizarEloGeneral(): Promise<void> {
    // 1. Obtener los pilotos de 'PQ2' (Columnas N a P)
    const pq2Data = await getSheetData('PQ2!N2:P22') || [];
    
    if (pq2Data.length === 0) {
        console.error('❌ [EloService] No se encontraron datos de pilotos en PQ2.');
        return;
    }

    const eloAcumuladoMap = new Map<string, number>();
    const ordenPilotos: string[] = [];

    for (const row of pq2Data) {
        const piloto = row[0] ? row[0].toString().trim() : ''; // Columna N: Nombre
        const eloInicial = row[2] ? parseFloat(row[2].toString()) : 1200; // Columna P: Elo

        if (piloto) {
            const clave = piloto.toLowerCase();
            eloAcumuladoMap.set(clave, eloInicial);
            ordenPilotos.push(clave);
        }
    }
    console.log('🔍 [EloService] Pilotos cargados desde PQ2:', ordenPilotos);

    // 2. Leer un rango amplio de 'Ingreso2' para cubrir todas las jornadas registradas
    const ingreso2Data = await getSheetData('Ingreso2!A2:C1000') || [];
    
    if (ingreso2Data.length === 0) {
        console.log('⚠️ [EloService] No hay sesiones registradas en Ingreso2.');
        return;
    }
    console.log('🔍 [EloService] Filas totales leídas de Ingreso2:', ingreso2Data.length);

    // Agrupar los resultados por identificador de sesión
    const sesionesMap = new Map<string, ParticipanteResultado[]>();

    for (const row of ingreso2Data) {
        const sesion = row[0] ? row[0].toString().trim().toUpperCase() : ''; // Columna A: Q1, C1...
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

    console.log('🔍 [EloService] Sesiones agrupadas encontradas:', Array.from(sesionesMap.keys()));
    for (const [sesion, parts] of sesionesMap.entries()) {
        console.log(`   ➡️ Sesión ${sesion}: ${parts.length} participantes`, parts.map(p => `(${p.posicion}) ${p.piloto}`));
    }

    // 3. Procesar secuencialmente todas las tandas
    for (const [nombreSesion, participantes] of sesionesMap.entries()) {
        const esQualy = nombreSesion.startsWith('Q');
        
        // Comprobar si los nombres de Ingreso2 hacen match exacto con PQ2
        participantes.forEach(p => {
            const clave = p.piloto.toLowerCase();
            if (!eloAcumuladoMap.has(clave)) {
                console.warn(`⚠️ [EloService] ADVERTENCIA: El piloto '${p.piloto}' en sesión '${nombreSesion}' NO coincide con ningún piloto registrado en PQ2 (clave buscada: '${clave}').`);
            }
        });

        const nuevosElos = calcularEloSesion(participantes, eloAcumuladoMap, esQualy);

        for (const [pilotoKey, nuevoElo] of nuevosElos.entries()) {
            eloAcumuladoMap.set(pilotoKey, nuevoElo);
        }
    }

    // 4. Preparar la salida final para la Columna P de PQ2
    const columnaEloFinalOutput: (number)[][] = ordenPilotos.map(clavePiloto => {
        const eloFinal = eloAcumuladoMap.get(clavePiloto) ?? 1200;
        return [eloFinal];
    });

    // 5. Sobrescribir la columna P con el Elo calculado
    await updateSheetData('PQ2!P2:P22', columnaEloFinalOutput);

    console.log(`✅ [EloService] Elo recalculado exitosamente tras procesar ${sesionesMap.size} sesiones de Ingreso2.`);
}
