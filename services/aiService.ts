const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite"
] as const;

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

const TIMEOUT_MS = 20000;
const MAX_INTENTOS = 2;

export type AsignaturaReto =
  | "lateral"
  | "matematicas"
  | "geografia";

export interface RetoGenerado {
  prompt: string;
  hint: string;
  solution: string;
  category: string;
}

export interface EvaluacionReto {
  correct: boolean;
  feedback: string;
  explanation: string;
}

class ErrorGeminiTemporal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErrorGeminiTemporal";
  }
}

const ESQUEMA_RETO = {
  type: "object",
  properties: {
    prompt: { type: "string" },
    hint: { type: "string" },
    solution: { type: "string" },
    category: { type: "string" }
  },
  required: [
    "prompt",
    "hint",
    "solution",
    "category"
  ]
};

const ESQUEMA_EVALUACION = {
  type: "object",
  properties: {
    correct: { type: "boolean" },
    feedback: { type: "string" },
    explanation: { type: "string" }
  },
  required: [
    "correct",
    "feedback",
    "explanation"
  ]
};

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

        if (texto) return texto;
      }
    }
  }

  throw new Error(
    "Gemini no ha devuelto un contenido válido."
  );
}

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
        const espera = 1200 * intento;

        console.log(
          `[GEMINI] Reintentando en ${espera} ms...`
        );

        await esperar(espera);
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

async function consultarConRespaldo<T>(
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

function instruccionesAsignatura(
  asignatura: AsignaturaReto
): string {
  switch (asignatura) {
    case "matematicas":
      return `
        Crea un ejercicio de matemáticas apropiado
        para un alumno de nivel inicial.
        Debe tener una respuesta clara y comprobable.
      `;

    case "geografia":
      return `
        Crea una pregunta de geografía apropiada
        para un alumno de nivel inicial.
        Utiliza información geográfica correcta.
      `;

    case "lateral":
    default:
      return `
        Crea una pregunta de cultura general
        que estimule el razonamiento y la curiosidad.
        Puede incluir pensamiento lateral,
        lógica, naturaleza, ciencia o conocimientos
        generales.
        Debe ser adecuada para un niño,
        pero no excesivamente sencilla.
      `;
  }
}

export async function generarRetoIA(
  asignatura: AsignaturaReto,
  nivel: number = 1
): Promise<RetoGenerado> {
  const instrucciones = `
    Eres un profesor creativo de Academia Campos.

    ${instruccionesAsignatura(asignatura)}

    Nivel del alumno: ${nivel}.

    Genera UN SOLO ejercicio nuevo.
    No repitas preguntas típicas ni ejemplos conocidos.
    La pregunta debe ser clara y comprensible.

    Incluye:
    - prompt: enunciado que verá el alumno.
    - hint: pista breve que ayude sin revelar la respuesta.
    - solution: solución correcta y explicación breve.
    - category: categoría del ejercicio.

    No incluyas la solución dentro del enunciado.
    Devuelve exclusivamente el JSON solicitado.
  `;

  const reto =
    await consultarConRespaldo<RetoGenerado>(
      instrucciones,
      ESQUEMA_RETO
    );

  if (
    !reto.prompt?.trim() ||
    !reto.hint?.trim() ||
    !reto.solution?.trim() ||
    !reto.category?.trim()
  ) {
    throw new Error(
      "Gemini ha generado un ejercicio incompleto."
    );
  }

  return reto;
}

export async function evaluarRespuestaIA(
  pregunta: string,
  respuesta: string,
  solucion: string,
  asignatura: AsignaturaReto
): Promise<EvaluacionReto> {
  const instrucciones = `
    Eres un profesor de Academia Campos.

    Asignatura: ${asignatura}

    Pregunta:
    ${pregunta}

    Respuesta correcta:
    ${solucion}

    Respuesta del alumno:
    ${respuesta}

    Evalúa la respuesta teniendo en cuenta
    su significado, no solamente las palabras exactas.

    Si la respuesta expresa correctamente la idea,
    aunque esté escrita de otra manera,
    considérala correcta.

    Devuelve:
    - correct: true o false.
    - feedback: mensaje breve y amable para el alumno.
    - explanation: explicación sencilla de la solución.

    Sé justo y educativo.
    Devuelve exclusivamente el JSON solicitado.
  `;

  const evaluacion =
    await consultarConRespaldo<EvaluacionReto>(
      instrucciones,
      ESQUEMA_EVALUACION
    );

  if (
    typeof evaluacion.correct !== "boolean" ||
    !evaluacion.feedback?.trim() ||
    !evaluacion.explanation?.trim()
  ) {
    throw new Error(
      "Gemini ha devuelto una evaluación incompleta."
    );
  }

  return evaluacion;
}