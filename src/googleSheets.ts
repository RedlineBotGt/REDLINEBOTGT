
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

// RECUPERAR Y NORMALIZAR LA CLAVE PRIVADA
function getPrivateKey(): string {
  let key = process.env.GOOGLE_PRIVATE_KEY || "";

  key = key.trim().replace(/^["']|["']$/g, "");

  // Detectar si la clave está codificada en Base64
  if (!key.includes("-----BEGIN PRIVATE KEY-----")) {
    key = Buffer.from(
      key.replace(/\s/g, ""),
      "base64"
    ).toString("utf8");
  }

  // Normalizar saltos de línea
  key = key
    .replace(/\\n/g, "\n")
    .trim();

  if (
    !key.includes("-----BEGIN PRIVATE KEY-----") ||
    !key.includes("-----END PRIVATE KEY-----")
  ) {
    throw new Error(
      "GOOGLE_PRIVATE_KEY no se ha podido convertir a formato PEM."
    );
  }

  return key;
}

const SHEET_TAB = "Inscripción";
const USER_ID_RANGE = "B2:B";

function getSheetsClient() {
  if (!SHEET_ID || !CLIENT_EMAIL) {
    throw new Error(
      "Faltan credenciales de Google Sheets."
    );
  }

  const privateKey = getPrivateKey();

  const auth = new google.auth.JWT({
    email: CLIENT_EMAIL,
    key: privateKey,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets.readonly"
    ]
  });

  return google.sheets({
    version: "v4",
    auth
  });
}

export async function isAuthorizedDiscordUser(
  discordId: string
): Promise<boolean> {
  if (!discordId) {
    return false;
  }

  const sheets = getSheetsClient();

  const range = `'${SHEET_TAB}'!${USER_ID_RANGE}`;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
    majorDimension: "COLUMNS"
  });

  const values = response.data.values?.[0] ?? [];

  return values.some(
    value =>
      String(value).trim() === String(discordId).trim()
  );
}
