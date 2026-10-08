import { google } from 'googleapis';
import { Buffer } from 'buffer';

// 📌 ID de tu Google Sheet para REDLINE GT
const SPREADSHEET_ID = '1E-dMxBrK7gZLAGR2Ge7OuGEt-IvzVK8BWOTtxZojsXs';

function cleanAndFormatPrivateKey(raw: string): string {
  let cleaned = raw.trim();

  // Quitar comillas envolventes si las hubiera
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }

  // Si está en Base64 (no empieza por -----BEGIN), la decodificamos
  if (!cleaned.startsWith('-----BEGIN')) {
    try {
      cleaned = Buffer.from(cleaned, 'base64').toString('utf8');
      console.log('🔓 [Google Auth] Clave decodificada con éxito desde Base64.');
    } catch (e) {
      console.error('❌ Error al decodificar Base64, usando valor directo.');
    }
  }

  // Normalizar escapes de saltos de línea
  cleaned = cleaned
    .replace(/\\\\n/g, '\n')
    .replace(/\\n/g, '\n');

  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';

  // Extraer exclusivamente el contenido base64 de la clave, limpiando espacios y saltos viejos
  const body = cleaned
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/[\r\n\s]+/g, '');

  // Reconstruir el PEM perfectamente formateado en bloques de 64 caracteres (requisito de OpenSSL 3.0)
  const chunkedBody = body.match(/.{1,64}/g)?.join('\n') || body;

  return `${pemHeader}\n${chunkedBody}\n${pemFooter}\n`;
}

function getAuthClient() {
  console.log('🔍 [Google Auth] Verificando credenciales individuales...');

  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY || process.env.PRIVATE_KEY;
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.CLIENT_EMAIL;

  console.log('🔍 GOOGLE_PRIVATE_KEY existe:', !!privateKeyRaw);
  console.log('🔍 GOOGLE_CLIENT_EMAIL existe:', !!clientEmail);

  if (!privateKeyRaw || !clientEmail) {
    throw new Error('❌ Faltan las variables GOOGLE_PRIVATE_KEY o GOOGLE_CLIENT_EMAIL en Render.');
  }

  const privateKey = cleanAndFormatPrivateKey(privateKeyRaw);

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
