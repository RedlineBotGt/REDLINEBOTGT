
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
// Solo generación por ahora.
// Su evaluación todavía no está preparada.
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
