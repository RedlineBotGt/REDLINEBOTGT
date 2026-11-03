
import {
  eliminarDeber,
  completarDeber,
  comprobarRespuestasEjercicio,
  reabrirDeber
} from "./api.js";

import {
  mostrarFormularioDeber
} from "./forms.js";

let deberesActuales = [];

export function establecerDeberesActuales(deberes) {
  deberesActuales = Array.isArray(deberes) ? deberes : [];
}

function buscarDeber(id) {
  return deberesActuales.find(
    deber => String(deber._id) === String(id)
  );
}

function mostrarMensaje(texto, tipo = "") {
  const mensaje = document.getElementById("homework-message");

  if (!mensaje) return;

  mensaje.textContent = texto;
  mensaje.className = `homework-message ${tipo}`.trim();
}

async function actualizarDeberes() {
  if (typeof window.cargarDeberes === "function") {
    await window.cargarDeberes();
  }
}

// ========================================
// EDITAR DEBER
// ========================================

export function editarDeberPantalla(id) {
  const deber = buscarDeber(id);

  if (!deber) {
    mostrarMensaje("No se ha encontrado ese deber.", "error");
    return;
  }

  mostrarFormularioDeber(deber);
}

// ========================================
// ELIMINAR DEBER
// ========================================

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

// ========================================
// COMPLETAR DEBER NORMAL
// ========================================

export async function completarDeberPantalla(id) {
  const deber = buscarDeber(id);

  if (!deber) {
    mostrarMensaje("No se ha encontrado ese deber.", "error");
    return;
  }

  if (deber.tipo === "ejercicio") {
    mostrarMensaje(
      "Los ejercicios se completan al acertar todas las respuestas.",
      "error"
    );
    return;
  }

  if (deber.estado === "completado") {
    mostrarMensaje("Este deber ya está terminado.", "success");
    return;
  }

  const confirmar = window.confirm(
    `¿Marcar "${deber.titulo}" como terminado?`
  );

  if (!confirmar) return;

  try {
    mostrarMensaje("Completando deber...");

    await completarDeber(id);
    await actualizarDeberes();

    mostrarMensaje(
      "¡Deber completado correctamente!",
      "success"
    );
  } catch (error) {
    mostrarMensaje(
      error.message || "No se ha podido completar el deber.",
      "error"
    );
  }
}

// ========================================
// COMPROBAR RESPUESTAS DEL EJERCICIO
// ========================================

export async function comprobarEjercicioPantalla(id) {
  const deber = buscarDeber(id);

  if (!deber) {
    mostrarMensaje("No se ha encontrado ese ejercicio.", "error");
    return;
  }

  if (deber.estado === "completado") {
    mostrarMensaje(
      "Este ejercicio ya está completado.",
      "success"
    );
    return;
  }

  const formulario = document.getElementById(
    `exercise-form-${id}`
  );

  if (!formulario) {
    mostrarMensaje(
      "No se encuentra el formulario del ejercicio.",
      "error"
    );
    return;
  }

  const campos = formulario.querySelectorAll(
    "[data-exercise-answer]"
  );

  const respuestas = Array.from(campos).map(campo => ({
    preguntaId: campo.dataset.questionId,
    respuesta: campo.value.trim()
  }));

  if (
    respuestas.length === 0 ||
    respuestas.some(
      item => !item.respuesta || !item.preguntaId
    )
  ) {
    mostrarMensaje(
      "Contesta todas las preguntas antes de comprobar.",
      "error"
    );
    return;
  }

  const boton = formulario.querySelector(
    "[data-exercise-submit]"
  ) || formulario.querySelector(
    'button[type="submit"]'
  );

  try {
    if (boton) boton.disabled = true;

    mostrarMensaje("Comprobando tus respuestas...");

    const resultado = await comprobarRespuestasEjercicio(
      id,
      respuestas
    );

    if (resultado.completado) {
      mostrarMensaje(
        "¡Perfecto! Has acertado todas las respuestas. ¡Ejercicio terminado!",
        "success"
      );

      await actualizarDeberes();
    } else {
      mostrarMensaje(
        resultado.error ||
        "Todavía hay alguna respuesta incorrecta. ¡Inténtalo de nuevo!",
        "error"
      );
    }
  } catch (error) {
    mostrarMensaje(
      error.message || "No se han podido comprobar las respuestas.",
      "error"
    );
  } finally {
    if (boton) boton.disabled = false;
  }
}

// ========================================
// REABRIR DEBER
// ========================================

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

    mostrarMensaje(
      "El deber vuelve a estar pendiente.",
      "success"
    );
  } catch (error) {
    mostrarMensaje(
      error.message || "No se ha podido reabrir el deber.",
      "error"
    );
  }
}

// ========================================
// FUNCIONES DISPONIBLES DESDE EL HTML
// ========================================

window.comprobarEjercicioPantalla = comprobarEjercicioPantalla;
window.completarDeberPantalla = completarDeberPantalla;
window.editarDeberPantalla = editarDeberPantalla;
window.eliminarDeberPantalla = eliminarDeberPantalla;
window.reabrirDeberPantalla = reabrirDeberPantalla;
