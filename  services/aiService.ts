import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

const ai = apiKey
  ? new GoogleGenAI({ apiKey })
  : null;

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

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: `
      Crea una pregunta educativa en español.

      Perfil: ${perfil}
      Asignatura: ${asignatura}
      Nivel: ${nivel}

      Debe ser adecuada al nivel indicado.
      La respuesta debe ser clara y verificable.
      Incluye una pista que ayude sin revelar la respuesta.
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
    throw new Error("Gemini no ha devuelto ninguna pregunta");
  }

  const pregunta = JSON.parse(response.text) as PreguntaGenerada;

  if (
    !pregunta.pregunta ||
    !pregunta.respuesta ||
    !pregunta.explicacion ||
    !pregunta.pista
  ) {
    throw new Error("La respuesta de Gemini está incompleta");
  }

  return pregunta;
}