import { google } from 'googleapis';
import { Buffer } from 'buffer';

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

  let privateKey = privateKeyRaw.trim();

  // Limpiar comillas envolventes si las hubiera por error al pegar
  if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
    privateKey = privateKey.slice(1, -1);
  }

  // 🛡️ MAGIA AUTOMÁTICA: Si la clave NO empieza por '-----BEGIN', asumimos que está en Base64 y la decodificamos al vuelo
  if (!privateKey.startsWith('-----BEGIN')) {
    try {
      privateKey = Buffer.from(privateKey, 'base64').toString('utf8');
      console.log('🔓 [Google Auth] Clave privada decodificada con éxito desde Base64.');
    } catch (error: any) {
      console.error('❌ Error al decodificar la clave Base64:', error.message);
    }
  }

  // Normalizamos los saltos de línea por si acaso viene en formato clásico con escapes
  privateKey = privateKey
    .replace(/\\\\n/g, '\n')
    .replace(/\\n/g, '\n');

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
