// ========================================
// LENGUA
// Academia Campos
// Lengua castellana para Primaria
// ========================================

import { consultarConRespaldo } from "../ai/gemini.js";
import {
  ESQUEMA_RETO,
  ESQUEMA_EVALUACION,
  type RetoGenerado,
  type EvaluacionReto
} from "../ai/schemas.js";

function instruccionesLengua(nivel: number, recientes: string[]): string {
  return `
Eres profesor de Lengua Castellana de Academia Campos.
Crea UN ejercicio original de Lengua para Primaria.

NIVEL DEL ALUMNO: ${nivel}

EJERCICIOS RECIENTES QUE NO DEBES REPETIR:
${recientes.length ? recientes.map((p, i) => `${i + 1}. ${p}`).join("\n") : "Ninguno."}

CONTENIDOS QUE DEBES ALTERNAR:
- Comprensión lectora: textos breves y preguntas sobre ellos.
- Ortografía: b/v, g/j, h, c/z/qu, ll/y, r/rr y palabras frecuentes.
- Acentuación: sílaba tónica, palabras agudas, llanas y esdrújulas.
- Separación de sílabas y clasificación por número de sílabas.
- Gramática: sustantivos, adjetivos, verbos, artículos y pronombres.
- Género, número y concordancia.
- Sujeto y predicado; identificar el verbo.
- Sinónimos, antónimos, familias de palabras y campos semánticos.
- Ordenar palabras para formar oraciones.
- Signos de puntuación, mayúsculas y tipos de oraciones.
- Vocabulario, definiciones y expresión escrita breve.

CRITERIOS:
- Ajusta el nivel progresivamente. Al inicio, aproximadamente 2.º-3.º de Primaria.
- Usa español de España, instrucciones claras y frases adecuadas a Primaria.
- Alterna tipos de actividad; no hagas siempre preguntas de definición.
- No repitas ejercicios recientes ni evalúes lo mismo con otras palabras.
- Formula una actividad concreta, con una respuesta o producción evaluable.
- En comprensión lectora, incluye en el enunciado el texto necesario.
- En ejercicios de escritura, indica claramente qué debe escribir y su extensión.
- Si se evalúa ortografía o gramática, aplica esa regla con rigor.
- En otros ejercicios, acepta formulaciones equivalentes y respuestas correctas.
- No incluyas la solución en el enunciado.

Devuelve:
- prompt: enunciado completo que verá el alumno.
- hint: pista breve que ayude sin revelar la solución.
- solution: respuesta esperada y explicación sencilla en español.
- category: contenido concreto trabajado.

Devuelve exclusivamente el JSON solicitado.
`;
}

export async function generarRetoLengua(
  nivel: number = 1,
  recientes: string[] = []
): Promise<RetoGenerado> {
  const reto = await consultarConRespaldo<RetoGenerado>(
    instruccionesLengua(nivel, recientes),
    ESQUEMA_RETO
  );

  if (!reto.prompt?.trim() || !reto.hint?.trim() ||
      !reto.solution?.trim() || !reto.category?.trim()) {
    throw new Error("Gemini ha generado un ejercicio incompleto de Lengua.");
  }

  return reto;
}

export async function evaluarRespuestaLengua(
  pregunta: string,
  respuesta: string,
  solucion: string
): Promise<EvaluacionReto> {
  const instrucciones = `
Eres profesor de Lengua Castellana de Primaria.

ACTIVIDAD:
${pregunta}

RESPUESTA ESPERADA Y CRITERIO:
${solucion}

RESPUESTA DEL ALUMNO:
${respuesta}

Evalúa exactamente lo que pide la actividad:
- En ortografía, acentuación, gramática y concordancia, exige la forma correcta.
- En comprensión lectora, comprueba que la respuesta se ajuste al texto.
- En sinónimos, antónimos y vocabulario, acepta alternativas válidas según el contexto.
- En expresión escrita, valora que cumpla la consigna, tenga sentido y use correctamente el contenido trabajado. No exijas coincidencia literal con el ejemplo.
- No marques como correcta una respuesta incompleta o que solo trate el mismo tema.
- No penalices pequeños errores que no sean el objetivo del ejercicio, salvo que impidan entenderlo.

El feedback y la explicación deben estar en español, ser breves, amables y educativos.
Si falla, indica qué debe corregir sin desanimar.

Devuelve exclusivamente JSON con correct (boolean), feedback y explanation (strings).
`;

  const evaluacion = await consultarConRespaldo<EvaluacionReto>(
    instrucciones,
    ESQUEMA_EVALUACION
  );

  if (typeof evaluacion.correct !== "boolean" ||
      !evaluacion.feedback?.trim() || !evaluacion.explanation?.trim()) {
    throw new Error("Gemini ha devuelto una evaluación incompleta de Lengua.");
  }

  return evaluacion;
}
