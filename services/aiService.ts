
import { GoogleGenAI } from "@google/genai";

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
    throw new Error("Gemini no está configurado");
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: `
      Eres un profesor experto en educación.

      Crea una pregunta educativa en español.

      Perfil: ${perfil}
      Asignatura: ${asignatura}
      Nivel: ${nivel}

      La pregunta debe adaptarse a la edad y conocimientos.
      La respuesta debe ser correcta y verificable.
      La explicación debe enseñar, no limitarse a decir
      si está bien o mal.
      La pista debe ayudar sin revelar la respuesta.

      Devuelve una pregunta original.
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
    throw new Error("Gemini no ha devuelto contenido");
  }

  const resultado = JSON.parse(response.text);

  return resultado as PreguntaGenerada;
}
