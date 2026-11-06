// ========================================
// MOTOR DE COMUNICACIÓN CON GEMINI
// Academia Campos
// ========================================

const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite"
] as const;

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

const TIMEOUT_MS = 20000;
const MAX_INTENTOS = 2;

// ========================================
// ERRORES
// ========================================

export class ErrorGeminiTemporal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErrorGeminiTemporal";
  }
}

// ========================================
// UTILIDADES
// ========================================

function esperar(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function obtenerApiKey(): string {
  const key =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMAI_API_KEY;

  if (!key) {
    throw new Error(
      "Falta configurar GEMINI_API_KEY en Render."
    );
  }

  return key;
}

function esErrorTemporal(status: number): boolean {
  return [
    408,
    429,
    500,
    502,
    503,
    504
  ].includes(status);
}

// ========================================
// EXTRAER TEXTO DE GEMINI
// ========================================

function extraerTexto(data: any): string {
  if (typeof data?.output_text === "string") {
    return data.output_text;
  }

  if (Array.isArray(data?.steps)) {
    for (const step of data.steps) {
      if (
        step?.type === "model_output" &&
        Array.isArray(step.content)
      ) {
        const texto = step.content
          .filter((item: any) => item?.type === "text")
          .map((item: any) => item.text || "")
          .join("\n");

        if (texto) {
          return texto;
        }
      }
    }
  }

  throw new Error(
    "Gemini no ha devuelto un contenido válido."
  );
}

// ========================================
// CONVERTIR RESPUESTA A JSON
// ========================================

function parsearJSON<T>(texto: string): T {
  const limpio = texto
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(limpio) as T;
  } catch {
    throw new Error(
      "Gemini ha devuelto una respuesta que no es JSON válido."
    );
  }
}

// ========================================
// CONSULTAR UN MODELO
// ========================================

async function consultarGemini<T>(
  instrucciones: string,
  esquema: object,
  modelo: string
): Promise<T> {
  const apiKey = obtenerApiKey();

  let ultimoError: Error | null = null;

  for (
    let intento = 1;
    intento <= MAX_INTENTOS;
    intento++
  ) {
    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      TIMEOUT_MS
    );

    try {
      console.log(
        `[GEMINI] Consultando modelo: ${modelo}. ` +
        `Intento ${intento}/${MAX_INTENTOS}.`
      );

      const respuesta = await fetch(GEMINI_URL, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },

        body: JSON.stringify({
          model: modelo,
          input: instrucciones,

          response_format: {
            type: "text",
            mime_type: "application/json",
            schema: esquema
          }
        }),

        signal: controller.signal
      });

      if (!respuesta.ok) {
        const detalle = await respuesta.text();

        const mensaje =
          `Gemini respondió con HTTP ${respuesta.status}: ` +
          detalle.slice(0, 500);

        if (esErrorTemporal(respuesta.status)) {
          throw new ErrorGeminiTemporal(mensaje);
        }

        throw new Error(mensaje);
      }

      const data = await respuesta.json();

      const texto = extraerTexto(data);

      return parsearJSON<T>(texto);

    } catch (error: any) {
      if (error?.name === "AbortError") {
        ultimoError = new ErrorGeminiTemporal(
          `El modelo ${modelo} ha agotado el tiempo de espera.`
        );

      } else if (
        error instanceof ErrorGeminiTemporal
      ) {
        ultimoError = error;

      } else {
        throw error instanceof Error
          ? error
          : new Error(String(error));
      }

      console.warn(
        `[GEMINI] Fallo temporal en ${modelo}: ` +
        ultimoError.message
      );

      if (intento < MAX_INTENTOS) {
        const esperaMs = 1200 * intento;

        console.log(
          `[GEMINI] Reintentando en ${esperaMs} ms...`
        );

        await esperar(esperaMs);
      }

    } finally {
      clearTimeout(timeout);
    }
  }

  throw ultimoError ||
    new ErrorGeminiTemporal(
      `No se pudo obtener respuesta de ${modelo}.`
    );
}

// ========================================
// CONSULTA CON MODELO DE RESPALDO
// ========================================

export async function consultarConRespaldo<T>(
  instrucciones: string,
  esquema: object
): Promise<T> {
  let ultimoError: Error | null = null;

  for (
    let i = 0;
    i < GEMINI_MODELS.length;
    i++
  ) {
    const modelo = GEMINI_MODELS[i];

    try {
      const resultado = await consultarGemini<T>(
        instrucciones,
        esquema,
        modelo
      );

      console.log(
        `[GEMINI] Respuesta correcta usando ${modelo}.`
      );

      return resultado;

    } catch (error: any) {
      ultimoError =
        error instanceof Error
          ? error
          : new Error(String(error));

      if (
        !(error instanceof ErrorGeminiTemporal)
      ) {
        throw error;
      }

      if (i < GEMINI_MODELS.length - 1) {
        console.warn(
          `[GEMINI] ${modelo} no está disponible. ` +
          `Activando modelo de respaldo: ` +
          `${GEMINI_MODELS[i + 1]}.`
        );
      }
    }
  }

  throw ultimoError ||
    new Error(
      "Ningún modelo de Gemini ha podido responder."
    );
}