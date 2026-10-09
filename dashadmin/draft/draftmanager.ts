// Dashadmin/draft/draftmanager.ts

export interface DraftState {
    pilots: string[];                              // Todos los pilotos ordenados por PreQualy (Columna A)
    allModels: string[];                           // Todos los modelos de coches (Columna B)
    choices: { pilot: string; model: string }[];   // Elecciones ya realizadas (Cols C y D)
    currentPilot: string | null;                   // Piloto al que le toca elegir en este turno
    availableModels: string[];                     // Modelos que aún quedan libres
    isCompleted: boolean;                          // True si todos los pilotos ya han elegido
}

/**
 * Lee el estado actual del Draft desde la hoja de cálculo en la pestaña "Draft".
 */
export async function getDraftState(sheets: any, spreadsheetId: string): Promise<DraftState> {
    try {
        // Obtenemos los rangos: A2:A (Pilotos), B2:B (Modelos), C2:D (Elecciones C: Piloto, D: Modelo)
        const response = await sheets.spreadsheets.values.batchGet({
            spreadsheetId,
            ranges: ['Draft!A2:A', 'Draft!B2:B', 'Draft!C2:D'],
        });

        const valueRanges = response.data.valueRanges || [];
        
        const pilotRows = valueRanges[0]?.values || [];
        const modelRows = valueRanges[1]?.values || [];
        const choiceRows = valueRanges[2]?.values || [];

        const pilots: string[] = pilotRows.map((row: any[]) => row[0]).filter(Boolean);
        const allModels: string[] = modelRows.map((row: any[]) => row[0]).filter(Boolean);
        
        const choices: { pilot: string; model: string }[] = choiceRows
            .filter((row: any[]) => row[0] && row[1])
            .map((row: any[]) => ({ pilot: row[0], model: row[1] }));

        // Conjuntos para filtrado rápido
        const chosenModelsSet = new Set(choices.map(c => c.model));
        const chosenPilotsSet = new Set(choices.map(c => c.pilot));

        // Modelos disponibles (en B pero no elegidos en D)
        const availableModels = allModels.filter(model => !chosenModelsSet.has(model));

        // El primer piloto de la lista A que todavía no aparece en las elecciones C
        const currentPilot = pilots.find(pilot => !chosenPilotsSet.has(pilot)) || null;

        const isCompleted = currentPilot === null || pilots.length === 0 || choices.length >= pilots.length;

        return {
            pilots,
            allModels,
            choices,
            currentPilot,
            availableModels,
            isCompleted
        };
    } catch (error) {
        console.error('❌ Error al obtener el estado del Draft desde Google Sheets:', error);
        throw error;
    }
}

/**
 * Registra la elección de un piloto escribiéndola en la siguiente fila vacía de las columnas C y D.
 */
export async function recordDraftChoice(sheets: any, spreadsheetId: string, pilot: string, model: string): Promise<void> {
    try {
        // Encontrar la siguiente fila disponible consultando las columnas C:D
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Draft!C2:D',
        });

        const rows = response.data.values || [];
        const nextRowIndex = rows.length + 2; // +2 porque empezamos a contar desde la fila 2 (A2/C2)

        // Escribir el piloto en la columna C y el modelo en la columna D de la siguiente fila libre
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Draft!C${nextRowIndex}:D${nextRowIndex}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[pilot, model]],
            },
        });

        console.log(`✅ Draft actualizado: ${pilot} ha elegido "${model}" en la fila ${nextRowIndex}`);
    } catch (error) {
        console.error('❌ Error al registrar la elección en el Draft:', error);
        throw error;
    }
}
