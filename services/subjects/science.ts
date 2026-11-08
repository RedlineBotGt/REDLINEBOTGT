// ========================================
// SCIENCE
// Academia Campos
// Natural sciences for Primary School
// ========================================

import { consultarConRespaldo } from "../ai/gemini.js";
import {
  ESQUEMA_RETO,
  ESQUEMA_EVALUACION,
  type RetoGenerado,
  type EvaluacionReto
} from "../ai/schemas.js";

function instruccionesScience(nivel: number, recientes: string[]): string {
  return `
You are a friendly Science teacher for Spanish-speaking Primary School pupils.
Create ONE original natural science activity.

PUPIL LEVEL: ${nivel}

RECENT QUESTIONS FROM THIS PROFILE AND SUBJECT (do not repeat):
${recientes.length ? recientes.map((p, i) => `${i + 1}. ${p}`).join("\n") : "None yet."}

TOPICS TO ALTERNATE:
- Living things: plants, animals, life cycles and habitats.
- The human body, senses, healthy habits and nutrition.
- Matter and materials: properties, states and simple changes.
- Water, air, weather and the water cycle.
- Earth, the Sun, Moon, planets and day/night.
- Forces, movement, light, sound and simple energy concepts.
- Ecosystems, food chains, biodiversity and caring for nature.
- Rocks, soil, landscapes and natural resources.

TEACHING RULES:
- Write the pupil-facing question in clear, simple English.
- Start around an accessible 2nd-3rd Primary level and adapt difficulty progressively.
- Use short sentences and familiar vocabulary. If an instruction may be difficult, add a very short Spanish clarification.
- Alternate topics and activity types: classification, true/false, fill-in, explain briefly, compare, or identify.
- Ask one clear question with an answer that can be evaluated fairly.
- Teach accurate, established science. Never invent facts.
- Avoid ambiguous questions and avoid repeating recent questions or the same fact in different words.
- Do not include the answer in the prompt.
- The hint must guide without revealing the answer.
- Write the solution and explanation briefly in Spanish, suitable for a child.
- Set category to the specific science topic.

Return only the requested JSON with prompt, hint, solution and category.
`;
}

export async function generarRetoScience(
  nivel: number = 1,
  recientes: string[] = []
): Promise<RetoGenerado> {
  const reto = await consultarConRespaldo<RetoGenerado>(
    instruccionesScience(nivel, recientes),
    ESQUEMA_RETO
  );

  if (!reto.prompt?.trim() || !reto.hint?.trim() ||
      !reto.solution?.trim() || !reto.category?.trim()) {
    throw new Error("Gemini has generated an incomplete Science exercise.");
  }

  return reto;
}

export async function evaluarRespuestaScience(
  pregunta: string,
  respuesta: string,
  solucion: string
): Promise<EvaluacionReto> {
  const instrucciones = `
You are a kind and fair Science teacher for Primary School pupils.

QUESTION:
${pregunta}

EXPECTED ANSWER AND CRITERIA:
${solucion}

PUPIL'S ANSWER:
${respuesta}

Evaluate scientific meaning, not exact wording.
Accept equivalent correct answers and minor spelling mistakes when spelling is not the skill being tested.
Do not accept answers that contradict established scientific facts or are incomplete when the question asks for a specific explanation.
Keep feedback and explanation in simple, brief Spanish so the pupil can understand what was right or what to improve.
Be encouraging without marking an incorrect answer as correct.

Return only JSON with correct (boolean), feedback and explanation (strings).
`;

  const evaluacion = await consultarConRespaldo<EvaluacionReto>(
    instrucciones,
    ESQUEMA_EVALUACION
  );

  if (typeof evaluacion.correct !== "boolean" ||
      !evaluacion.feedback?.trim() || !evaluacion.explanation?.trim()) {
    throw new Error("Gemini has returned an incomplete Science evaluation.");
  }

  return evaluacion;
}
