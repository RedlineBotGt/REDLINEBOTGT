
import {
  crearDeber,
  editarDeber,
  obtenerToken,
  subirImagenDeber
} from "./api.js";

import { obtenerPerfilActual } from "../users.js";

let deberEditando = null;
let contadorPreguntas = 0;
let imagenesSeleccionadas = [];
let urlsPrevisualizacion = [];

/**
 * Comprueba que el usuario puede gestionar deberes.
 */
function puedeGestionarDeberes() {
  return (
    obtenerPerfilActual() === "papa" &&
    Boolean(obtenerToken())
  );
}

/**
 * Muestra un mensaje de error.
 */
function mostrarErrorPermisos(texto) {
  const mensaje = document.getElementById("homework-message");
  const mensajeFormulario = document.getElementById(
    "homework-form-message"
  );

  if (mensajeFormulario) {
    mensajeFormulario.textContent = texto;
    mensajeFormulario.className = "homework-message error";
  }

  if (mensaje) {
    mensaje.textContent = texto;
    mensaje.className = "homework-message error";
  }
}

/**
 * Genera un identificador para cada pregunta.
 */
function generarIdPregunta() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `pregunta-${Date.now()}-${contadorPreguntas++}`;
}

/**
 * Muestra u oculta el apartado de preguntas.
 */
function actualizarApartadoPreguntas() {
  const tipo = document.getElementById("homework-type");
  const contenedor = document.getElementById(
    "homework-questions-container"
  );
  const etiquetaContenido = document.getElementById(
    "homework-content-label"
  );
  const contenido = document.getElementById("homework-content");
  const grupoImagenes = document.getElementById("homework-images-group");

  if (!tipo || !contenedor) return;

  const esEjercicio = tipo.value === "ejercicio" || tipo.value === "ejercicio_imagen";
  const esEjercicioImagen = tipo.value === "ejercicio_imagen";

  contenedor.classList.toggle("hidden", !esEjercicio);
  grupoImagenes?.classList.toggle("hidden", !esEjercicioImagen);

  if (etiquetaContenido) {
    etiquetaContenido.textContent = esEjercicioImagen
      ? "Descripción del ejercicio"
      : esEjercicio ? "Enunciado o instrucciones" : "Enlace o instrucciones";
  }

  if (contenido) {
    contenido.placeholder = esEjercicioImagen
      ? "Explica qué debe hacer el alumno y cómo utilizar las imágenes..."
      : esEjercicio ? "Explica brevemente qué debe hacer..."
      : "Pega aquí el enlace...";
  }
}

/**
 * Añade una pregunta al formulario.
 */
export function agregarPreguntaDeber(pregunta = null) {
  const lista = document.getElementById("homework-questions-list");

  if (!lista) return;

  const id = pregunta?.id || generarIdPregunta();

  const grupo = document.createElement("div");
  grupo.className = "homework-question-item";
  grupo.dataset.questionId = id;

  const numero = lista.children.length + 1;

  const encabezado = document.createElement("div");
  encabezado.className = "homework-question-header";

  const titulo = document.createElement("strong");
  titulo.textContent = `Pregunta ${numero}`;

  const eliminar = document.createElement("button");
  eliminar.type = "button";
  eliminar.textContent = "Eliminar";
  eliminar.className = "homework-remove-question-btn";

  eliminar.addEventListener("click", () => {
    grupo.remove();
    actualizarNumeracionPreguntas();
  });

  encabezado.appendChild(titulo);
  encabezado.appendChild(eliminar);

  const etiquetaPregunta = document.createElement("label");
  etiquetaPregunta.textContent = "Pregunta";

  const campoPregunta = document.createElement("textarea");
  campoPregunta.rows = 2;
  campoPregunta.required = true;
  campoPregunta.maxLength = 2000;
  campoPregunta.placeholder = "Escribe la pregunta...";
  campoPregunta.dataset.homeworkQuestion = "true";
  campoPregunta.value = pregunta?.pregunta || "";

  const etiquetaRespuesta = document.createElement("label");
  etiquetaRespuesta.textContent = "Respuesta correcta";

  const campoRespuesta = document.createElement("input");
  campoRespuesta.type = "text";
  campoRespuesta.required = true;
  campoRespuesta.maxLength = 1000;
  campoRespuesta.placeholder = "Escribe la respuesta esperada...";
  campoRespuesta.dataset.homeworkCorrectAnswer = "true";
  campoRespuesta.value = pregunta?.respuestaCorrecta || "";

  grupo.appendChild(encabezado);
  grupo.appendChild(etiquetaPregunta);
  grupo.appendChild(campoPregunta);
  grupo.appendChild(etiquetaRespuesta);
  grupo.appendChild(campoRespuesta);

  lista.appendChild(grupo);

  actualizarNumeracionPreguntas();
}

