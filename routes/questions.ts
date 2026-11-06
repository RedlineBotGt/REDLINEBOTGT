
import { Router } from "express";
import { randomUUID } from "crypto";

import {
  generarRetoIA,
  evaluarRespuestaIA,
  type AsignaturaReto,
  type RetoGenerado
} from "../services/aiService.ts";

const router = Router();

type Perfil = "leo" | "papa" | "mama";

interface RetoPendiente {
  id: string;
  perfil: Perfil;
  asignatura: AsignaturaReto;
  reto: RetoGenerado;
  creadoEn: number;
}

const retosPendientes = new Map<string, RetoPendiente>();

const DURACION_RETO_MS = 2 * 60 * 60 * 1000;
const MAX_RETOS_PENDIENTES = 500;

function validarPerfil(valor: unknown): valor is Perfil {
  return (
    valor === "leo" ||
    valor === "papa" ||
    valor === "mama"
  );
}

/**
 * En esta primera fase solo está activa Cultura general.
 * Internamente conserva la clave "lateral".
 */
function obtenerAsignatura(
  valor: unknown
): AsignaturaReto | null {
  const asignatura = String(valor || "")
    .trim()
    .toLowerCase();

  if (
    asignatura === "cultura" ||
    asignatura === "cultura general" ||
    asignatura === "lateral"
  ) {
    return "lateral";
  }

  return null;
}

function limpiarRetosCaducados(): void {
  const ahora = Date.now();

  for (const [id, reto] of retosPendientes.entries()) {
    if (ahora - reto.creadoEn > DURACION_RETO_MS) {
      retosPendientes.delete(id);
    }
  }

  while (retosPendientes.size > MAX_RETOS_PENDIENTES) {
    const primerId = retosPendientes.keys().next().value;

    if (!primerId) break;

    retosPendientes.delete(primerId);
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
      error: "Por ahora solo está disponible Cultura general."
    });
  }

  try {
    limpiarRetosCaducados();

    // Todos comienzan desde el mismo nivel.
    // El progreso individual se añadirá después.
    const nivelInicial = 1;

    console.log(
      `[GEMINI] Generando Cultura general para ${perfil}...`
    );

    // La firma actual de aiService recibe primero
    // la asignatura y después el nivel.
    const reto = await generarRetoIA(
      materia,
      nivelInicial
    );

    const id = randomUUID();

    retosPendientes.set(id, {
      id,
      perfil,
      asignatura: materia,
      reto,
      creadoEn: Date.now()
    });

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

  limpiarRetosCaducados();

  const pendiente = retosPendientes.get(retoId);

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
      retosPendientes.delete(retoId);
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
