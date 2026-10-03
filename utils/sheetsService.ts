import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

const SPREADSHEET_ID = '1E-dMxBrK7gZLAGR2Ge7OuGEt-IvzVK8BWOTtxZojsXs';

export async function getSheetData(range: string) {
    try {
        let auth;

        // 1. Comprobar si existe la variable de entorno en la nube (Render)
        if (process.env.GOOGLE_CREDENTIALS_JSON) {
            let credentials;
            try {
                let rawJson = process.env.GOOGLE_CREDENTIALS_JSON.trim();
                if (rawJson.startsWith('"') && rawJson.endsWith('"')) {
                    rawJson = JSON.parse(rawJson);
                }
                credentials = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;

                // 🔑 REPARAR CLAVE PRIVADA: Corrige los saltos de línea planos (\n) que se aplanan en Render
                if (credentials && credentials.private_key) {
                    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
                }
            } catch (e) {
                console.error('❌ Error: GOOGLE_CREDENTIALS_JSON no tiene un formato JSON válido.');
                throw e;
            }
            auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
            });
        } else {
            // 2. Si no está en entorno, buscar el archivo local credentials.json
            const keyFilePath = path.join(process.cwd(), 'credentials.json');
            if (!fs.existsSync(keyFilePath)) {
                throw new Error(`No se encuentra el archivo 'credentials.json' en la ruta: ${keyFilePath}`);
            }
            auth = new google.auth.GoogleAuth({
                keyFile: keyFilePath,
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
