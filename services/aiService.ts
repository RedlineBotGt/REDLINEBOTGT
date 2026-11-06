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
  evaluarRespuestaGeografia
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
  | "geografia";

export type {
  RetoGenerado,
  EvaluacionReto
};

// ========================================
// GENERAR RETO
// ========================================

export async function generarRetoIA(
  asignatura: AsignaturaReto,
  nivel: number = 1
): Promise<RetoGenerado> {
  switch (asignatura) {
    case "cultura_general":
    case "lateral":
      return generarRetoCulturaGeneral(nivel);

    case "pensamiento_lateral":
      return generarRetoPensamientoLateral(nivel);

    case "matematicas":
      return generarRetoMatematicas(nivel);

    case "geografia":
      return generarRetoGeografia(nivel);

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

    default:
      throw new Error(
        `Asignatura no reconocida: ${asignatura}`
      );
  }
}
