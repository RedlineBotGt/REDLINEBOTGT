import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

/**
 * Configura el cliente de autenticación de Google de forma ultra robusta.
 * Soporta: 
 * 1. Archivo local credential.json (si existe)
 * 2. Variable de entorno con el JSON completo (GOOGLE_CREDENTIALS)
 * 3. Variables separadas (GOOGLE_PRIVATE_KEY / GOOGLE_CLIENT_EMAIL)
 */
function getAuthClient() {
  // 1. Intentar buscar el archivo físico local credential.json
  const localPaths = [
    path.join(process.cwd(), 'credential.json'),
    path.join(__dirname, '../credential.json'),
    path.join(__dirname, '../../credential.json')
  ];

  for (const filePath of localPaths) {
    if (fs.existsSync(filePath)) {
      console.log(`📁 [Google Auth] Usando archivo local: ${filePath}`);
      return new google.auth.GoogleAuth({
        keyFile: filePath,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets.readonly',
          'https://www.googleapis.com/auth/spreadsheets'
        ],
      });
    }
  }

  // 2. Si se configuró un JSON completo en una sola variable de entorno (ej. GOOGLE_CREDENTIALS)
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
      console.log('☁️ [Google Auth] Usando GOOGLE_CREDENTIALS desde variables de entorno');
      return new google.auth.GoogleAuth({
        credentials,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets.readonly',
          'https://www.googleapis.com/auth/spreadsheets'
        ],
      });
    } catch (e) {
      console.error('❌ Error al parsear GOOGLE_CREDENTIALS:', e);
    }
  }

  // 3. Si se usan variables separadas (GOOGLE_PRIVATE_KEY y GOOGLE_CLIENT_EMAIL)
  let privateKey = process.env.GOOGLE_PRIVATE_KEY || process.env.PRIVATE_KEY;
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.CLIENT_EMAIL;

  if (privateKey && clientEmail) {
    console.log('☁️ [Google Auth] Usando GOOGLE_PRIVATE_KEY y GOOGLE_CLIENT_EMAIL de entorno');
    
    // CORRECCIÓN CRÍTICA: Reemplaza los '\\n' literales por saltos de línea reales '\n'
    privateKey = privateKey.replace(/\\n/g, '\n');

    return new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/spreadsheets'
      ]
    });
  }

  throw new Error('❌ Error crítico: No se encontró credential.json ni las variables de entorno de Google configuradas en Render.');
}

/**
 * Función principal para obtener datos de un rango en Google Sheets
 */
export async function getSheetData(range: string): Promise<any[][] | undefined> {
  try {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId) {
      throw new Error('❌ Falta la variable de entorno SPREADSHEET_ID en Render.');
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    
    return response.data.values;
  } catch (error: any) {
    console.error(`❌ Error al leer Google Sheets en el rango ${range}:`, error.message);
    throw error;
  }
}
