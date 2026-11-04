
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY
  ?.replace(/\\n/g, "\n")
  .replace(/^["']|["']$/g, "")
  .trim();

const SHEET_TAB = "Inscripción";
const USER_ID_RANGE = "B2:B";

function getSheetsClient() {
  if (!SHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
    throw new Error(
      "Faltan credenciales de Google Sheets."
    );
  }

  // Comprobar que la clave tenga formato PEM
  if (
    !PRIVATE_KEY.includes("-----BEGIN PRIVATE KEY-----") ||
    !PRIVATE_KEY.includes("-----END PRIVATE KEY-----")
  ) {
    throw new Error(
      "GOOGLE_PRIVATE_KEY no tiene un formato PEM válido."
    );
  }

  const auth = new google.auth.JWT({
    email: CLIENT_EMAIL,
    key: PRIVATE_KEY,
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
