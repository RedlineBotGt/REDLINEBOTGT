
import { Router } from "express";

import {
  generarRetoIA,
  evaluarRespuestaIA,
  type AsignaturaReto
} from "../services/aiService.ts";

const router = Router();

type Perfil = "leo" | "papa" | "mama";

function validarPerfil(valor: unknown): valor is Perfil {
  return (
    valor === "leo" ||
    valor === "papa" ||
    valor === "mama"
  );
}

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
    return "cultura";
  }

  if (
    asignatura === "matematicas" ||
    asignatura === "matemáticas"
  ) {
    return "matematicas";
  }

  if (asignatura === "geografia" || asignatura === "geografía") {
    return "geografia";
  }

  return null;
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
      error: "Asignatura no válida."
    });
  }

  // Todos los perfiles comienzan desde el mismo nivel.
  // El progreso individual se conectará posteriormente.
  const nivelInicial = 1;

  try {
    console.log("[GEMINI] Generando reto de Cultura general...");

    const reto = await generarRetoIA(
      nivelInicial,
      [],
      materia
    );

    console.log("[GEMINI] Reto generado:", reto.category);

    // Adaptamos el formato para que el frontend actual
    // pueda recibir el reto sin romper su estructura.
    return res.json({
      ok: true,
      pregunta: {
        pregunta: reto.prompt,
        respuesta: reto.solution,
        explicacion: reto.solution,
        pista: reto.hint,
        categoria: reto.category
      },
      reto
    });

  } catch (error) {
    console.error("[GEMINI] Error al generar reto:", error);

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
    pregunta,
    respuesta,
    solucion
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
    typeof pregunta !== "string" ||
    typeof respuesta !== "string" ||
    typeof solucion !== "string" ||
    !pregunta.trim() ||
    !respuesta.trim() ||
    !solucion.trim()
  ) {
    return res.status(400).json({
      ok: false,
      error: "Faltan datos para evaluar la respuesta."
    });
  }

  try {
    console.log("[GEMINI] Evaluando respuesta:", perfil);

    const evaluacion = await evaluarRespuestaIA(
      pregunta,
      respuesta,
      solucion,
      materia
    );

    return res.json({
      ok: true,
      evaluacion
    });

  } catch (error) {
    console.error("[GEMINI] Error al evaluar:", error);

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
