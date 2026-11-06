// ========================================
// CULTURA GENERAL
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
// INSTRUCCIONES DE LA ASIGNATURA
// ========================================

function instruccionesCulturaGeneral(
  nivel: number
): string {
  return `
Eres el profesor de Cultura General de Academia Campos.

Tu tarea es crear un ejercicio original para el alumno.

NIVEL DEL EJERCICIO:
${nivel}

CONTENIDO:

El ejercicio puede tratar sobre:

- Pensamiento lateral.
- Razonamiento lógico.
- Curiosidades.
- Naturaleza y animales.
- Ciencia.
- Conocimientos generales.
- Resolución de pequeños problemas.

CARACTERÍSTICAS:

- El ejercicio debe hacer pensar al alumno.
- No debe ser excesivamente sencillo.
- Debe ser adecuado para un alumno de primaria.
- Debe tener una única solución clara y coherente.
- No repitas preguntas de forma sistemática.
- Evita preguntas de cultura general que dependan de datos
  demasiado específicos o difíciles de conocer.
- Alterna los tipos de ejercicios y los temas.
- Prioriza la creatividad, la comprensión y el razonamiento.

PISTA:

Incluye una pista breve que ayude a pensar sin revelar
directamente la solución.

SOLUCIÓN:

Explica cuál es la solución correcta y por qué.

RESPONDE EXCLUSIVAMENTE CON EL JSON SOLICITADO.
`;
}

// ========================================
// GENERAR RETO
// ========================================

export async function generarRetoCulturaGeneral(
  nivel: number = 1
): Promise<RetoGenerado> {
  const instrucciones =
    instruccionesCulturaGeneral(nivel);

  return consultarConRespaldo<RetoGenerado>(
    instrucciones,
    ESQUEMA_RETO
  );
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
Eres el profesor de Cultura General de Academia Campos.

Debes evaluar la respuesta de un alumno.

PREGUNTA:
${pregunta}

RESPUESTA DEL ALUMNO:
${respuesta}

SOLUCIÓN CORRECTA:
${solucion}

CRITERIOS:

- Comprueba si la respuesta demuestra que el alumno
  ha comprendido el ejercicio.
- Acepta respuestas equivalentes aunque estén expresadas
  con otras palabras.
- No exijas que la respuesta coincida literalmente.
- Si la respuesta es parcialmente correcta, valora
  si realmente resuelve lo que se pregunta.
- No marques como correcta una respuesta que contradiga
  claramente la solución.

DEVUELVE:

- correct: true si la respuesta es correcta.
- feedback: mensaje breve y cercano para el alumno.
- explanation: explicación clara de la solución.

Adapta el lenguaje a un alumno de primaria.

RESPONDE EXCLUSIVAMENTE CON EL JSON SOLICITADO.
`;

  return consultarConRespaldo<EvaluacionReto>(
    instrucciones,
    ESQUEMA_EVALUACION
  );
}