// ========================================
// RETOS IMPOSIBLES
// Academia Campos
// Pensamiento lateral, lógica y enigmas
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

export async function generarRetoPensamientoLateral(
  nivel: number = 1
): Promise<RetoGenerado> {
  const instrucciones = `
Eres el creador de retos de Retos Imposibles
de Academia Campos.

Crea UN SOLO enigma original de pensamiento lateral,
razonamiento o lógica. El alumno debe investigar las
pistas, cuestionar una suposición o descubrir una
solución ingeniosa.

NIVEL: ${nivel}
Adapta el vocabulario y la dificultad a un niño de
2.º-3.º de Primaria, sin hacer el reto infantil o trivial.

REGLAS:
- El reto debe poder resolverse con la información dada.
- No dependas de conocimientos especializados.
- Evita acertijos famosos, preguntas tramposas y dobles sentidos
  difíciles de entender para un niño.
- No repitas el mismo planteamiento con nombres u objetos cambiados.
- La solución debe ser lógica y estar justificada.
- La pista debe orientar sin revelar la respuesta.
- El enunciado no debe incluir la solución.

Devuelve:
- prompt: enigma o situación que verá el alumno.
- hint: pista breve.
- solution: solución y razonamiento.
- category: tipo de reto.

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
      "Gemini ha generado un reto incompleto de Retos Imposibles."
    );
  }

  return reto;
}

// ========================================
// EVALUAR RESPUESTA
// ========================================

export async function evaluarRespuestaPensamientoLateral(
  pregunta: string,
  respuesta: string,
  solucion: string
): Promise<EvaluacionReto> {
  const instrucciones = `
Eres un profesor de Retos Imposibles.

ENIGMA:
${pregunta}

SOLUCIÓN RAZONADA:
${solucion}

RESPUESTA DEL ALUMNO:
${respuesta}

Valora el razonamiento y el sentido de la respuesta.
No exijas las mismas palabras que la solución.
Si el alumno propone una solución alternativa coherente
y compatible con todas las pistas, considérala correcta.
Si solo ha acertado por casualidad sin explicar nada,
valora si la respuesta demuestra que ha entendido el reto.

Devuelve:
- correct: true o false.
- feedback: mensaje breve, amable y motivador.
- explanation: explicación sencilla del razonamiento.

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
      "Gemini ha devuelto una evaluación incompleta de Retos Imposibles."
    );
  }

  return evaluacion;
}
