import { obtenerPerfilActual } from "./users.js";
import { obtenerAsignaturaActual } from "./subjects.js";

// ========================================
// ESTADO DE LOS EJERCICIOS
// ========================================

let retoActual = null;
let peticionActual = 0;
let respuestaEvaluada = false;
let controllerActual = null;

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

function mostrarVisual(visual) {
  const contenedor = obtenerElemento("challenge-visual");
  if (!contenedor) return;
  contenedor.replaceChildren();
  if (!visual || !Array.isArray(visual.items) || visual.items.length === 0) {
    contenedor.classList.add("hidden");
    contenedor.removeAttribute("aria-label");
    return;
  }
  let total = 0;
  for (const item of visual.items.slice(0, 4)) {
    if (!item || typeof item.emoji !== "string" || !item.emoji.trim()) continue;
    const cantidad = Math.max(1, Math.min(12, Math.floor(Number(item.count) || 1)));
    for (let i = 0; i < cantidad && total < 18; i++, total++) {
      const objeto = document.createElement("span");
      objeto.className = "challenge-visual-item";
      objeto.textContent = item.emoji;
      objeto.setAttribute("aria-hidden", "true");
      contenedor.appendChild(objeto);
    }
  }
  if (total === 0) {
    contenedor.classList.add("hidden");
    return;
  }
  contenedor.setAttribute("aria-label",
    typeof visual.alt === "string" && visual.alt.trim()
      ? visual.alt : "Ilustración del ejercicio");
  contenedor.classList.remove("hidden");
}

function obtenerPerfilValido() {
  const perfil = obtenerPerfilActual();

  if (!["leo", "papa", "mama"].includes(perfil)) {
    throw new Error(
      "No se ha seleccionado un perfil válido."
    );
  }

  return perfil;
}

function obtenerAsignaturaValida() {
  const asignatura = obtenerAsignaturaActual();

  // Compatibilidad: la clave antigua lateral corresponde
  // exclusivamente a Cultura general.
  if (
    asignatura === "lateral" ||
    asignatura === "cultura" ||
    asignatura === "cultura_general"
  ) {
    return "cultura_general";
  }

  if (asignatura === "pensamiento_lateral") {
    return "pensamiento_lateral";
  }

  if (asignatura === "matematicas") {
    return "matematicas";
  }

  if (asignatura === "geografia") {
    return "geografia";
  }

  if (asignatura === "english") {
    return "english";
  }

  if (asignatura === "lengua") {
    return "lengua";
  }

  throw new Error(
    "Selecciona una asignatura válida."
  );
}

async function realizarPeticion(
  url,
  datos,
  numeroPeticion
) {
  const controller = new AbortController();
  controllerActual = controller;

  const timeout = setTimeout(() => {
    controller.abort();
  }, 40000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(datos),
      signal: controller.signal
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "El servidor ha devuelto una respuesta no válida."
      );
    }

    if (numeroPeticion !== peticionActual) {
      return null;
    }

    if (!response.ok || data.ok === false) {
      const error = new Error(
        data.error ||
        data.message ||
        "Error del servidor: " + response.status
      );
      error.status = response.status;
      throw error;
    }

    return data;

  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        "La operación ha tardado demasiado. Inténtalo de nuevo."
      );
    }

    throw error;

  } finally {
    clearTimeout(timeout);

    if (controllerActual === controller) {
      controllerActual = null;
    }
  }
}

// ========================================
// CARGAR PREGUNTA
// ========================================

export async function cargarPregunta() {
  const prompt = obtenerElemento("challenge-prompt");
  const feedback = obtenerElemento("ai-feedback");
  const boton = obtenerElemento("send-btn");
  const botonSiguiente = obtenerElemento("next-btn");
  const campo = obtenerElemento("user-answer");

  if (!prompt || !boton) {
    console.error(
      "[ACADEMIA] Faltan elementos de la pantalla."
    );
    return;
  }

  const numeroPeticion = ++peticionActual;

  if (controllerActual) {
    controllerActual.abort();
    controllerActual = null;
  }

  retoActual = null;
  respuestaEvaluada = false;
  mostrarVisual(null);

  boton.disabled = true;

  if (botonSiguiente) {
    botonSiguiente.disabled = true;
  }

  if (campo) {
    campo.value = "";
    campo.disabled = true;
  }

  mostrarMensaje(
    prompt,
    "La IA está preparando un ejercicio..."
  );

  mostrarMensaje(feedback, "");

  try {
    const perfil = obtenerPerfilValido();
    const asignatura = obtenerAsignaturaValida();

    const data = await realizarPeticion(
      "/api/academia/question",
      {
        perfil,
        asignatura
      },
      numeroPeticion
    );

    if (numeroPeticion !== peticionActual || !data) {
      return;
    }

    if (
      !data.reto ||
      typeof data.reto.id !== "string" ||
      typeof data.reto.prompt !== "string" ||
      typeof data.reto.hint !== "string"
    ) {
      throw new Error(
        "La IA no ha devuelto un ejercicio completo."
      );
    }

    retoActual = data.reto;

    mostrarMensaje(prompt, retoActual.prompt);
    mostrarVisual(retoActual.visual);
    mostrarMensaje(feedback, "");

    if (campo) {
      campo.value = "";
      campo.disabled = false;
    }

    boton.disabled = false;

    console.log(
      `[ACADEMIA] Ejercicio de ${asignatura} recibido para ${perfil}.`
    );

  } catch (error) {
    if (numeroPeticion !== peticionActual) {
      return;
    }

    console.error(
      "[ACADEMIA] Error al generar ejercicio:",
      error
    );

    mostrarMensaje(
      prompt,
      "No se ha podido generar el ejercicio."
    );

    mostrarMensaje(
      feedback,
      error.message ||
      "Comprueba la conexión e inténtalo de nuevo."
    );

    boton.disabled = true;

    if (botonSiguiente) {
      botonSiguiente.disabled = true;
    }

    if (campo) {
      campo.disabled = true;
    }
  }
}

