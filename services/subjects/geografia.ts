// ========================================
// GEOGRAFÍA
// Academia Campos
// ========================================

import { consultarConRespaldo } from "../ai/gemini.js";

import {
  ESQUEMA_RETO,
  ESQUEMA_EVALUACION,
  type RetoGenerado,
  type EvaluacionReto
} from "../ai/schemas.js";

// ========================================
// INSTRUCCIONES DE GEOGRAFÍA
// ========================================

function instruccionesGeografia(nivel: number): string {
  return `
Eres el profesor de Geografía de Academia Campos.

Crea UNA SOLA pregunta original de geografía adaptada
al nivel del alumno de Primaria.

NIVEL DEL ALUMNO: ${nivel}
Utiliza vocabulario claro, frases cortas y dificultad
progresiva, aproximadamente de 2.º-3.º de Primaria al inicio.

CONTENIDOS:
- Continentes y océanos.
- Países y capitales.
- Comunidades autónomas y provincias de España.
- Ríos, montañas y accidentes geográficos.
- Ciudades y regiones del mundo.
- Climas y paisajes.
- Mapas, puntos cardinales y orientación.
- Geografía física y humana.

CRITERIOS:
- Alterna España, Europa y el resto del mundo.
- Alterna tipos de contenido y evita repetir continuamente
  las mismas preguntas.
- Formula preguntas claras, concretas y sin ambigüedades.
- Utiliza información geográfica correcta y contrastable.
- No inventes países, capitales, ríos ni accidentes geográficos.
- Evita datos demasiado específicos o cambiantes.
- No conviertas la pregunta en un acertijo.
- No incluyas la respuesta en el enunciado.

Incluye:
- prompt: pregunta clara que verá el alumno.
- hint: pista breve que ayude sin revelar la respuesta.
- solution: respuesta correcta y explicación sencilla.
- category: tema concreto de geografía.

Devuelve exclusivamente el JSON solicitado.
`;
}

// ========================================
// GENERAR EJERCICIO
// ========================================

export async function generarRetoGeografia(
  nivel: number = 1
): Promise<RetoGenerado> {
  const reto = await consultarConRespaldo<RetoGenerado>(
    instruccionesGeografia(nivel),
    ESQUEMA_RETO
  );

  if (
    !reto.prompt?.trim() ||
    !reto.hint?.trim() ||
    !reto.solution?.trim() ||
    !reto.category?.trim()
  ) {
    throw new Error(
      "Gemini ha generado un ejercicio incompleto de Geografía."
    );
  }

  return reto;
}

// ========================================
// EVALUAR RESPUESTA
// ========================================

export async function evaluarRespuestaGeografia(
  pregunta: string,
  respuesta: string,
  solucion: string
): Promise<EvaluacionReto> {
  const instrucciones = `
Eres un profesor de Geografía de Academia Campos.

PREGUNTA:
${pregunta}

RESPUESTA CORRECTA:
${solucion}

RESPUESTA DEL ALUMNO:
${respuesta}

Evalúa si el alumno identifica correctamente el lugar,
concepto o dato geográfico preguntado.
Ten en cuenta el significado, no solo las palabras exactas.
Acepta respuestas equivalentes y errores ortográficos
menores si la respuesta es claramente correcta.
No aceptes respuestas que contradigan el dato correcto.

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
      "Gemini ha devuelto una evaluación incompleta de Geografía."
    );
  }

  return evaluacion;
}
