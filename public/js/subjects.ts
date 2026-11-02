// ========================================
// ASIGNATURAS DE ACADEMIA CAMPOS
// ========================================

export const asignaturas = {
  lateral: "Cultura general",
  matematicas: "Matemáticas",
  geografia: "Geografía"
};

// ========================================
// ASIGNATURA ACTUAL
// ========================================

export let asignaturaActual = null;

// ========================================
// SELECCIONAR ASIGNATURA
// ========================================

export function seleccionarAsignatura(asignatura) {
  if (!asignaturas[asignatura]) {
    console.warn(
      "[ACADEMIA] Asignatura desconocida:",
      asignatura
    );

    return false;
  }

  asignaturaActual = asignatura;

  const titulo = document.getElementById("challenge-title");

  if (titulo) {
    titulo.textContent = asignaturas[asignatura];
  }

  console.log(
    "[ACADEMIA] Asignatura seleccionada:",
    asignaturas[asignatura]
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