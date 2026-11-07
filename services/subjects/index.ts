// ========================================
// ÍNDICE DE ASIGNATURAS
// Academia Campos
// ========================================

// Cultura general
export {
  generarRetoCulturaGeneral,
  evaluarRespuestaCulturaGeneral
} from "./culturaGeneral.js";

// Retos Imposibles
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
// Generación y evaluación de Geografía.
export {
  generarRetoGeografia,
  evaluarRespuestaGeografia
} from "./geografia.js";

// English
export {
  generarRetoEnglish,
  evaluarRespuestaEnglish
} from "./english.js";

// Lengua
export {
  generarRetoLengua,
  evaluarRespuestaLengua
} from "./lengua.js";

// ========================================
// TIPOS COMPARTIDOS
// ========================================

export type {
  RetoGenerado,
  EvaluacionReto
} from "../ai/schemas.js";

// Lenguaje Musical
export {
  generarRetoLenguajeMusical,
  evaluarRespuestaLenguajeMusical
} from "./lenguajeMusical.js";