// ========================================
// EVALUAR RESPUESTA CON IA
// ========================================

export async function enviarRespuesta() {
  if (!retoActual || respuestaEvaluada) {
    return;
  }

  const campo = obtenerElemento("user-answer");
  const boton = obtenerElemento("send-btn");
  const botonSiguiente = obtenerElemento("next-btn");
  const feedback = obtenerElemento("ai-feedback");

  if (!campo || !feedback) {
    return;
  }

  const respuesta = campo.value.trim();

  if (!respuesta) {
    alert("Escribe una respuesta antes de continuar.");
    return;
  }

  const numeroPeticion = ++peticionActual;

  if (boton) {
    boton.disabled = true;
  }

  campo.disabled = true;

  mostrarMensaje(
    feedback,
    "La IA está evaluando tu respuesta..."
  );

  try {
    const perfil = obtenerPerfilValido();
    const asignatura = obtenerAsignaturaValida();

    const data = await realizarPeticion(
      "/api/academia/answer",
      {
        perfil,
        asignatura,
        retoId: retoActual.id,
        respuesta
      },
      numeroPeticion
    );

    if (numeroPeticion !== peticionActual || !data) {
      return;
    }

    if (
      !data.evaluacion ||
      typeof data.evaluacion.correct !== "boolean"
    ) {
      throw new Error(
        "La IA no ha podido evaluar correctamente la respuesta."
      );
    }

    const evaluacion = data.evaluacion;

    respuestaEvaluada = evaluacion.correct;

    const resultado = evaluacion.correct
      ? "¡Correcto! 🎉 "
      : "Todavía no es correcto. ";

    const explicacion =
      evaluacion.explanation ||
      evaluacion.feedback ||
      "";

    mostrarMensaje(
      feedback,
      resultado +
      (evaluacion.feedback || "") +
      (explicacion ? " " + explicacion : "")
    );

    if (evaluacion.correct) {
      campo.disabled = true;

      if (botonSiguiente) {
        botonSiguiente.disabled = false;
      }

      if (boton) {
        boton.disabled = true;
      }
    } else {
      // Si falla, puede leer la explicación y volver a intentarlo.
      campo.disabled = false;
      campo.focus();

      if (boton) {
        boton.disabled = false;
      }

      if (botonSiguiente) {
        botonSiguiente.disabled = true;
      }
    }

    console.log(
      "[ACADEMIA] Respuesta evaluada:",
      evaluacion.correct
    );

  } catch (error) {
    if (numeroPeticion !== peticionActual) {
      return;
    }

    console.error(
      "[ACADEMIA] Error al evaluar:",
      error
    );

    if (error.status === 404) {
      // El ejercicio anterior se perdió o caducó en el servidor.
      // Permitimos descartarlo y continuar sin marcarlo como acertado.
      respuestaEvaluada = true;
      mostrarMensaje(
        feedback,
        "Este ejercicio ya no está disponible. Puedes pasar a una pregunta nueva."
      );
      campo.disabled = true;

      if (boton) {
        boton.disabled = true;
      }

      if (botonSiguiente) {
        botonSiguiente.disabled = false;
      }
    } else {
      mostrarMensaje(
        feedback,
        "No se ha podido evaluar la respuesta. " +
        (error.message || "Inténtalo de nuevo.")
      );

      campo.disabled = false;

      if (botonSiguiente) {
        botonSiguiente.disabled = true;
      }
    }

  } finally {
    if (
      numeroPeticion === peticionActual &&
      boton &&
      !respuestaEvaluada
    ) {
      boton.disabled = false;
    }
  }
}

// ========================================
// MOSTRAR PISTA
// ========================================

export function mostrarPista() {
  if (!retoActual) {
    return;
  }

  const feedback = obtenerElemento("ai-feedback");

  mostrarMensaje(
    feedback,
    "💡 Pista: " + retoActual.hint
  );
}

// ========================================
// SIGUIENTE PREGUNTA
// ========================================

export function siguientePregunta() {
  if (!respuestaEvaluada) {
    return;
  }

  if (
    !obtenerPerfilActual() ||
    !obtenerAsignaturaActual()
  ) {
    return;
  }

  cargarPregunta();
}

// ========================================
// CANCELAR PETICIONES PENDIENTES
// ========================================

export function cancelarPregunta() {
  peticionActual++;

  if (controllerActual) {
    controllerActual.abort();
    controllerActual = null;
  }

  retoActual = null;
  respuestaEvaluada = false;
}

// ========================================
// CONEXIÓN CON EL MENÚ
// ========================================

document.addEventListener(
  "academia:cargar-pregunta",
  () => {
    cargarPregunta();
  }
);

console.log(
  "[ACADEMIA] Módulo de ejercicios preparado."
);