/**
 * Actualiza los números después de eliminar preguntas.
 */
function actualizarNumeracionPreguntas() {
  const lista = document.getElementById("homework-questions-list");

  if (!lista) return;

  Array.from(lista.children).forEach((grupo, indice) => {
    const titulo = grupo.querySelector(
      ".homework-question-header strong"
    );

    if (titulo) {
      titulo.textContent = `Pregunta ${indice + 1}`;
    }
  });
}

/**
 * Recupera las preguntas del formulario.
 */
function obtenerPreguntasFormulario() {
  const lista = document.getElementById("homework-questions-list");

  if (!lista) return [];

  return Array.from(lista.children).map((grupo) => {
    const pregunta = grupo.querySelector(
      '[data-homework-question="true"]'
    );

    const respuesta = grupo.querySelector(
      '[data-homework-correct-answer="true"]'
    );

    return {
      id: grupo.dataset.questionId || generarIdPregunta(),
      pregunta: pregunta?.value.trim() || "",
      respuestaCorrecta: respuesta?.value.trim() || ""
    };
  });
}

/**
 * Limpia las preguntas del formulario.
 */
function limpiarPreguntasFormulario() {
  const lista = document.getElementById("homework-questions-list");

  if (lista) {
    lista.replaceChildren();
  }

  contadorPreguntas = 0;
}

function limpiarImagenesSeleccionadas() {
  urlsPrevisualizacion.forEach(url => URL.revokeObjectURL(url));
  urlsPrevisualizacion = [];
  imagenesSeleccionadas = [];
  const input = document.getElementById("homework-images");
  const preview = document.getElementById("homework-images-preview");
  if (input) input.value = "";
  if (preview) preview.replaceChildren();
}

function actualizarPrevisualizacionImagenes() {
  const preview = document.getElementById("homework-images-preview");
  if (!preview) return;
  urlsPrevisualizacion.forEach(url => URL.revokeObjectURL(url));
  urlsPrevisualizacion = [];
  preview.replaceChildren();

  (Array.isArray(deberEditando?.imagenes) ? deberEditando.imagenes : []).forEach(imagen => {
    const guardada = document.createElement("div");
    guardada.className = "homework-image-saved";
    guardada.textContent = "Imagen guardada: " + (imagen.nombre || "imagen");
    preview.appendChild(guardada);
  });

  imagenesSeleccionadas.forEach((archivo, indice) => {
    const url = URL.createObjectURL(archivo);
    urlsPrevisualizacion.push(url);
    const item = document.createElement("div");
    item.className = "homework-image-preview-item";
    const img = document.createElement("img");
    img.src = url;
    img.alt = archivo.name;
    const nombre = document.createElement("span");
    nombre.textContent = archivo.name;
    const quitar = document.createElement("button");
    quitar.type = "button";
    quitar.textContent = "Quitar";
    quitar.addEventListener("click", () => {
      imagenesSeleccionadas.splice(indice, 1);
      actualizarPrevisualizacionImagenes();
    });
    item.append(img, nombre, quitar);
    preview.appendChild(item);
  });
}

function gestionarSeleccionImagenes(event) {
  const input = event.currentTarget;
  const nuevas = Array.from(input.files || []);
  input.value = "";
  const guardadas = Array.isArray(deberEditando?.imagenes) ? deberEditando.imagenes.length : 0;

  if (guardadas + imagenesSeleccionadas.length + nuevas.length > 5) {
    mostrarErrorPermisos("Cada ejercicio admite un máximo de 5 imágenes.");
    return;
  }
  const invalida = nuevas.find(file =>
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size === 0 || file.size > 5 * 1024 * 1024
  );
  if (invalida) {
    mostrarErrorPermisos("Usa imágenes JPG, PNG o WebP de hasta 5 MB cada una.");
    return;
  }
  imagenesSeleccionadas.push(...nuevas);
  actualizarPrevisualizacionImagenes();
}

