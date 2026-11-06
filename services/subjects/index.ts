// ========================================
// ÍNDICE DE ASIGNATURAS
// Academia Campos
// ========================================

// Cultura general
export {
  generarRetoCulturaGeneral,
  evaluarRespuestaCulturaGeneral
} from "./culturaGeneral.js";

// Detectives de la Mente
export {
  generarRetoPensamientoLateral,
  evaluarRespuestaPensamientoLateral
} from "./pensamientoLateral.js";

// Matemáticas
export {
  generarRetoMatematicas,
  evaluarRespuestaMatematicas
} from "./matematicas.js";

// Geografía
// Solo generación por ahora; permanece desactivada.
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
