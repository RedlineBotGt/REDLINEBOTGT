
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

function getPrivateKey(): string {
  let key = process.env.GOOGLE_PRIVATE_KEY || "";

  key = key.trim().replace(/^["']|["']$/g, "");

  if (!key.includes("-----BEGIN PRIVATE KEY-----")) {
    key = Buffer.from(
      key.replace(/\s/g, ""),
      "base64"
    ).toString("utf8");
  }

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

// Normalizar IDs de Discord
function normalizeDiscordId(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/^<@!?(\d+)>$/, "$1");
}

function getSheetsClient() {
  if (!SHEET_ID || !CLIENT_EMAIL) {
    throw new Error(
      "Faltan GOOGLE_SHEET_ID o GOOGLE_SERVICE_ACCOUNT_EMAIL."
    );
  }

  const auth = new google.auth.JWT({
    email: CLIENT_EMAIL,
    key: getPrivateKey(),
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

  try {
    const sheets = getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID!,
      range: `'${SHEET_TAB}'!${USER_ID_RANGE}`,
      majorDimension: "COLUMNS"
    });

    const values = response.data.values?.[0] ?? [];

    const normalizedDiscordId =
      normalizeDiscordId(discordId);

    const authorized = values.some(
      value =>
        normalizeDiscordId(value) === normalizedDiscordId
    );

    console.log("[WEBLINEGT] Comprobación de inscripción:", {
      discordId: normalizedDiscordId,
      filasLeidas: values.length,
      idEncontrado: authorized
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