/**
 * Inicializa los controles del formulario.
 */
function inicializarFormulario() {
  const tipo = document.getElementById("homework-type");
  const botonAgregar = document.getElementById(
    "homework-add-question-btn"
  );
  const campoImagenes = document.getElementById("homework-images");

  if (tipo && !tipo.dataset.listenerAdded) {
    tipo.addEventListener("change", actualizarApartadoPreguntas);
    tipo.dataset.listenerAdded = "true";
  }

  if (botonAgregar && !botonAgregar.dataset.listenerAdded) {
    botonAgregar.addEventListener("click", agregarPreguntaDeber);
    botonAgregar.dataset.listenerAdded = "true";
  }

  if (campoImagenes && !campoImagenes.dataset.listenerAdded) {
    campoImagenes.addEventListener("change", gestionarSeleccionImagenes);
    campoImagenes.dataset.listenerAdded = "true";
  }
}

/**
 * Muestra el formulario para crear o editar un deber.
 */
export function mostrarFormularioDeber(deber = null) {
  if (!puedeGestionarDeberes()) {
    ocultarFormularioDeber();

    mostrarErrorPermisos(
      "No tienes permiso para crear o editar deberes."
    );

    return;
  }

  inicializarFormulario();

  const formulario = document.getElementById("homework-form");
  const contenedor = document.getElementById("homework-form-container");
  const titulo = document.getElementById("homework-form-title");

  if (!formulario || !contenedor) {
    console.error(
      "[DEBERES] No se encuentra el formulario o su contenedor."
    );
    return;
  }

  deberEditando = deber;

  formulario.reset();
  limpiarPreguntasFormulario();
  limpiarImagenesSeleccionadas();

  const campoId = document.getElementById("homework-id");
  const campoTitulo = document.getElementById("homework-title-input");
  const campoAsignatura = document.getElementById("homework-subject");
  const campoTipo = document.getElementById("homework-type");
  const campoContenido = document.getElementById("homework-content");
  const campoDestinatario = document.getElementById("homework-recipient");
  const campoFecha = document.getElementById("homework-deadline");
  const campoEstado = document.getElementById("homework-status");
  const grupoEstado = document.getElementById("homework-status-group");

  if (deber) {
    if (titulo) titulo.textContent = "Editar deber";

    if (campoId) campoId.value = deber._id || "";
    if (campoTitulo) campoTitulo.value = deber.titulo || "";
    if (campoAsignatura) campoAsignatura.value = deber.asignatura || "";
    if (campoTipo) campoTipo.value = deber.tipo || "enlace";
    if (campoContenido) campoContenido.value = deber.contenido || "";

    if (campoDestinatario) {
      campoDestinatario.value = deber.destinatario || "leo";
    }

    if (campoFecha) {
      campoFecha.value = deber.fechaLimite
        ? String(deber.fechaLimite).slice(0, 10)
        : "";
    }

    if (campoEstado) {
      campoEstado.value = deber.estado || "pendiente";
    }

    if (grupoEstado) {
      grupoEstado.classList.remove("hidden");
    }

    if (
      (deber.tipo === "ejercicio" || deber.tipo === "ejercicio_imagen") &&
      Array.isArray(deber.preguntas)
    ) {
      deber.preguntas.forEach((pregunta) => {
        agregarPreguntaDeber(pregunta);
      });
    }

  } else {
    if (titulo) titulo.textContent = "Nuevo deber";

    if (campoId) campoId.value = "";
    if (campoDestinatario) campoDestinatario.value = "leo";

    if (campoEstado) {
      campoEstado.value = "pendiente";
    }

    if (grupoEstado) {
      grupoEstado.classList.add("hidden");
    }
  }

  actualizarApartadoPreguntas();
  actualizarPrevisualizacionImagenes();

  contenedor.classList.remove("hidden");
  formulario.classList.remove("hidden");

  contenedor.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

/**
 * Oculta y limpia el formulario.
 */
export function ocultarFormularioDeber() {
  const formulario = document.getElementById("homework-form");
  const contenedor = document.getElementById("homework-form-container");
  const campoId = document.getElementById("homework-id");
  const grupoEstado = document.getElementById("homework-status-group");

  if (formulario) {
    formulario.reset();
    formulario.classList.add("hidden");
  }

  if (contenedor) {
    contenedor.classList.add("hidden");
  }

  if (campoId) {
    campoId.value = "";
  }

  if (grupoEstado) {
    grupoEstado.classList.add("hidden");
  }

  limpiarPreguntasFormulario();
  limpiarImagenesSeleccionadas();

  deberEditando = null;
}

/**
 * Guarda un deber nuevo o los cambios de uno existente.
 */
export async function guardarFormularioDeber() {
  if (!puedeGestionarDeberes()) {
    ocultarFormularioDeber();

    mostrarErrorPermisos(
      "No tienes permiso para crear o editar deberes."
    );

    return;
  }

  const mensaje = document.getElementById("homework-message");
  const mensajeFormulario = document.getElementById(
    "homework-form-message"
  );
  const boton = document.getElementById("homework-save-btn");

  const campoTitulo = document.getElementById("homework-title-input");
  const campoAsignatura = document.getElementById("homework-subject");
  const campoTipo = document.getElementById("homework-type");
  const campoContenido = document.getElementById("homework-content");
  const campoDestinatario = document.getElementById("homework-recipient");
  const campoFecha = document.getElementById("homework-deadline");
  const campoEstado = document.getElementById("homework-status");

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

  if (deber.tipo === "ejercicio" || deber.tipo === "ejercicio_imagen") {
    const preguntas = obtenerPreguntasFormulario();

    if (preguntas.length === 0) {
      if (mensajeFormulario) {
        mensajeFormulario.textContent =
          "Añade al menos una pregunta al ejercicio.";
        mensajeFormulario.className = "homework-message error";
      }
      return;
    }

    const preguntaIncompleta = preguntas.some(
      (item) => !item.pregunta || !item.respuestaCorrecta
    );

    if (preguntaIncompleta) {
      if (mensajeFormulario) {
        mensajeFormulario.textContent =
          "Completa todas las preguntas y sus respuestas correctas.";
        mensajeFormulario.className = "homework-message error";
      }
      return;
    }

    deber.preguntas = preguntas;

  } else {
    deber.preguntas = [];
  }

  if (
    deber.tipo === "ejercicio_imagen" &&
    !deberEditando?.imagenes?.length &&
    imagenesSeleccionadas.length === 0
  ) {
    if (mensajeFormulario) {
      mensajeFormulario.textContent = "Adjunta al menos una imagen para este tipo de ejercicio.";
      mensajeFormulario.className = "homework-message error";
    }
    return;
  }

  if (deberEditando?._id && campoEstado) {
    deber.estado = campoEstado.value;
  }

  try {
    if (mensajeFormulario) {
      mensajeFormulario.textContent = "Guardando deber...";
      mensajeFormulario.className = "homework-message";
    }

    if (mensaje) {
      mensaje.textContent = "";
    }

    if (boton) {
      boton.disabled = true;
    }

    let idDeber = deberEditando?._id ? String(deberEditando._id) : "";
    if (deberEditando?._id) {
      await editarDeber(deberEditando._id, deber);
    } else {
      const creado = await crearDeber(deber);
      idDeber = String(creado.deber?._id || "");
      if (!idDeber) throw new Error("No se recibió el identificador del deber.");
    }

    if (deber.tipo === "ejercicio_imagen") {
      for (const archivo of imagenesSeleccionadas) {
        await subirImagenDeber(idDeber, archivo);
      }
    }

    ocultarFormularioDeber();

    if (mensajeFormulario) {
      mensajeFormulario.textContent = "Deber guardado correctamente.";
      mensajeFormulario.className = "homework-message success";
    }

    if (mensaje) {
      mensaje.textContent = "Deber guardado correctamente.";
      mensaje.className = "homework-message success";
    }

    if (typeof window.cargarDeberes === "function") {
      await window.cargarDeberes();
    }

  } catch (error) {
    const textoError =
      error.message || "No se ha podido guardar el deber.";

    if (mensajeFormulario) {
      mensajeFormulario.textContent = textoError;
      mensajeFormulario.className = "homework-message error";
    }

    if (mensaje) {
      mensaje.textContent = textoError;
      mensaje.className = "homework-message error";
    }

  } finally {
    if (boton) {
      boton.disabled = false;
    }
  }
}

// Compatibilidad con el botón del HTML.
window.agregarPreguntaDeber = agregarPreguntaDeber;
