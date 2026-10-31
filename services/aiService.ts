
import { GoogleGenAI, Type } from "@google/genai";

export interface PreguntaGenerada {
  pregunta: string;
  respuesta: string;
  explicacion: string;
  pista: string;
}

const MODELO = "gemini-3.8-flash";

function validarPregunta(datos: any): PreguntaGenerada {
  if (
    !datos ||
    typeof datos.pregunta !== "string" ||
    typeof datos.respuesta !== "string" ||
    typeof datos.explicacion !== "string" ||
    typeof datos.pista !== "string"
  ) {
    throw new Error("Gemini devolvió una pregunta incompleta");
  }

  return {
    pregunta: datos.pregunta.trim(),
    respuesta: datos.respuesta.trim(),
    explicacion: datos.explicacion.trim(),
    pista: datos.pista.trim()
  };
}

export async function generarPregunta(
  perfil: string,
  asignatura: string,
  nivel: string
): Promise<PreguntaGenerada> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Falta configurar GEMINI_API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
Eres el profesor de una academia familiar llamada Academia Campos.

Genera UNA pregunta educativa en español.

Datos del alumno:
- Perfil: ${perfil}
- Asignatura: ${asignatura}
- Nivel: ${nivel}

Requisitos:
- Adapta la dificultad al nivel indicado.
- La pregunta debe ser clara y tener una única respuesta correcta.
- No incluyas la respuesta dentro del enunciado.
- La explicación debe ayudar a aprender.
- La pista debe orientar sin revelar la respuesta.
- Evita preguntas ambiguas o demasiado abiertas.

Devuelve exclusivamente los cuatro campos solicitados.
`;

  try {
    const resultado = await ai.models.generateContent({
      model: MODELO,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            pregunta: {
              type: Type.STRING
            },
            respuesta: {
              type: Type.STRING
            },
            explicacion: {
              type: Type.STRING
            },
            pista: {
              type: Type.STRING
            }
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

    const texto = resultado.text;

    if (!texto) {
      throw new Error("Gemini devolvió una respuesta vacía");
    }

    const datos = JSON.parse(texto);
    const pregunta = validarPregunta(datos);

    console.log("[GEMINI] Pregunta creada correctamente");

    return pregunta;

  } catch (error) {
    console.error("[GEMINI] Fallo al generar pregunta:", error);
    throw new Error("No se pudo generar la pregunta");
  }
}
