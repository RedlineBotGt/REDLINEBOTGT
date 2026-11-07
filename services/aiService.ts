// ========================================
// SERVICIO PRINCIPAL DE IA
// Academia Campos
// Fachada de compatibilidad
// ========================================

import {
  generarRetoCulturaGeneral,
  evaluarRespuestaCulturaGeneral,
  generarRetoPensamientoLateral,
  evaluarRespuestaPensamientoLateral,
  generarRetoMatematicas,
  evaluarRespuestaMatematicas,
  generarRetoGeografia,
  evaluarRespuestaGeografia,
  generarRetoEnglish,
  evaluarRespuestaEnglish
} from "./subjects/index.js";

import type {
  RetoGenerado,
  EvaluacionReto
} from "./subjects/index.js";

// ========================================
// TIPOS
// ========================================

export type AsignaturaReto =
  | "cultura_general"
  | "pensamiento_lateral"
  | "lateral"
  | "matematicas"
  | "geografia"
  | "english";

export type {
  RetoGenerado,
  EvaluacionReto
};

// ========================================
// GENERAR RETO
// ========================================

export async function generarRetoIA(
  asignatura: AsignaturaReto,
  nivel: number = 1,
  historialReciente: string[] = []
): Promise<RetoGenerado> {
  switch (asignatura) {
    case "cultura_general":
    case "lateral":
      return generarRetoCulturaGeneral(nivel, historialReciente);

    case "pensamiento_lateral":
      return generarRetoPensamientoLateral(nivel, historialReciente);

    case "matematicas":
      return generarRetoMatematicas(nivel, historialReciente);

    case "geografia":
      return generarRetoGeografia(nivel, historialReciente);

    case "english":
      return generarRetoEnglish(nivel, historialReciente);

    default:
      throw new Error(
        `Asignatura no reconocida: ${asignatura}`
      );
  }
}

// ========================================
// EVALUAR RESPUESTA
// ========================================

export async function evaluarRespuestaIA(
  pregunta: string,
  respuesta: string,
  solucion: string,
  asignatura: AsignaturaReto
): Promise<EvaluacionReto> {
  switch (asignatura) {
    case "cultura_general":
    case "lateral":
      return evaluarRespuestaCulturaGeneral(
        pregunta,
        respuesta,
        solucion
      );

    case "pensamiento_lateral":
      return evaluarRespuestaPensamientoLateral(
        pregunta,
        respuesta,
        solucion
      );

    case "matematicas":
      return evaluarRespuestaMatematicas(
        pregunta,
        respuesta,
        solucion
      );

    case "geografia":
      return evaluarRespuestaGeografia(
        pregunta,
        respuesta,
        solucion
      );

    case "english":
      return evaluarRespuestaEnglish(
        pregunta,
        respuesta,
        solucion
      );

    default:
      throw new Error(
        `Asignatura no reconocida: ${asignatura}`
      );
  }
}
