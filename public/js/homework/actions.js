import {
  eliminarDeber,
  completarDeber,
  reabrirDeber
} from "./api.js";

import {
  mostrarFormularioDeber
} from "./forms.js";

let deberesActuales = [];

/**
 * Recibe la lista actual de deberes desde homework.js.
 */
export function establecerDeberesActuales(deberes) {
  deberesActuales = Array.isArray(deberes) ? deberes : [];
}

/**
 * Busca un deber por su identificador.
 */
function buscarDeber(id) {
  return deberesActuales.find(
    deber => String(deber._id) === String(id)
  );
}

/**
 * Muestra mensajes de resultado.
 */
function mostrarMensaje(texto, tipo = "") {
  const mensaje = document.getElementById("homework-message");

  if (!mensaje) return;

  mensaje.textContent = texto;
  mensaje.className = `homework-message ${tipo}`.trim();
}

/**
 * Recarga la lista de deberes.
 */
async function actualizarDeberes() {
  if (typeof window.cargarDeberes === "function") {
    await window.cargarDeberes();
  }
}

/**
 * Abre el formulario para editar un deber.
 */
export function editarDeberPantalla(id) {
  const deber = buscarDeber(id);

  if (!deber) {
    mostrarMensaje("No se ha encontrado ese deber.", "error");
    return;
  }

  mostrarFormularioDeber(deber);
}

/**
 * Elimina un deber.
 */
export async function eliminarDeberPantalla(id) {
  const deber = buscarDeber(id);

  if (!deber) {
    mostrarMensaje("No se ha encontrado ese deber.", "error");
    return;
  }

  const confirmar = window.confirm(
    `¿Seguro que quieres eliminar el deber "${deber.titulo}"?`
  );

  if (!confirmar) return;

  try {
    mostrarMensaje("Eliminando deber...");

    await eliminarDeber(id);
    await actualizarDeberes();

    mostrarMensaje("Deber eliminado correctamente.", "success");
  } catch (error) {
    mostrarMensaje(
      error.message || "No se ha podido eliminar el deber.",
      "error"
    );
  }
}

/**
 * Marca un deber como completado.
 */
export async function completarDeberPantalla(id) {
  const deber = buscarDeber(id);

  if (!deber) {
    mostrarMensaje("No se ha encontrado ese deber.", "error");
    return;
  }

  if (deber.estado === "completado") {
    mostrarMensaje("Este deber ya está completado.", "error");
    return;
  }

  try {
    mostrarMensaje("Guardando progreso...");

    await completarDeber(id);
    await actualizarDeberes();

    mostrarMensaje("¡Deber completado! ¡Buen trabajo!", "success");
  } catch (error) {
    mostrarMensaje(
      error.message || "No se ha podido completar el deber.",
      "error"
    );
  }
}

/**
 * Vuelve a abrir un deber completado.
 */
export async function reabrirDeberPantalla(id) {
  const deber = buscarDeber(id);

  if (!deber) {
    mostrarMensaje("No se ha encontrado ese deber.", "error");
    return;
  }

  if (deber.estado !== "completado") {
    mostrarMensaje("Este deber ya está pendiente.", "error");
    return;
  }

  const confirmar = window.confirm(
    `¿Quieres volver a abrir el deber "${deber.titulo}"?`
  );

  if (!confirmar) return;

  try {
    mostrarMensaje("Reabriendo deber...");

    await reabrirDeber(id);
    await actualizarDeberes();

    mostrarMensaje("El deber vuelve a estar pendiente.", "success");
  } catch (error) {
    mostrarMensaje(
      error.message || "No se ha podido reabrir el deber.",
      "error"
    );
  }
}