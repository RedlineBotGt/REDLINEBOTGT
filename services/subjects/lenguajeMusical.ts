// ========================================
// LENGUAJE MUSICAL
// Academia Campos
// ========================================

import { consultarConRespaldo } from "../ai/gemini.js";
import { ESQUEMA_RETO, ESQUEMA_EVALUACION, type RetoGenerado, type EvaluacionReto } from "../ai/schemas.js";

function instrucciones(nivel: number, recientes: string[]): string {
  return `
Eres profesor de Lenguaje Musical para Primaria. Crea UN ejercicio
original, musicalmente correcto y progresivo. NIVEL: ${nivel}
No repitas: ${recientes.length ? recientes.join(" | ") : "ninguno"}.

Alterna a lo largo de las sesiones:
- Sonido y silencio; duración, intensidad, altura y vibración.
- Instrumentos, familias y timbres.
- Pulso, tempo, figuras, silencios, compases y patrones rítmicos.
- Notas, pentagrama, clave de sol/fa, escalas e intervalos.
- Oído musical: comparar tonos, melodías, acordes y detectar cambios.
- Lectura, creación y composición.
- Estilos: clásica, ópera, jazz, rock, pop, flamenco, bandas sonoras
  y músicas del mundo.

No hagas siempre preguntas elementales. Alterna escucha, observación,
razonamiento, lectura musical, patrones y creatividad. Una actividad
principal por reto. Explica en español de forma clara y didáctica.

Cuando ayude, incluye audio con kind "tones" o "rhythm", label y notes.
Cada nota: frequency entre 80 y 1200 Hz, durationMs entre 100 y 1600,
gapMs entre 0 y 1000, waveform "sine" o "triangle". Para representar
silencio usa gapMs, nunca frecuencia 0. La secuencia debe corresponder
exactamente a lo preguntado. Son tonos electrónicos generados en el
navegador, no grabaciones de instrumentos reales.

Incluye visual si aporta valor, usando alt e items con emoji y count.
No fuerces imágenes en ejercicios donde no ayuden. La solución debe
explicar el concepto. La pista orienta sin revelar la respuesta.
Devuelve exclusivamente JSON con prompt, hint, solution, category
y opcionalmente audio y visual.
`;
}

export async function generarRetoLenguajeMusical(nivel = 1, recientes: string[] = []): Promise<RetoGenerado> {
  const reto = await consultarConRespaldo<RetoGenerado>(instrucciones(nivel, recientes), ESQUEMA_RETO);
  if (!reto.prompt?.trim() || !reto.hint?.trim() || !reto.solution?.trim() || !reto.category?.trim()) {
    throw new Error("Gemini ha generado un ejercicio incompleto de Lenguaje Musical.");
  }
  if (reto.audio) {
    if (!Array.isArray(reto.audio.notes) || !reto.audio.notes.length || reto.audio.notes.length > 16) {
      throw new Error("La secuencia de audio no es válida.");
    }
    reto.audio.notes = reto.audio.notes.map(n => ({
      frequency: Math.max(80, Math.min(1200, Number(n.frequency) || 440)),
      durationMs: Math.max(100, Math.min(1600, Math.floor(Number(n.durationMs) || 400))),
      gapMs: Math.max(0, Math.min(1000, Math.floor(Number(n.gapMs) || 0))),
      waveform: n.waveform === "triangle" ? "triangle" : "sine"
    }));
    if (reto.audio.kind !== "tones" && reto.audio.kind !== "rhythm") reto.audio.kind = "tones";
  }
  return reto;
}

export async function evaluarRespuestaLenguajeMusical(pregunta: string, respuesta: string, solucion: string): Promise<EvaluacionReto> {
  const instrucciones = `
Eres profesor de Lenguaje Musical para Primaria.
ACTIVIDAD: ${pregunta}
RESPUESTA ESPERADA Y CONCEPTO: ${solucion}
RESPUESTA DEL ALUMNO: ${respuesta}
Evalúa comprensión musical, no coincidencia literal. Acepta términos
equivalentes correctos. Contrasta con la secuencia sonora cuando aplique.
Feedback y explicación en español, breves, amables y didácticos.
Devuelve JSON con correct (boolean), feedback y explanation.
`;
  const evaluacion = await consultarConRespaldo<EvaluacionReto>(instrucciones, ESQUEMA_EVALUACION);
  if (typeof evaluacion.correct !== "boolean" || !evaluacion.feedback?.trim() || !evaluacion.explanation?.trim()) {
    throw new Error("Gemini ha devuelto una evaluación incompleta de Lenguaje Musical.");
  }
  return evaluacion;
}
