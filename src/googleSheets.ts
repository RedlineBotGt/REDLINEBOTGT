
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

function getPrivateKey(): string {
  const raw = (process.env.GOOGLE_PRIVATE_KEY || "").trim();

  if (!raw) {
    throw new Error("Falta la variable GOOGLE_PRIVATE_KEY.");
  }

  // Acepta PEM directo, saltos \n escapados y valores codificados en Base64.
  // También admite una clave incluida dentro de un JSON de cuenta de servicio.
  const candidates: string[] = [raw];
  let current = raw.replace(/^["']|["']$/g, "").trim();

  for (let i = 0; i < 3; i++) {
    current = current.replace(/\\n/g, "\n").trim();

    const jsonMatch = current.match(/^\s*\{[\s\S]*\}\s*$/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(current);
        if (typeof parsed.private_key === "string") {
          current = parsed.private_key;
          candidates.push(current);
          continue;
        }
      } catch {
        // Si no es JSON válido, se prueba como texto/Base64 normal.
      }
    }

    candidates.push(current);

    const begin = current.indexOf("-----BEGIN PRIVATE KEY-----");
    const finish = current.indexOf("-----END PRIVATE KEY-----");
    if (begin !== -1 && finish > begin) {
      return current
        .slice(begin, finish + "-----END PRIVATE KEY-----".length)
        .trim();
    }

    const compact = current.replace(/\s/g, "").replace(/^base64:/i, "");
    if (!/^[A-Za-z0-9+/]+=*$/.test(compact)) break;

    try {
      const decoded = Buffer.from(compact, "base64").toString("utf8");
      if (!decoded || decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }

  // Última comprobación de los formatos probados, sin registrar el secreto.
  for (const candidate of candidates) {
    const begin = candidate.indexOf("-----BEGIN PRIVATE KEY-----");
    const finish = candidate.indexOf("-----END PRIVATE KEY-----");
    if (begin !== -1 && finish > begin) {
      return candidate
        .slice(begin, finish + "-----END PRIVATE KEY-----".length)
        .trim();
    }
  }

  throw new Error(
    "GOOGLE_PRIVATE_KEY no contiene una clave PEM válida. Comprueba el formato de la variable en Vercel."
  );
}

const SHEET_TAB = "Inscripción";
const USER_ID_RANGE = "B2:B";

// Rango de clasificación
const CLASIFICACION_RANGE = "'Tabla2'!B1:N34";

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

// ======================================
// OBTENER CLASIFICACIÓN
// ======================================

export async function getClasificacionData(): Promise<string[][]> {
  try {
    const sheets = getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID!,
      range: CLASIFICACION_RANGE
    });

    const values = response.data.values ?? [];

    console.log("[WEBLINEGT] Clasificación obtenida:", {
      filasLeidas: values.length
    });

    return values as string[][];

  } catch (error: any) {
    console.error(
      "[WEBLINEGT] Error consultando la clasificación:",
      error?.message || error
    );

    throw error;
  }
}
