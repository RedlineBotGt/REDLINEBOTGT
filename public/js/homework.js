import { obtenerPerfilActual } from "./users.js";

import {
  API_URL,
  obtenerDeberes,
  solicitarAPI,
  guardarToken,
  cerrarSesion,
  obtenerToken
} from "./homework/api.js";

import { pintarDeberes } from "./homework/render.js";

import {
  mostrarFormularioDeber,
  ocultarFormularioDeber,
  guardarFormularioDeber
} from "./homework/forms.js";

import {
  establecerDeberesActuales,
  editarDeberPantalla,
  eliminarDeberPantalla,
  completarDeberPantalla,
  reabrirDeberPantalla
} from "./homework/actions.js";

let deberesActuales = [];
let inicializado = false;

/**
 * Abre la pantalla de deberes.
 */
export function abrirDeberes() {
  const pantalla = document.getElementById("homework-screen");
  const asignaturas = document.getElementById("subjects-screen");
  const gestion = document.getElementById("homework-management");
  const acceso = document.getElementById("homework-login");

  if (asignaturas) asignaturas.classList.add("hidden");
  if (pantalla) pantalla.classList.remove("hidden");

  const perfil = obtenerPerfilActual();

  // PAPÁ: necesita iniciar sesión antes de ver la gestión.
  if (perfil === "papa") {
    if (!obtenerToken()) {
      mostrarAccesoPapa();
      return;
    }

    if (acceso) acceso.classList.add("hidden");
    if (gestion) gestion.classList.remove("hidden");

    cargarDeberes();
    return;
  }

  // LEO Y MAMÁ: nunca deben conservar una sesión administrativa.
  cerrarSesion();

  if (acceso) acceso.classList.add("hidden");
  if (gestion) gestion.classList.add("hidden");

  ocultarFormularioDeber();

  cargarDeberes();
}

/**
 * Vuelve a la selección de asignaturas.
 */
export function volverDesdeDeberes() {
  const pantalla = document.getElementById("homework-screen");
  const asignaturas = document.getElementById("subjects-screen");

  if (pantalla) pantalla.classList.add("hidden");
  if (asignaturas) asignaturas.classList.remove("hidden");

  ocultarFormularioDeber();
}

/**
 * Muestra el acceso de Papá.
 */
export function mostrarAccesoPapa() {
  const acceso = document.getElementById("homework-login");
  const gestion = document.getElementById("homework-management");

  if (obtenerPerfilActual() !== "papa") {
    if (acceso) acceso.classList.add("hidden");
    if (gestion) gestion.classList.add("hidden");
    return;
  }

  if (acceso) acceso.classList.remove("hidden");
  if (gestion) gestion.classList.add("hidden");

  ocultarFormularioDeber();
}

/**
 * Inicia sesión de Papá mediante PIN.
 */
export async function iniciarSesionDeberes() {
  if (obtenerPerfilActual() !== "papa") {
    return;
  }

  const pin = document.getElementById("homework-pin");
  const mensaje = document.getElementById("homework-login-message");
  const boton = document.getElementById("homework-login-btn");

  if (!pin || !pin.value.trim()) {
    if (mensaje) {
      mensaje.textContent = "Introduce el PIN.";
      mensaje.className = "error";
    }
    return;
  }

  try {
    if (boton) boton.disabled = true;

    if (mensaje) {
      mensaje.textContent = "Comprobando PIN...";
      mensaje.className = "";
    }

    const respuesta = await solicitarAPI(`${API_URL}/auth`, {
      method: "POST",
      body: JSON.stringify({
        pin: pin.value.trim()
      })
    });

    if (!respuesta.token) {
      throw new Error("El servidor no ha devuelto un token válido.");
    }

    guardarToken(respuesta.token);
    pin.value = "";

    const acceso = document.getElementById("homework-login");
    const gestion = document.getElementById("homework-management");

    if (acceso) acceso.classList.add("hidden");
    if (gestion) gestion.classList.remove("hidden");

    if (mensaje) mensaje.textContent = "";

    await cargarDeberes();
  } catch (error) {
    cerrarSesion();

    if (mensaje) {
      mensaje.textContent =
        error.message || "No se ha podido iniciar sesión.";
      mensaje.className = "error";
    }
  } finally {
    if (boton) boton.disabled = false;
  }
}

