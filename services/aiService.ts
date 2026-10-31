
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const MODEL = "gemini-3.8-flash";

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export interface PreguntaGenerada {
  pregunta: string;
  respuesta: string;
  explicacion: string;
  pista: string;
}

export async function generarPregunta(
  perfil: string,
  asignatura: string,
  nivel: string
): Promise<PreguntaGenerada> {
  if (!ai) {
    throw new Error("GEMINI_API_KEY no está configurada");
  }

  console.log(`[IA] Solicitando pregunta a ${MODEL}`);

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `
      Eres un profesor experto y cercano.

      Genera una pregunta educativa original en español.

      Perfil: ${perfil}
      Asignatura: ${asignatura}
      Nivel: ${nivel}

      Requisitos:
      - Adapta la dificultad al nivel indicado.
      - Haz una sola pregunta clara.
      - Incluye una respuesta correcta y verificable.
      - Explica brevemente por qué es correcta.
      - Añade una pista que no revele la respuesta.
      - No inventes datos.
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          pregunta: { type: "STRING" },
          respuesta: { type: "STRING" },
          explicacion: { type: "STRING" },
          pista: { type: "STRING" }
        },
        required: [
          "pregunta",
          "respuesta",
          "explicacion",
          "pista"
        ]
      }
    }
  });

  if (!response.text) {
    throw new Error("Gemini devolvió una respuesta vacía");
  }

  const resultado = JSON.parse(response.text) as PreguntaGenerada;

  if (
    !resultado.pregunta?.trim() ||
    !resultado.respuesta?.trim() ||
    !resultado.explicacion?.trim() ||
    !resultado.pista?.trim()
  ) {
    throw new Error("Gemini devolvió una pregunta incompleta");
  }

  console.log("[IA] Pregunta generada correctamente");

  return resultado;
}
