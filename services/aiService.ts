
import { GoogleGenAI, Type } from "@google/genai";

const MODEL = "gemini-3.8-flash";

const apiKey = process.env.GEMINI_API_KEY;
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
    throw new Error("Falta configurar GEMINI_API_KEY");
  }

  console.log(`[GEMINI] Modelo: ${MODEL}`);
  console.log(`[GEMINI] Generando pregunta de ${asignatura}`);

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `
      Eres un profesor experto en educación.

      Genera una pregunta educativa original en español.

      Perfil: ${perfil}
      Asignatura: ${asignatura}
      Nivel: ${nivel}

      La pregunta debe adaptarse al nivel indicado.
      Debe tener una respuesta correcta y verificable.
      La explicación debe enseñar.
      La pista debe ayudar sin revelar la respuesta.
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          pregunta: { type: Type.STRING },
          respuesta: { type: Type.STRING },
          explicacion: { type: Type.STRING },
          pista: { type: Type.STRING }
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
    throw new Error("Gemini ha devuelto una respuesta vacía");
  }

  let resultado: PreguntaGenerada;

  try {
    resultado = JSON.parse(response.text);
  } catch {
    throw new Error("Gemini ha devuelto un JSON no válido");
  }

  if (
    !resultado.pregunta?.trim() ||
    !resultado.respuesta?.trim() ||
    !resultado.explicacion?.trim() ||
    !resultado.pista?.trim()
  ) {
    throw new Error("La pregunta generada está incompleta");
  }

  console.log("[GEMINI] Pregunta generada correctamente");

  return resultado;
}
