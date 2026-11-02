
 // ========================================
 // RANKING DE ACADEMIA CAMPOS
 // ========================================

export const tiposRanking = {
  general: {
    nombre: "Ranking general",
    descripcion: "Clasificación global de Academia"
  },

  asignaturas: {
    nombre: "Por asignaturas",
    descripcion: "Clasificaciones independientes"
  }
};

// ========================================
// ASIGNATURAS DEL RANKING
// ========================================

export const asignaturasRanking = {
  lateral: "Cultura general",
  matematicas: "Matemáticas",
  geografia: "Geografía"
};

// ========================================
// ESTADO DEL RANKING
// ========================================

let tipoRankingActual = "general";
let asignaturaRankingActual = "lateral";

// ========================================
// SELECCIONAR TIPO DE RANKING
// ========================================

export function seleccionarTipoRanking(tipo) {
  if (!tiposRanking[tipo]) {
    console.warn("[RANKING] Tipo desconocido:", tipo);
    return false;
  }

  tipoRankingActual = tipo;

  return true;
}

// ========================================
// SELECCIONAR ASIGNATURA
// ========================================

export function seleccionarAsignaturaRanking(asignatura) {
  if (!asignaturasRanking[asignatura]) {
    console.warn(
      "[RANKING] Asignatura desconocida:",
      asignatura
    );

    return false;
  }

  asignaturaRankingActual = asignatura;

  return true;
}

// ========================================
// CONSULTAR SELECCIÓN ACTUAL
// ========================================

export function obtenerSeleccionRanking() {
  return {
    tipo: tipoRankingActual,
    asignatura: asignaturaRankingActual
  };
}

// ========================================
// MOSTRAR CLASIFICACIÓN
// ========================================

export function mostrarRanking(contenedorId, participantes) {
  const contenedor = document.getElementById(contenedorId);

  if (!contenedor) {
    console.warn(
      "[RANKING] No existe el contenedor:",
      contenedorId
    );

    return;
  }

  if (!Array.isArray(participantes) || participantes.length === 0) {
    contenedor.textContent = "Todavía no hay resultados disponibles.";
    return;
  }

  const ordenados = [...participantes].sort(
    (a, b) => Number(b.puntos) - Number(a.puntos)
  );

  const lista = document.createElement("ol");

  lista.className = "ranking-list";

  ordenados.forEach((participante, indice) => {
    const elemento = document.createElement("li");

    elemento.className = "ranking-item";

    const posicion = document.createElement("span");
    posicion.className = "ranking-position";
    posicion.textContent = `${indice + 1}.`;

    const nombre = document.createElement("span");
    nombre.className = "ranking-name";
    nombre.textContent = participante.nombre || "Participante";

    const puntos = document.createElement("span");
    puntos.className = "ranking-points";
    puntos.textContent = `${Number(participante.puntos) || 0} puntos`;

    elemento.append(posicion, nombre, puntos);
    lista.appendChild(elemento);
  });

  contenedor.replaceChildren(lista);
}

// ========================================
// INICIALIZACIÓN
// ========================================

export function iniciarRanking() {
  console.log("[RANKING] Módulo preparado");
}
