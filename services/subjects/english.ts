// ========================================
// ENGLISH
// Academia Campos
// Aprendizaje progresivo de inglés
// ========================================

import { consultarConRespaldo } from "../ai/gemini.js";
import {
  ESQUEMA_RETO,
  ESQUEMA_EVALUACION,
  type RetoGenerado,
  type EvaluacionReto
} from "../ai/schemas.js";

function crearInstrucciones(
  nivel: number,
  recientes: string[]
): string {
  return `
Eres profesor de inglés para alumnos hispanohablantes de Primaria.
Crea UN ejercicio original, adecuado al nivel indicado.

NIVEL: ${nivel}

EJERCICIOS RECIENTES QUE NO DEBES REPETIR:
${recientes.length ? recientes.map((p, i) => `${i + 1}. ${p}`).join("\n") : "Ninguno."}

Aprendizaje progresivo, comenzando con inglés sencillo:
- Saludos y presentaciones.
- Números, colores, formas y tamaños.
- Familia, cuerpo y emociones.
- Animales, comida, ropa y objetos cotidianos.
- Colegio, casa, habitaciones y lugares.
- Días, meses, tiempo atmosférico y estaciones.
- Frases de la vida diaria.
- Verb to be, have got, can/can't, there is/there are.
- Artículos, plurales, pronombres y preposiciones sencillas.
- Comprensión de frases y textos breves.

Alterna vocabulario, completar frases, ordenar palabras,
traducciones sencillas y comprensión lectora. No hagas siempre
el mismo tipo de ejercicio.

El enunciado para el alumno debe estar principalmente en inglés
sencillo. Si la instrucción puede ser difícil, añade una aclaración
breve en español. La pista debe ayudar sin revelar la solución.
La solución debe incluir la respuesta correcta y una explicación
breve en español. Indica en category el contenido trabajado.

La respuesta debe ser concreta, inequívoca y gramaticalmente correcta.
No incluyas la solución en el enunciado ni uses vocabulario complejo
para el nivel. Si hay varias respuestas válidas, indícalas en solution.

Devuelve exclusivamente el JSON solicitado.
`;
}

export async function generarRetoEnglish(
  nivel: number = 1,
  recientes: string[] = []
): Promise<RetoGenerado> {
  const reto = await consultarConRespaldo<RetoGenerado>(
    crearInstrucciones(nivel, recientes),
    ESQUEMA_RETO
  );

  if (
    !reto.prompt?.trim() ||
    !reto.hint?.trim() ||
    !reto.solution?.trim() ||
    !reto.category?.trim()
  ) {
    throw new Error("Gemini ha generado un ejercicio incompleto de English.");
  }

  return reto;
}

export async function evaluarRespuestaEnglish(
  pregunta: string,
  respuesta: string,
  solucion: string
): Promise<EvaluacionReto> {
  const instrucciones = `
Eres profesor de inglés para alumnos hispanohablantes de Primaria.
Evalúa la respuesta con criterio educativo y amable.

EJERCICIO:
${pregunta}

SOLUCIÓN Y CRITERIO:
${solucion}

RESPUESTA DEL ALUMNO:
${respuesta}

Acepta respuestas equivalentes correctas, traducciones naturales
y errores ortográficos menores cuando no se evalúe la ortografía.
No aceptes errores gramaticales importantes cuando esa estructura
sea precisamente lo que se está practicando. No des por válida una
respuesta que solo se aproxime al tema.

El feedback y la explicación deben estar en español, ser breves
y ayudar a aprender. Si es incorrecta, explica de forma sencilla
qué debe corregir. Incluye un ejemplo cuando resulte útil.

Devuelve exclusivamente JSON con correct (boolean), feedback
y explanation (strings).
`;

  const evaluacion = await consultarConRespaldo<EvaluacionReto>(
    instrucciones,
    ESQUEMA_EVALUACION
  );

  if (
    typeof evaluacion.correct !== "boolean" ||
    !evaluacion.feedback?.trim() ||
    !evaluacion.explanation?.trim()
  ) {
    throw new Error("Gemini ha devuelto una evaluación incompleta de English.");
  }

  return evaluacion;
}
