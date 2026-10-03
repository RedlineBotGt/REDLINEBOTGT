import { google } from 'googleapis';
import path from 'path';

// El ID exacto de tu Google Sheet
const SPREADSHEET_ID = '1E-dMxBrK7gZLAGR2Ge7OuGEt-IvzVK8BWOTtxZojsXs';

export async function getSheetData(range: string) {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: path.join(process.cwd(), 'credentials.json'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
        });

        return response.data.values || [];
    } catch (error) {
        console.error('❌ Error al leer Google Sheets:', error);
        return [];
    }
}
