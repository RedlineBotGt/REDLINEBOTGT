
import { GoogleGenAI, Type } from "@google/genai";

export interface PreguntaGenerada {
  pregunta: string;
  respuesta: string;
  explicacion: string;
  pista: string;
}

const MODELO = "gemini-3.8-flash";

function validarTexto(
  valor: string,
  nombre: string
): string {
  const texto = String(valor || "").trim();

  if (!texto) {
    throw new Error(`El campo ${nombre} está vacío`);
  }

  if (texto.length > 100) {
    throw new Error(`El campo ${nombre} es demasiado largo`);
  }

  return texto;
}

function validarPregunta(datos: any): PreguntaGenerada {
  if (!datos || typeof datos !== "object") {
    throw new Error("Gemini devolvió datos no válidos");
  }

  const pregunta = validarTexto(datos.pregunta, "pregunta");
  const respuesta = validarTexto(datos.respuesta, "respuesta");
  const explicacion = validarTexto(datos.explicacion, "explicación");
  const pista = validarTexto(datos.pista, "pista");

  return {
    pregunta,
    respuesta,
    explicacion,
    pista
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

  const perfilSeguro = validarTexto(perfil, "perfil");
  const asignaturaSegura = validarTexto(asignatura, "asignatura");
  const nivelSeguro = validarTexto(nivel, "nivel");

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
Eres el profesor de una academia familiar llamada Academia Campos.

Genera UNA pregunta educativa en español.

Datos del alumno:
- Perfil: ${perfilSeguro}
- Asignatura: ${asignaturaSegura}
- Nivel: ${nivelSeguro}

Requisitos:
- Adapta la dificultad al nivel indicado.
- La pregunta debe ser clara y tener una única respuesta correcta.
- No incluyas la respuesta dentro del enunciado.
- La explicación debe ayudar a aprender.
- La pista debe orientar sin revelar la respuesta.
- Evita preguntas ambiguas o demasiado abiertas.
- Utiliza un lenguaje adecuado para la edad y el nivel.
- No añadas saludos ni texto fuera de los campos solicitados.

Devuelve exclusivamente los cuatro campos solicitados.
`;

  try {
    console.log("[GEMINI] Solicitando pregunta...");

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

    let datos: unknown;

    try {
      datos = JSON.parse(texto);
    } catch {
      throw new Error("Gemini devolvió un JSON no válido");
    }

    const pregunta = validarPregunta(datos);

    console.log("[GEMINI] Pregunta generada correctamente");

    return pregunta;

  } catch (error) {
    console.error("[GEMINI] Error al generar pregunta:", error);

    throw new Error("No se pudo generar la pregunta");
  }
}
