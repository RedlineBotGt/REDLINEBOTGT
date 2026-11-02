
 // ========================================
// DEBERES - ACADEMIA CAMPOS
// ========================================

import { obtenerPerfilActual } from "./users.js";

// ========================================
// CONFIGURACIÓN
// ========================================

const API_URL = "/api/academia/homework";

const ASIGNATURAS_DEBERES = {
  ciencias: "Ciencias",
  matematicas: "Matemáticas",
  lengua: "Lengua",
  geografia: "Geografía",
  historia: "Historia",
  ingles: "Inglés",
  cultura: "Cultura general",
  otras: "Otras"
};

const TIPOS_DEBERES = {
  enlace: "Enlace externo",
  ejercicio: "Ejercicio de Academia",
  escrito: "Tarea escrita"
};

const DESTINATARIOS = {
  leo: "Leo",
  mama: "Mamá"
};

// ========================================
// PETICIONES A LA API
// ========================================

async function solicitarAPI(url, opciones = {}) {
  const respuesta = await fetch(url, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      ...(opciones.headers || {})
    }
  });

  let datos;

  try {
    datos = await respuesta.json();
  } catch {
    throw new Error("El servidor no ha devuelto una respuesta válida.");
  }

  if (!respuesta.ok || datos.ok === false) {
    throw new Error(
      datos.error || "No se ha podido completar la operación."
    );
  }

  return datos;
}

// ========================================
// CONSULTAR DEBERES
// ========================================

export async function obtenerDeberes(filtros = {}) {
  const parametros = new URLSearchParams();

  if (filtros.perfil) {
    parametros.set("perfil", filtros.perfil);
  }

  if (filtros.asignatura) {
    parametros.set("asignatura", filtros.asignatura);
  }

  if (filtros.estado) {
    parametros.set("estado", filtros.estado);
  }

  const consulta = parametros.toString();

  const url = consulta
    ? `${API_URL}?${consulta}`
    : API_URL;

  return solicitarAPI(url);
}

// ========================================
// CREAR DEBER
// SOLO PAPÁ
// ========================================

export async function crearDeber(deber) {
  if (obtenerPerfilActual() !== "papa") {
    throw new Error("Solo Papá puede crear deberes.");
  }

  validarDeber(deber);

  return solicitarAPI(API_URL, {
    method: "POST",
    body: JSON.stringify(deber)
  });
}

// ========================================
// EDITAR DEBER
// SOLO PAPÁ
// ========================================

export async function editarDeber(id, cambios) {
  if (obtenerPerfilActual() !== "papa") {
    throw new Error("Solo Papá puede editar deberes.");
  }

  if (!id) {
    throw new Error("Falta el identificador del deber.");
  }

  return solicitarAPI(
    `${API_URL}/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(cambios)
    }
  );
}

// ========================================
// ELIMINAR DEBER
// SOLO PAPÁ
// ========================================

export async function eliminarDeber(id) {
  if (obtenerPerfilActual() !== "papa") {
    throw new Error("Solo Papá puede eliminar deberes.");
  }

  if (!id) {
    throw new Error("Falta el identificador del deber.");
  }

  return solicitarAPI(
    `${API_URL}/${encodeURIComponent(id)}`,
    {
      method: "DELETE"
    }
  );
}

// ========================================
// MARCAR DEBER COMO COMPLETADO
// ========================================

export async function completarDeber(id) {
  const perfil = obtenerPerfilActual();

  if (!DESTINATARIOS[perfil]) {
    throw new Error("Este perfil no puede completar deberes.");
  }

  if (!id) {
    throw new Error("Falta el identificador del deber.");
  }

  return solicitarAPI(
    `${API_URL}/${encodeURIComponent(id)}/complete`,
    {
      method: "PATCH",
      body: JSON.stringify({
        perfil
      })
    }
  );
}

// ========================================
// VALIDAR DATOS DEL DEBER
// ========================================

function validarDeber(deber) {
  if (!deber || typeof deber !== "object") {
    throw new Error("Los datos del deber no son válidos.");
  }

  if (!deber.titulo || !deber.titulo.trim()) {
    throw new Error("El deber necesita un título.");
  }

  if (!ASIGNATURAS_DEBERES[deber.asignatura]) {
    throw new Error("Selecciona una asignatura válida.");
  }

  if (!TIPOS_DEBERES[deber.tipo]) {
    throw new Error("Selecciona un tipo de deber válido.");
  }

  if (!DESTINATARIOS[deber.destinatario]) {
    throw new Error("Selecciona Leo o Mamá como destinatario.");
  }

  if (deber.tipo === "enlace") {
    if (!deber.contenido || !deber.contenido.trim()) {
      throw new Error("Introduce el enlace del deber.");
    }

    try {
      const url = new URL(deber.contenido);

      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error();
      }
    } catch {
      throw new Error("El enlace debe ser una dirección web válida.");
    }
  }

  if (
    (deber.tipo === "ejercicio" || deber.tipo === "escrito") &&
    (!deber.contenido || !deber.contenido.trim())
  ) {
    throw new Error("Introduce el contenido del deber.");
  }

  if (deber.fechaLimite) {
    const fecha = new Date(deber.fechaLimite);

    if (Number.isNaN(fecha.getTime())) {
      throw new Error("La fecha límite no es válida.");
    }
  }
}

// ========================================
// CONSULTAR OPCIONES
// ========================================

export function obtenerAsignaturasDeberes() {
  return { ...ASIGNATURAS_DEBERES };
}

export function obtenerTiposDeberes() {
  return { ...TIPOS_DEBERES };
}

export function obtenerDestinatariosDeberes() {
  return { ...DESTINATARIOS };
}

// ========================================
// INICIALIZACIÓN
// ========================================

export function iniciarDeberes() {
  console.log("[DEBERES] Módulo preparado");
}
