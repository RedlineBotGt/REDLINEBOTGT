import { getSheetData, updateSheetData } from '../sheetsService';
import { calcularEloSesion, ParticipanteResultado } from './eloEngine';

/**
 * Procesa todas las sesiones (Qx y Cx) registradas en 'Ingreso2',
 * calcula la evolución acumulada del Elo y sobrescribe la columna
 * del Elo final en 'PQ2'.
 */
export async function procesarYActualizarEloGeneral(): Promise<void> {
    // 1. Obtener la lista de pilotos y su Elo Semilla/Inicial de 'PQ2'
    // Asumimos que los nombres/menciones están en M2:N22 y el Elo Semilla/Base en O2:O22
    const pq2Data = await getSheetData('PQ2!M2:O22') || [];
    
    if (pq2Data.length === 0) {
        console.error('No se encontraron datos de pilotos en PQ2.');
        return;
    }

    // Mapa para mantener el seguimiento del Elo acumulado por piloto
    const eloAcumuladoMap = new Map<string, number>();
    
    // Mapeo original para respetar el orden exacto de las filas al escribir al final
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

    // 2. Leer la hoja 'Ingreso2' (recorriendo todas las filas donde hay carreras/qualys registrados)
    const ingreso2Data = await getSheetData('Ingreso2!A2:C200') || [];
    
    if (ingreso2Data.length === 0) {
        console.log('No hay sesiones registradas en Ingreso2.');
        return;
    }

    // Agrupar los resultados por identificador de sesión (Q1, C1, Q2, C2...)
    const sesionesMap = new Map<string, ParticipanteResultado[]>();

    for (const row of ingreso2Data) {
        const sesion = row[0] ? row[0].toString().trim().toUpperCase() : ''; // Columna A: Q1, C1...
        const posicion = row[1] ? parseInt(row[1].toString(), 10) : NaN;      // Columna B: Posición
        const piloto = row[2] ? row[2].toString().trim() : '';               // Columna C: Nombre piloto

        // Solo procesamos si hay datos válidos en la fila
        if (!sesion || isNaN(posicion) || !piloto) continue;

        if (!sesionesMap.has(sesion)) {
            sesionesMap.set(sesion, []);
        }

        sesionesMap.get(sesion)!.push({
            piloto,
            posicion
        });
    }

    // 3. Procesar las sesiones secuencialmente para ir acumulando las variaciones de Elo
    for (const [nombreSesion, participantes] of sesionesMap.entries()) {
        const esQualy = nombreSesion.startsWith('Q');
        
        // Recalculamos el Elo acumulado pasando los resultados de esta sesión
        const nuevosElos = calcularEloSesion(participantes, eloAcumuladoMap, esQualy);

        // Actualizamos nuestro mapa persistente con los nuevos valores
        for (const [pilotoKey, nuevoElo] of nuevosElos.entries()) {
            eloAcumuladoMap.set(pilotoKey, nuevoElo);
        }
    }

    // 4. Preparar la columna de salida con el Elo final acumulado
    const columnaEloFinalOutput: (number)[][] = ordenPilotos.map(clavePiloto => {
        const eloFinal = eloAcumuladoMap.get(clavePiloto) ?? 1200;
        return [eloFinal];
    });

    // 5. Escribir el Elo actualizado directamente en la Columna P de 'PQ2'
    await updateSheetData('PQ2!P2:P22', columnaEloFinalOutput);

    console.log('Elo procesado y actualizado correctamente en PQ2!P2:P22.');
}
