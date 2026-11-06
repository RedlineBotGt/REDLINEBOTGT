// ========================================
// SERVICIO PRINCIPAL DE IA
// Academia Campos
// Fachada de compatibilidad
// ========================================

import {
  generarRetoCulturaGeneral,
  evaluarRespuestaCulturaGeneral,
  generarRetoMatematicas,
  generarRetoGeografia
} from "./subjects/index.js";

import type {
  RetoGenerado,
  EvaluacionReto
} from "./subjects/index.js";

// ========================================
// TIPOS
// ========================================

export type AsignaturaReto =
  | "lateral"
  | "matematicas"
  | "geografia";

// ========================================
// EXPORTAR TIPOS
// ========================================

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

    case "lateral":
      return generarRetoCulturaGeneral(nivel);

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

    case "lateral":
      return evaluarRespuestaCulturaGeneral(
        pregunta,
        respuesta,
        solucion
      );

    case "matematicas":
      throw new Error(
        "La evaluación de Matemáticas todavía no está preparada."
      );

    case "geografia":
      throw new Error(
        "La evaluación de Geografía todavía no está preparada."
      );

    default:
      throw new Error(
        `Asignatura no reconocida: ${asignatura}`
      );
  }
}