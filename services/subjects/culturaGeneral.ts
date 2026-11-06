// ========================================
// CULTURA GENERAL
// Academia Campos
// Conocimientos de España, Europa y el mundo
// ========================================

import { consultarConRespaldo } from "../ai/gemini.js";

import {
  ESQUEMA_RETO,
  ESQUEMA_EVALUACION,
  type RetoGenerado,
  type EvaluacionReto
} from "../ai/schemas.js";

// ========================================
// GENERAR RETO
// ========================================

export async function generarRetoCulturaGeneral(
  nivel: number = 1
): Promise<RetoGenerado> {
  const instrucciones = `
Eres un profesor de Cultura General de Academia Campos.

Crea UNA SOLA pregunta nueva de conocimientos generales
para un alumno de Primaria.

NIVEL DEL ALUMNO: ${nivel}
El nivel objetivo inicial equivale aproximadamente a
2.º-3.º de Primaria. Utiliza vocabulario claro, frases
cortas y contenidos adecuados a esa edad.

TEMAS:
- Cultura, historia y tradiciones de España.
- Comunidades, monumentos, personajes y hechos relevantes
  de la historia y cultura española.
- Países, capitales, monumentos y cultura de Europa.
- Continentes, países, culturas y conocimientos del mundo.
- Ciencia, naturaleza y descubrimientos importantes.
- Arte, literatura, música y curiosidades culturales.

CRITERIOS:
- La pregunta debe enseñar un dato o concepto real.
- Alterna España, Europa y mundo; no te centres siempre
  en el mismo tema.
- Evita preguntas ambiguas o que admitan varias respuestas
  sin especificar qué se está preguntando.
- No inventes hechos, fechas, lugares ni personajes.
- No conviertas la pregunta en un acertijo de pensamiento lateral.
- Ajusta la dificultad al nivel indicado.
- Genera un ejercicio nuevo, no una pregunta típica repetida.

Incluye:
- prompt: pregunta clara que verá el alumno.
- hint: pista breve que ayude sin revelar la respuesta.
- solution: respuesta correcta y explicación sencilla.
- category: tema concreto de la pregunta.

No incluyas la solución en el enunciado.
Devuelve exclusivamente el JSON solicitado.
`;

  const reto = await consultarConRespaldo<RetoGenerado>(
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
      "Gemini ha generado un ejercicio incompleto de Cultura general."
    );
  }

  return reto;
}

// ========================================
// EVALUAR RESPUESTA
// ========================================

export async function evaluarRespuestaCulturaGeneral(
  pregunta: string,
  respuesta: string,
  solucion: string
): Promise<EvaluacionReto> {
  const instrucciones = `
Eres un profesor de Cultura General de Academia Campos.

PREGUNTA:
${pregunta}

RESPUESTA CORRECTA:
${solucion}

RESPUESTA DEL ALUMNO:
${respuesta}

Evalúa si el alumno conoce el dato o concepto preguntado.
Ten en cuenta el significado, no solo las palabras exactas.
Acepta respuestas equivalentes y errores ortográficos
menores si la respuesta es claramente correcta.
No aceptes una respuesta que contradiga el dato correcto.

Devuelve:
- correct: true o false.
- feedback: mensaje breve y amable para el alumno.
- explanation: explicación sencilla que refuerce el aprendizaje.

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
      "Gemini ha devuelto una evaluación incompleta de Cultura general."
    );
  }

  return evaluacion;
}
