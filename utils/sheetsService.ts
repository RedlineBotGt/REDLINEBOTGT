import { google } from 'googleapis';

// 📌 ID de tu Google Sheet para REDLINE GT
const SPREADSHEET_ID = '1E-dMxBrK7gZLAGR2Ge7OuGEt-IvzVK8BWOTtxZojsXs';

function getAuthClient() {
  console.log('🔍 [Google Auth] Verificando credenciales individuales...');
  
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY || process.env.PRIVATE_KEY;
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.CLIENT_EMAIL;

  console.log('🔍 GOOGLE_PRIVATE_KEY existe:', !!privateKeyRaw);
  console.log('🔍 GOOGLE_CLIENT_EMAIL existe:', !!clientEmail);

  if (!privateKeyRaw || !clientEmail) {
    throw new Error('❌ Faltan las variables GOOGLE_PRIVATE_KEY o GOOGLE_CLIENT_EMAIL en Render.');
  }

  // Limpia y formatea correctamente los saltos de línea de la clave privada
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/spreadsheets'
    ]
  });
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
