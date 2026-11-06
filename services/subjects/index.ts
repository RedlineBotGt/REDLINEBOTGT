// ========================================
// ÍNDICE DE ASIGNATURAS
// Academia Campos
// ========================================

// Cultura general
export {
  generarRetoCulturaGeneral,
  evaluarRespuestaCulturaGeneral
} from "./culturaGeneral.js";

// Matemáticas
export {
  generarRetoMatematicas
} from "./matematicas.js";

// Geografía
export {
  generarRetoGeografia
} from "./geografia.js";

// ========================================
// TIPOS COMPARTIDOS
// ========================================

export type {
  RetoGenerado,
  EvaluacionReto
} from "../ai/schemas.js";