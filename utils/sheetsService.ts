import { google } from 'googleapis';
import path from 'path';

const SPREADSHEET_ID = '1E-dMxBrK7gZLAGR2Ge7OuGEt-IvzVK8BWOTtxZojsXs';

export async function getSheetData(range: string) {
    try {
        let auth;

        // Si estás en Render y configuras la variable de entorno GOOGLE_CREDENTIALS_JSON
        if (process.env.GOOGLE_CREDENTIALS_JSON) {
            const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
            auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
            });
        } else {
            // Si estás en local usando el archivo credentials.json
            auth = new google.auth.GoogleAuth({
                keyFile: path.join(process.cwd(), 'credentials.json'),
                scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
            });
        }

        const sheets = google.sheets({ version: 'v4', auth });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
        });

        console.log(`✅ Datos obtenidos correctamente para el rango: ${range}`);
        return response.data.values || [];
    } catch (error) {
        console.error(`❌ Error al leer Google Sheets en el rango ${range}:`, error);
        return [];
    }
}
