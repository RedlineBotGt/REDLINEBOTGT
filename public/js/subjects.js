// ========================================
// ASIGNATURAS DE ACADEMIA CAMPOS
// ========================================

export const asignaturas = {
  cultura_general: "Cultura general",
  pensamiento_lateral: "Retos Imposibles",
  matematicas: "Matemáticas",
  geografia: "Geografía",
  english: "English",
  lengua: "Lengua",
  lenguaje_musical: "Lenguaje Musical"
};

// Clave antigua conservada como alias de Cultura general.
function normalizarAsignatura(asignatura) {
  return asignatura === "lateral"
    ? "cultura_general"
    : asignatura;
}

// ========================================
// ASIGNATURA ACTUAL
// ========================================

export let asignaturaActual = null;

// ========================================
// SELECCIONAR ASIGNATURA
// ========================================

export function seleccionarAsignatura(asignatura) {
  const clave = normalizarAsignatura(asignatura);

  if (!asignaturas[clave]) {
    console.warn(
      "[ACADEMIA] Asignatura desconocida:",
      asignatura
    );

    return false;
  }

  asignaturaActual = clave;

  const titulo = document.getElementById("challenge-title");

  if (titulo) {
    titulo.textContent = asignaturas[clave];
  }

  console.log(
    "[ACADEMIA] Asignatura seleccionada:",
    asignaturas[clave]
  );

  return true;
}

// ========================================
// CONSULTAR ASIGNATURA ACTUAL
// ========================================

export function obtenerAsignaturaActual() {
  return asignaturaActual;
}

// ========================================
// CERRAR ASIGNATURA
// ========================================

export function cerrarAsignatura() {
  asignaturaActual = null;
}
