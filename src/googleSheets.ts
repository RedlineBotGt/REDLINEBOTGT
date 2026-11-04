
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

// Recuperar y normalizar la clave privada
function getPrivateKey(): string {
  let key = process.env.GOOGLE_PRIVATE_KEY || "";

  key = key.trim().replace(/^["']|["']$/g, "");

  // Detectar si está codificada en Base64
  if (!key.includes("-----BEGIN PRIVATE KEY-----")) {
    key = Buffer.from(
      key.replace(/\s/g, ""),
      "base64"
    ).toString("utf8");
  }

  // Normalizar saltos de línea
  key = key.replace(/\\n/g, "\n").trim();

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
      "Faltan GOOGLE_SHEET_ID o GOOGLE_SERVICE_ACCOUNT_EMAIL."
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
    console.warn("[WEBLINEGT] Discord ID vacío.");
    return false;
  }

  try {
    const sheets = getSheetsClient();

    const range = `'${SHEET_TAB}'!${USER_ID_RANGE}`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID!,
      range,
      majorDimension: "COLUMNS"
    });

    const values = response.data.values?.[0] ?? [];

    const normalizedDiscordId = String(discordId).trim();

    const normalizedValues = values.map(value =>
      String(value).trim()
    );

    const authorized = normalizedValues.includes(
      normalizedDiscordId
    );

    console.log("[WEBLINEGT] Comprobación de inscripción:", {
      discordId: normalizedDiscordId,
      filasLeidas: values.length,
      idEncontrado: authorized,
      hoja: SHEET_TAB,
      rango: USER_ID_RANGE
    });

    return authorized;

  } catch (error: any) {
    console.error(
      "[WEBLINEGT] Error consultando Google Sheets:",
      error?.message || error
    );

    throw error;
  }
}
