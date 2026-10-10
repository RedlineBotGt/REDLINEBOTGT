// Dashadmin/draft/draftmanager.ts
import { google } from 'googleapis';
import { Buffer } from 'buffer';

const DEFAULT_SPREADSHEET_ID = '1E-dMxBrK7gZLAGR2Ge7OuGEt-IvzVK8BWOTtxZojsXs';

export interface DraftState {
    pilots: string[];                              // Pilotos / IDs por turno (Columna B)
    allModels: string[];                           // Modelos de coches (Columna C)
    choices: { pilot: string; model: string }[];   // Elecciones realizadas (Cols D y E)
    currentPilot: string | null;                   // Piloto al que le toca elegir en este turno
    availableModels: string[];                     // Modelos libres
    isCompleted: boolean;                          // True si todos han elegido
}

// Función auxiliar para obtener el cliente autenticado de Google Sheets
function getAuthenticatedSheets() {
    const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY || process.env.PRIVATE_KEY;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.CLIENT_EMAIL;

    if (!privateKeyRaw || !clientEmail) {
        throw new Error('❌ Faltan las variables GOOGLE_PRIVATE_KEY o GOOGLE_CLIENT_EMAIL en Render.');
    }

    let cleaned = privateKeyRaw.trim();
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
        cleaned = cleaned.slice(1, -1);
    }
    if (!cleaned.startsWith('-----BEGIN')) {
        try {
            cleaned = Buffer.from(cleaned, 'base64').toString('utf8');
        } catch (e) {}
    }
    cleaned = cleaned.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');
    const pemHeader = '-----BEGIN PRIVATE KEY-----';
    const pemFooter = '-----END PRIVATE KEY-----';
    const body = cleaned.replace(pemHeader, '').replace(pemFooter, '').replace(/[\r\n\s]+/g, '');
    const chunkedBody = body.match(/.{1,64}/g)?.join('\n') || body;
    const privateKey = `${pemHeader}\n${chunkedBody}\n${pemFooter}\n`;

    const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets.readonly',
            'https://www.googleapis.com/auth/spreadsheets'
        ]
    });

    return google.sheets({ version: 'v4', auth });
}

/**
 * Lee el estado actual del Draft desde la hoja de cálculo en la pestaña "Draft" (Usando B, C, D y E).
 */
export async function getDraftState(): Promise<DraftState> {
    try {
        const sheets = getAuthenticatedSheets();
        const spreadsheetId = DEFAULT_SPREADSHEET_ID;

        // Rangos exactos de 4 columnas:
        // B2:B ➔ IDs/Menciones de Pilotos
        // C2:C ➔ Modelos de Coches disponibles
        // D2:E ➔ Elecciones ya realizadas (D: ID Piloto, E: Coche Elegido)
        const response = await sheets.spreadsheets.values.batchGet({
            spreadsheetId,
            ranges: ['Draft!B2:B', 'Draft!C2:C', 'Draft!D2:E'],
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

        // Modelos disponibles (en C pero no elegidos en E)
        const availableModels = allModels.filter(model => !chosenModelsSet.has(model));

        // El primer piloto de la lista B que todavía no aparece en las elecciones D
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
 * Registra la elección de un piloto escribiéndola en la siguiente fila vacía de las columnas D y E.
 */
export async function recordDraftChoice(pilot: string, model: string): Promise<void> {
    try {
        const sheets = getAuthenticatedSheets();
        const spreadsheetId = DEFAULT_SPREADSHEET_ID;

        // Consultar la siguiente fila disponible consultando únicamente D:E
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Draft!D2:E',
        });

        const rows = response.data.values || [];
        const nextRowIndex = rows.length + 2; // +2 porque se empieza desde la fila 2 (D2:E2)

        // Escribir la ID del piloto en D y el coche en E
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Draft!D${nextRowIndex}:E${nextRowIndex}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[pilot, model]],
            },
        });

        console.log(`✅ Draft actualizado: ${pilot} ha elegido "${model}" en la fila ${nextRowIndex} (Cols D y E)`);
    } catch (error) {
        console.error('❌ Error al registrar la elección en el Draft:', error);
        throw error;
    }
}
