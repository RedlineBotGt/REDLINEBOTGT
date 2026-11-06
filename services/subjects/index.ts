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
  generarRetoMatematicas,
  evaluarRespuestaMatematicas
} from "./matematicas.js";

// Geografía
export {
  generarRetoGeografia
} from "./geografia.js";

// Tipos compartidos
export type {
  RetoGenerado,
  EvaluacionReto
} from "../ai/schemas.js";