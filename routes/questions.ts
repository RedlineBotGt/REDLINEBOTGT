
import { Router } from "express";
import { randomUUID } from "crypto";

import {
  generarRetoIA,
  evaluarRespuestaIA,
  type AsignaturaReto,
  type RetoGenerado
} from "../services/aiService.ts";
import {
  guardarRetoPendiente,
  obtenerRetoPendiente,
  eliminarRetoPendiente,
  limpiarRetosCaducados
} from "../services/pendingChallengeService.ts";

const router = Router();

type Perfil = "leo" | "papa" | "mama";

// Historial temporal independiente por perfil y asignatura.
const MAX_HISTORIAL_PREGUNTAS = 30;
const MAX_INTENTOS_PREGUNTA_NUEVA = 4;
const historialPreguntas = new Map<string, string[]>();

function claveHistorial(perfil: Perfil, asignatura: AsignaturaReto): string {
  return `${perfil}:${asignatura}`;
}

function normalizarPregunta(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function obtenerHistorial(
  perfil: Perfil,
  asignatura: AsignaturaReto
): string[] {
  return historialPreguntas.get(claveHistorial(perfil, asignatura)) || [];
}

function guardarPreguntaReciente(
  perfil: Perfil,
  asignatura: AsignaturaReto,
  pregunta: string
): void {
  const clave = claveHistorial(perfil, asignatura);
  const recientes = [...(historialPreguntas.get(clave) || [])];
  recientes.push(pregunta);

  while (recientes.length > MAX_HISTORIAL_PREGUNTAS) {
    recientes.shift();
  }

  historialPreguntas.set(clave, recientes);
}

function validarPerfil(valor: unknown): valor is Perfil {
  return (
    valor === "leo" ||
    valor === "papa" ||
    valor === "mama"
  );
}

/**
 * Asignaturas activas:
 * - cultura_general: Cultura general.
 * - pensamiento_lateral: Retos Imposibles.
 * - lateral: alias histórico de Cultura general.
 * geografia: Geografía.
 * english: English.
 */
function obtenerAsignatura(
  valor: unknown
): AsignaturaReto | null {
  const asignatura = String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

  if (
    asignatura === "cultura" ||
    asignatura === "cultura general" ||
    asignatura === "cultura_general" ||
    asignatura === "lateral"
  ) {
    return "cultura_general";
  }

  if (
    asignatura === "pensamiento lateral" ||
    asignatura === "pensamiento_lateral" ||
    asignatura === "detectives de la mente" ||
    asignatura === "detectives"
  ) {
    return "pensamiento_lateral";
  }

  if (asignatura === "matematicas") {
    return "matematicas";
  }

  if (asignatura === "geografia") {
    return "geografia";
  }

  if (asignatura === "english" || asignatura === "ingles") {
    return "english";
  }

  return null;
}

function nombreAsignatura(
  asignatura: AsignaturaReto
): string {
  switch (asignatura) {
    case "cultura_general":
    case "lateral":
      return "Cultura general";
    case "pensamiento_lateral":
      return "Retos Imposibles";
    case "matematicas":
      return "Matemáticas";
    case "geografia":
      return "Geografía";
    case "english":
      return "English";
  }
}

// ========================================
// GENERAR RETO
// ========================================

router.post("/question", async (req, res) => {
  const { perfil, asignatura } = req.body || {};

  console.log("[GEMINI] Solicitud de nuevo reto");
  console.log("[GEMINI] Perfil:", perfil);
  console.log("[GEMINI] Asignatura:", asignatura);

  if (!validarPerfil(perfil)) {
    return res.status(400).json({
      ok: false,
      error: "Perfil no válido."
    });
  }

  const materia = obtenerAsignatura(asignatura);

  if (!materia) {
    return res.status(400).json({
      ok: false,
      error: "Por ahora están disponibles Cultura general, Retos Imposibles, Matemáticas, Geografía y English."
    });
  }

  try {
    await limpiarRetosCaducados();

    // Todos comienzan desde el mismo nivel.
    // El progreso individual se añadirá después.
    const nivelInicial = 1;

    console.log(
      `[GEMINI] Generando ${nombreAsignatura(materia)} para ${perfil}...`
    );

    // Cada perfil y asignatura consulta únicamente su propio historial.
    let reto: RetoGenerado | null = null;

    for (
      let intento = 1;
      intento <= MAX_INTENTOS_PREGUNTA_NUEVA;
      intento++
    ) {
      const recientes = obtenerHistorial(perfil, materia);

      const candidato = await generarRetoIA(
        materia,
        nivelInicial,
        recientes
      );

      // Volvemos a leer el historial después de esperar a Gemini:
      // otra petición simultánea puede haber guardado ya esa pregunta.
      const historialActual = obtenerHistorial(perfil, materia);
      const claveCandidata = normalizarPregunta(candidato.prompt);
      const repetida = historialActual.some(
        anterior => normalizarPregunta(anterior) === claveCandidata
      );

      // Evita que dos peticiones simultáneas acepten el mismo enunciado.
      if (repetida) {
        console.warn(
          `[GEMINI] Pregunta repetida en ${materia} para ${perfil}. Reintento ${intento}/${MAX_INTENTOS_PREGUNTA_NUEVA}.`
        );
        continue;
      }

      reto = candidato;
      guardarPreguntaReciente(perfil, materia, candidato.prompt);
      break;
    }

    if (!reto) {
      throw new Error(
        "No se ha podido generar una pregunta nueva sin repetir las recientes. Inténtalo de nuevo."
      );
    }

    const id = randomUUID();

    await guardarRetoPendiente({ id, perfil, asignatura: materia, reto, creadoEn: Date.now() });

    console.log(
      `[GEMINI] Reto preparado para ${perfil}: ${reto.category}`
    );

    // La solución nunca sale del servidor.
    return res.json({
      ok: true,
      reto: {
        id,
        prompt: reto.prompt,
        hint: reto.hint,
        category: reto.category
      }
    });

  } catch (error) {
    console.error(
      "[GEMINI] Error al generar reto:",
      error
    );

    return res.status(502).json({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se ha podido generar el reto."
    });
  }
});

// ========================================
// EVALUAR RESPUESTA
// ========================================

router.post("/answer", async (req, res) => {
  const {
    perfil,
    asignatura,
    retoId,
    respuesta
  } = req.body || {};

  if (!validarPerfil(perfil)) {
    return res.status(400).json({
      ok: false,
      error: "Perfil no válido."
    });
  }

  const materia = obtenerAsignatura(asignatura);

  if (!materia) {
    return res.status(400).json({
      ok: false,
      error: "Asignatura no válida."
    });
  }

  if (
    typeof retoId !== "string" ||
    !retoId.trim() ||
    typeof respuesta !== "string" ||
    !respuesta.trim()
  ) {
    return res.status(400).json({
      ok: false,
      error: "Escribe una respuesta antes de comprobarla."
    });
  }

  if (respuesta.trim().length > 3000) {
    return res.status(400).json({
      ok: false,
      error: "La respuesta es demasiado larga."
    });
  }

  await limpiarRetosCaducados();

  const pendiente = await obtenerRetoPendiente(retoId);

  if (!pendiente) {
    return res.status(404).json({
      ok: false,
      error: "Este ejercicio ya no está disponible. Genera otro."
    });
  }

  if (
    pendiente.perfil !== perfil ||
    pendiente.asignatura !== materia
  ) {
    return res.status(403).json({
      ok: false,
      error: "Este ejercicio pertenece a otro perfil."
    });
  }

  try {
    console.log(
      `[GEMINI] Evaluando respuesta de ${perfil}...`
    );

    const evaluacion = await evaluarRespuestaIA(
      pendiente.reto.prompt,
      respuesta.trim(),
      pendiente.reto.solution,
      pendiente.asignatura
    );

    // Si acierta, el ejercicio deja de estar pendiente.
    // Si falla, puede volver a intentarlo.
    if (evaluacion.correct) {
      await eliminarRetoPendiente(retoId);
    }

    return res.json({
      ok: true,
      evaluacion
    });

  } catch (error) {
    console.error(
      "[GEMINI] Error al evaluar:",
      error
    );

    return res.status(502).json({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se ha podido evaluar la respuesta."
    });
  }
});

export default router;
