import {
  crearDeber,
  editarDeber
} from "./api.js";

let deberEditando = null;

/**
 * Muestra el formulario para crear o editar un deber.
 */
export function mostrarFormularioDeber(deber = null) {
  const formulario = document.getElementById("homework-form");
  const titulo = document.getElementById("homework-form-title");

  if (!formulario) {
    console.error("[DEBERES] No se encuentra homework-form.");
    return;
  }

  deberEditando = deber;

  formulario.reset();

  const campoId = document.getElementById("homework-id");
  const campoTitulo = document.getElementById("homework-title-input");
  const campoAsignatura = document.getElementById("homework-subject");
  const campoTipo = document.getElementById("homework-type");
  const campoContenido = document.getElementById("homework-content");
  const campoDestinatario = document.getElementById("homework-recipient");
  const campoFecha = document.getElementById("homework-deadline");

  if (deber) {
    if (titulo) titulo.textContent = "Editar deber";

    if (campoId) campoId.value = deber._id || "";
    if (campoTitulo) campoTitulo.value = deber.titulo || "";
    if (campoAsignatura) campoAsignatura.value = deber.asignatura || "";
    if (campoTipo) campoTipo.value = deber.tipo || "";
    if (campoContenido) campoContenido.value = deber.contenido || "";
    if (campoDestinatario) {
      campoDestinatario.value = deber.destinatario || "";
    }

    if (campoFecha) {
      campoFecha.value = deber.fechaLimite
        ? String(deber.fechaLimite).slice(0, 10)
        : "";
    }
  } else {
    if (titulo) titulo.textContent = "Nuevo deber";

    if (campoId) campoId.value = "";
    if (campoDestinatario) campoDestinatario.value = "leo";
  }

  formulario.classList.remove("hidden");

  formulario.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

/**
 * Oculta y limpia el formulario.
 */
export function ocultarFormularioDeber() {
  const formulario = document.getElementById("homework-form");
  const campoId = document.getElementById("homework-id");

  if (formulario) {
    formulario.reset();
    formulario.classList.add("hidden");
  }

  if (campoId) {
    campoId.value = "";
  }

  deberEditando = null;
}

/**
 * Guarda un deber nuevo o los cambios de uno existente.
 */
export async function guardarFormularioDeber() {
  const mensaje = document.getElementById("homework-message");
  const boton = document.getElementById("homework-save-btn");

  const campoTitulo = document.getElementById("homework-title-input");
  const campoAsignatura = document.getElementById("homework-subject");
  const campoTipo = document.getElementById("homework-type");
  const campoContenido = document.getElementById("homework-content");
  const campoDestinatario = document.getElementById("homework-recipient");
  const campoFecha = document.getElementById("homework-deadline");

  if (
    !campoTitulo ||
    !campoAsignatura ||
    !campoTipo ||
    !campoContenido ||
    !campoDestinatario
  ) {
    console.error("[DEBERES] Faltan campos del formulario.");
    return;
  }

  const deber = {
    titulo: campoTitulo.value.trim(),
    asignatura: campoAsignatura.value,
    tipo: campoTipo.value,
    contenido: campoContenido.value.trim(),
    destinatario: campoDestinatario.value,
    fechaLimite: campoFecha?.value || null
  };

  try {
    if (mensaje) {
      mensaje.textContent = "Guardando deber...";
      mensaje.className = "homework-message";
    }

    if (boton) {
      boton.disabled = true;
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
  } finally {
    if (boton) {
      boton.disabled = false;
    }
  }
}