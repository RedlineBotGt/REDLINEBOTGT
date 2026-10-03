import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

// 📌 ID de tu Google Sheet para REDLINE GT
const SPREADSHEET_ID = '1E-dMxBrK7gZLAGR2Ge7OuGEt-IvzVK8BWOTtxZojsXs';

function getAuthClient() {
  // Chivato de depuración para la consola de Render
  console.log('🔍 [Google Auth] Verificando entorno en Render...');
  console.log('🔍 GOOGLE_CREDENTIALS existe:', !!process.env.GOOGLE_CREDENTIALS);
  console.log('🔍 GOOGLE_PRIVATE_KEY existe:', !!process.env.GOOGLE_PRIVATE_KEY);

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

  // 2. Si se configuró un JSON completo en la variable de entorno GOOGLE_CREDENTIALS
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      const rawCreds = process.env.GOOGLE_CREDENTIALS.trim();
      const credentials = JSON.parse(rawCreds);
      
      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
      
      console.log('☁️ [Google Auth] GOOGLE_CREDENTIALS cargada y parseada con éxito.');
      return new google.auth.GoogleAuth({
        credentials,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets.readonly',
          'https://www.googleapis.com/auth/spreadsheets'
        ],
      });
    } catch (e: any) {
      console.error('❌ Error crítico al parsear GOOGLE_CREDENTIALS en JSON:', e.message);
    }
  }

  // 3. Variables separadas por si acaso
  let privateKey = process.env.GOOGLE_PRIVATE_KEY || process.env.PRIVATE_KEY;
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.CLIENT_EMAIL;

  if (privateKey && clientEmail) {
    console.log('☁️ [Google Auth] Usando GOOGLE_PRIVATE_KEY y GOOGLE_CLIENT_EMAIL de entorno');
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

  throw new Error('❌ Error crítico: Render no detecta GOOGLE_CREDENTIALS ni las credenciales separadas. Revisa tus Environment Variables en el panel de Render.');
}

export async function getSheetData(range: string): Promise<any[][] | undefined> {
  try {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });
    
    return response.data.values;
  } catch (error: any) {
    console.error(`❌ Error al leer Google Sheets en el rango ${range}:`, error.message);
    throw error;
  }
}
