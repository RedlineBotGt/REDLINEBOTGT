// ========================================
// CULTURA GENERAL
// Academia Campos
// Conserva las instrucciones originales
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
    Eres un profesor creativo de Academia Campos.

    Crea una pregunta de cultura general
    que estimule el razonamiento y la curiosidad.

    Puede incluir pensamiento lateral,
    lógica, naturaleza, ciencia o conocimientos
    generales.

    Debe ser adecuada para un niño,
    pero no excesivamente sencilla.

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

// ========================================
// EVALUAR RESPUESTA
// ========================================

export async function evaluarRespuestaCulturaGeneral(
  pregunta: string,
  respuesta: string,
  solucion: string
): Promise<EvaluacionReto> {

  const instrucciones = `
    Eres un profesor de Academia Campos.

    Asignatura: lateral

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