/**
 * Cierra la sesión de Papá.
 */
export function cerrarSesionDeberes() {
  cerrarSesion();

  if (obtenerPerfilActual() === "papa") {
    mostrarAccesoPapa();
  } else {
    const acceso = document.getElementById("homework-login");
    const gestion = document.getElementById("homework-management");

    if (acceso) acceso.classList.add("hidden");
    if (gestion) gestion.classList.add("hidden");
  }
}

/**
 * Lee los filtros seleccionados.
 */
function obtenerFiltros() {
  const destinatario = document.getElementById(
    "homework-filter-recipient"
  );

  const asignatura = document.getElementById(
    "homework-filter-subject"
  );

  const estado = document.getElementById(
    "homework-filter-state"
  );

  const filtros = {};
  const perfil = obtenerPerfilActual();

  if (perfil === "papa") {
    filtros.perfil = destinatario?.value || "papa";
  } else if (perfil === "leo" || perfil === "mama") {
    filtros.perfil = perfil;
  }

  if (asignatura?.value) {
    filtros.asignatura = asignatura.value;
  }

  if (estado?.value) {
    filtros.estado = estado.value;
  }

  return filtros;
}

/**
 * Carga y pinta los deberes.
 */
export async function cargarDeberes() {
  const lista = document.getElementById("homework-list");
  const mensaje = document.getElementById("homework-message");
  const perfil = obtenerPerfilActual();

  // Evita cargar la gestión de Papá sin autenticación.
  if (perfil === "papa" && !obtenerToken()) {
    mostrarAccesoPapa();
    return;
  }

  try {
    if (lista) {
      lista.innerHTML = "<p>Cargando deberes...</p>";
    }

    const respuesta = await obtenerDeberes(obtenerFiltros());

    deberesActuales = Array.isArray(respuesta.deberes)
      ? respuesta.deberes
      : [];

    establecerDeberesActuales(deberesActuales);

    pintarDeberes(
      deberesActuales,
      perfil
    );

    if (mensaje) {
      mensaje.textContent = "";
    }
  } catch (error) {
    if (lista) {
      lista.textContent =
        error.message || "No se han podido cargar los deberes.";
    }
  }
}

/**
 * Inicializa los eventos de la pantalla.
 */
export function iniciarDeberes() {
  if (inicializado) return;
  inicializado = true;

  const formulario = document.getElementById("homework-form");

  if (formulario) {
    formulario.addEventListener("submit", event => {
      event.preventDefault();
      guardarFormularioDeber();
    });
  }

  const campoPin = document.getElementById("homework-pin");

  if (campoPin) {
    campoPin.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        iniciarSesionDeberes();
      }
    });
  }

  [
    "homework-filter-recipient",
    "homework-filter-subject",
    "homework-filter-state"
  ].forEach(id => {
    const filtro = document.getElementById(id);

    if (filtro) {
      filtro.addEventListener("change", cargarDeberes);
    }
  });

  window.addEventListener(
    "academia:papa-session-expired",
    mostrarAccesoPapa
  );

  window.abrirDeberes = abrirDeberes;
  window.volverDesdeDeberes = volverDesdeDeberes;
  window.iniciarSesionDeberes = iniciarSesionDeberes;
  window.cerrarSesionDeberes = cerrarSesionDeberes;
  window.mostrarAccesoPapa = mostrarAccesoPapa;

  window.mostrarFormularioDeber = mostrarFormularioDeber;
  window.ocultarFormularioDeber = ocultarFormularioDeber;
  window.guardarFormularioDeber = guardarFormularioDeber;

  window.cargarDeberes = cargarDeberes;

  window.editarDeberPantalla = editarDeberPantalla;
  window.eliminarDeberPantalla = eliminarDeberPantalla;
  window.completarDeberPantalla = completarDeberPantalla;
  window.reabrirDeberPantalla = reabrirDeberPantalla;
}

window.iniciarDeberes = iniciarDeberes;