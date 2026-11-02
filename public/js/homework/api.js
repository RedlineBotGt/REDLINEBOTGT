
import { obtenerPerfilActual } from "../users.js";

export const API_URL = "/api/academia/homework";
export const TOKEN_KEY = "academiaPapaToken";

export const ASIGNATURAS = {
  ciencias: "Ciencias",
  matematicas: "Matemáticas",
  lengua: "Lengua",
  geografia: "Geografía",
  historia: "Historia",
  ingles: "Inglés",
  cultura: "Cultura general",
  otras: "Otras"
};

export const TIPOS = {
  enlace: "Enlace externo",
  ejercicio: "Ejercicio de Academia",
  escrito: "Tarea escrita"
};

export const DESTINATARIOS = {
  leo: "Leo",
  mama: "Mamá"
};

// ========================================
// SESIÓN DE PAPÁ
// ========================================

export function obtenerToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function guardarToken(token) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error("[DEBERES] Error guardando sesión:", error);
  }
}

export function cerrarSesion() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {}
}

// ========================================
// PETICIONES A LA API
// ========================================

export async function solicitarAPI(url, opciones = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(opciones.headers || {})
  };

  if (obtenerPerfilActual() === "papa") {
    const token = obtenerToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const respuesta = await fetch(url, {
    ...opciones,
    headers
  });

  let datos;

  try {
    datos = await respuesta.json();
  } catch {
    throw new Error(
      "El servidor no ha devuelto una respuesta válida."
    );
  }

  if (!respuesta.ok || datos.ok === false) {
    if (
      respuesta.status === 401 &&
      obtenerPerfilActual() === "papa" &&
      !url.endsWith("/auth")
    ) {
      cerrarSesion();

      window.dispatchEvent(
        new Event("academia:papa-session-expired")
      );
    }

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

  return solicitarAPI(
    consulta ? `${API_URL}?${consulta}` : API_URL
  );
}

// ========================================
// CREAR DEBER
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
    { method: "DELETE" }
  );
}

// ========================================
// COMPLETAR DEBER
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
      body: JSON.stringify({ perfil })
    }
  );
}

// ========================================
// REABRIR DEBER
// ========================================

export async function reabrirDeber(id) {
  const perfil = obtenerPerfilActual();

  if (
    perfil !== "papa" &&
    !DESTINATARIOS[perfil]
  ) {
    throw new Error("Este perfil no puede reabrir deberes.");
  }

  if (!id) {
    throw new Error("Falta el identificador del deber.");
  }

  return solicitarAPI(
    `${API_URL}/${encodeURIComponent(id)}/reopen`,
    {
      method: "PATCH",
      body: JSON.stringify({ perfil })
    }
  );
}

// ========================================
// VALIDAR DEBER
// ========================================

export function validarDeber(deber) {
  if (!deber || typeof deber !== "object") {
    throw new Error("Los datos del deber no son válidos.");
  }

  if (
    typeof deber.titulo !== "string" ||
    !deber.titulo.trim()
  ) {
    throw new Error("El deber necesita un título.");
  }

  if (!ASIGNATURAS[deber.asignatura]) {
    throw new Error("Selecciona una asignatura válida.");
  }

  if (!TIPOS[deber.tipo]) {
    throw new Error("Selecciona un tipo de deber válido.");
  }

  if (!DESTINATARIOS[deber.destinatario]) {
    throw new Error("Selecciona Leo o Mamá como destinatario.");
  }

  if (
    typeof deber.contenido !== "string" ||
    !deber.contenido.trim()
  ) {
    throw new Error("Introduce el contenido del deber.");
  }

  if (deber.tipo === "enlace") {
    try {
      const url = new URL(deber.contenido);

      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error();
      }
    } catch {
      throw new Error(
        "El enlace debe ser una dirección web válida."
      );
    }
  }

  if (deber.fechaLimite) {
    const fecha = new Date(deber.fechaLimite);

    if (Number.isNaN(fecha.getTime())) {
      throw new Error("La fecha límite no es válida.");
    }
  }
}
