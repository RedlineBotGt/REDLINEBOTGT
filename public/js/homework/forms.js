import {
  ASIGNATURAS,
  TIPOS,
  crearDeber,
  editarDeber
} from "./api.js";

import {
  escaparHTML
} from "./render.js";

let deberEditando = null;

/**
 * Prepara el formulario para crear o editar un deber.
 */
export function mostrarFormularioDeber(deber = null) {
  const formulario = document.getElementById("homework-form");
  const titulo = document.getElementById("homework-form-title");

  if (!formulario) {
    console.error("[DEBERES] No se encuentra el formulario.");
    return;
  }

  deberEditando = deber;

  formulario.reset();

  const campoTitulo = document.getElementById("homework-title");
  const campoAsignatura = document.getElementById("homework-subject");
  const campoTipo = document.getElementById("homework-type");
  const campoDestinatario = document.getElementById("homework-recipient");
  const campoContenido = document.getElementById("homework-content");
  const campoFecha = document.getElementById("homework-deadline");

  if (deber) {
    if (titulo) titulo.textContent = "Editar deber";

    if (campoTitulo) campoTitulo.value = deber.titulo || "";
    if (campoAsignatura) campoAsignatura.value = deber.asignatura || "";
    if (campoTipo) campoTipo.value = deber.tipo || "";
    if (campoDestinatario) campoDestinatario.value = deber.destinatario || "";
    if (campoContenido) campoContenido.value = deber.contenido || "";
    if (campoFecha) campoFecha.value = deber.fechaLimite
      ? String(deber.fechaLimite).slice(0, 10)
      : "";
  } else {
    if (titulo) titulo.textContent = "Nuevo deber";

    if (campoDestinatario) {
      campoDestinatario.value = "leo";
    }
  }

  formulario.classList.remove("hidden");

  formulario.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

/**
 * Oculta el formulario y limpia sus datos.
 */
export function ocultarFormularioDeber() {
  const formulario = document.getElementById("homework-form");

  if (formulario) {
    formulario.reset();
    formulario.classList.add("hidden");
  }

  deberEditando = null;
}

/**
 * Guarda un deber nuevo o los cambios de uno existente.
 */
export async function guardarFormularioDeber() {
  const mensaje = document.getElementById("homework-message");

  const campoTitulo = document.getElementById("homework-title");
  const campoAsignatura = document.getElementById("homework-subject");
  const campoTipo = document.getElementById("homework-type");
  const campoDestinatario = document.getElementById("homework-recipient");
  const campoContenido = document.getElementById("homework-content");
  const campoFecha = document.getElementById("homework-deadline");

  if (
    !campoTitulo ||
    !campoAsignatura ||
    !campoTipo ||
    !campoDestinatario ||
    !campoContenido
  ) {
    console.error("[DEBERES] Faltan campos del formulario.");
    return;
  }

  const deber = {
    titulo: campoTitulo.value.trim(),
    asignatura: campoAsignatura.value,
    tipo: campoTipo.value,
    destinatario: campoDestinatario.value,
    contenido: campoContenido.value.trim(),
    fechaLimite: campoFecha?.value || null
  };

  try {
    if (mensaje) {
      mensaje.textContent = "Guardando deber...";
      mensaje.className = "homework-message";
    }

    if (deberEditando?._id) {
      await editarDeber(deberEditando._id, deber);
    } else {
      await crearDeber(deber);
    }

    ocultarFormularioDeber();

    if (mensaje) {
      mensaje.textContent = "Deber guardado correctamente.";
      mensaje.className = "homework-message success";
    }

    if (typeof window.cargarDeberes === "function") {
      await window.cargarDeberes();
    }
  } catch (error) {
    if (mensaje) {
      mensaje.textContent =
        error.message || "No se ha podido guardar el deber.";

      mensaje.className = "homework-message error";
    }
  }
}