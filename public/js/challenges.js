
import {
  perfiles,
  obtenerPerfilActual
} from "./users.js";

import {
  asignaturas,
  obtenerAsignaturaActual
} from "./subjects.js";

// ========================================
// ESTADO DE LOS EJERCICIOS
// ========================================

let preguntaActual = null;
let preguntaLocal = false;
let peticionActual = 0;

// ========================================
// PREGUNTAS LOCALES DE RESPALDO
// ========================================

const preguntasLocales = {
  lateral: [
    {
      pregunta: "¿Cuál es el planeta más grande del sistema solar?",
      respuesta: "jupiter",
      explicacion: "Júpiter es el planeta más grande del sistema solar.",
      pista: "Es un gigante gaseoso."
    },
    {
      pregunta: "¿Cuántos lados tiene un hexágono?",
      respuesta: "6",
      explicacion: "Un hexágono tiene seis lados.",
      pista: "Es un número par."
    }
  ],

  matematicas: [
    {
      pregunta: "¿Cuánto es 8 × 7?",
      respuesta: "56",
      explicacion: "8 multiplicado por 7 es 56.",
      pista: "Suma ocho veces el número siete."
    }
  ],

  geografia: [
    {
      pregunta: "¿Cuál es la capital de España?",
      respuesta: "madrid",
      explicacion: "Madrid es la capital de España.",
      pista: "Está en el centro de la península."
    }
  ]
};

// ========================================
// UTILIDADES
// ========================================

function obtenerElemento(id) {
  return document.getElementById(id);
}

function mostrarMensaje(elemento, mensaje) {
  if (elemento) {
    elemento.textContent = mensaje;
  }
}

// ========================================
// CARGAR PREGUNTA
// ========================================

export async function cargarPregunta() {
  const perfil = obtenerPerfilActual();
  const asignatura = obtenerAsignaturaActual();

  if (!perfil || !asignatura) {
    console.warn("[ACADEMIA] Falta perfil o asignatura");
    return;
  }

  const numeroPeticion = ++peticionActual;

  const prompt = obtenerElemento("challenge-prompt");
  const feedback = obtenerElemento("ai-feedback");
  const boton = obtenerElemento("send-btn");
  const respuesta = obtenerElemento("user-answer");

  if (!prompt || !boton) {
    console.error("[ACADEMIA] Faltan elementos de la pantalla");
    return;
  }

  mostrarMensaje(prompt, "Preparando una pregunta...");
  mostrarMensaje(feedback, "");

  boton.disabled = true;

  preguntaActual = null;
  preguntaLocal = false;

  if (respuesta) {
    respuesta.value = "";
  }

  try {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 15000);

    let data;

    try {
      const response = await fetch("/api/academia/question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          perfil: perfiles[perfil].nombre,
          asignatura: asignaturas[asignatura],
          nivel: perfiles[perfil].nivel
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(
          "El servidor respondió con error " + response.status
        );
      }

      data = await response.json();

    } finally {
      clearTimeout(timeout);
    }

    if (numeroPeticion !== peticionActual) return;

    if (
      !data.ok ||
      !data.pregunta ||
      typeof data.pregunta.pregunta !== "string" ||
      typeof data.pregunta.respuesta !== "string" ||
      typeof data.pregunta.explicacion !== "string" ||
      typeof data.pregunta.pista !== "string"
    ) {
      throw new Error("Respuesta incompleta del servidor");
    }

    preguntaActual = data.pregunta;

    console.log("[ACADEMIA] Pregunta recibida de Gemini");

  } catch (error) {
    if (numeroPeticion !== peticionActual) return;

    console.warn("[ACADEMIA] Gemini no disponible:", error);

    const lista = preguntasLocales[asignatura] || [];

    if (lista.length > 0) {
      const indice = Math.floor(Math.random() * lista.length);

      preguntaActual = lista[indice];
      preguntaLocal = true;

      console.log("[ACADEMIA] Usando pregunta local");

    } else {
      mostrarMensaje(
        prompt,
        "No hay preguntas disponibles. Comprueba la conexión e inténtalo de nuevo."
      );

      boton.disabled = true;
      return;
    }
  }

  if (numeroPeticion !== peticionActual) return;

  if (!preguntaActual) {
    mostrarMensaje(prompt, "No se ha podido preparar la pregunta.");
    boton.disabled = true;
    return;
  }

  mostrarMensaje(prompt, preguntaActual.pregunta);

  if (respuesta) {
    respuesta.value = "";
  }

  boton.disabled = false;
}

// ========================================
// COMPROBACIÓN DE RESPUESTAS
// ========================================

function normalizar(texto) {
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[.,!?¿¡]/g, "")
    .replace(/\s+/g, " ");
}

export function enviarRespuesta() {
  if (!preguntaActual) {
    alert("Primero debes cargar una pregunta.");
    return;
  }

  const campo = obtenerElemento("user-answer");
  const boton = obtenerElemento("send-btn");
  const feedback = obtenerElemento("ai-feedback");

  if (!campo || !feedback) return;

  const respuesta = campo.value.trim();

  if (!respuesta) {
    alert("Escribe una respuesta antes de continuar.");
    return;
  }

  const correcta =
    normalizar(respuesta) === normalizar(preguntaActual.respuesta);

  if (correcta) {
    feedback.textContent =
      "¡Correcto! 🎉 " + preguntaActual.explicacion;
  } else {
    feedback.textContent =
      "No es correcto. La respuesta es: " +
      preguntaActual.respuesta +
      ". " +
      preguntaActual.explicacion;
  }

  if (preguntaLocal) {
    feedback.textContent += " (Pregunta de respaldo local)";
  }

  if (boton) {
    boton.disabled = true;
  }
}

// ========================================
// PISTAS
// ========================================

export function mostrarPista() {
  if (!preguntaActual) return;

  const feedback = obtenerElemento("ai-feedback");

  mostrarMensaje(
    feedback,
    "💡 Pista: " + preguntaActual.pista
  );
}

// ========================================
// SIGUIENTE PREGUNTA
// ========================================

export function siguientePregunta() {
  if (!obtenerAsignaturaActual() || !obtenerPerfilActual()) {
    return;
  }

  cargarPregunta();
}

// ========================================
// CANCELAR PETICIONES PENDIENTES
// ========================================

export function cancelarPregunta() {
  peticionActual++;
  preguntaActual = null;
  preguntaLocal = false;
}

// ========================================
// CONEXIÓN CON EL MENÚ
// ========================================

document.addEventListener("academia:cargar-pregunta", () => {
  cargarPregunta();
});

console.log("[ACADEMIA] Módulo de ejercicios preparado");
