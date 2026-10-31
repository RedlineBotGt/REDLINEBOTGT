
const perfiles = {
  leo: { nombre: "Leo", nivel: "Primaria" },
  papa: { nombre: "Papá", nivel: "Adulto" },
  mama: { nombre: "Mamá", nivel: "Adulto" }
};

const asignaturas = {
  lateral: "Cultura general",
  matematicas: "Matemáticas",
  geografia: "Geografía"
};

let perfilActual = null;
let asignaturaActual = null;
let preguntaActual = null;
let preguntaLocal = false;

const preguntasLocales = {
  lateral: [
    {
      pregunta: "¿Cuál es el planeta más grande del sistema solar?",
      respuesta: "jupiter",
      explicacion: "Júpiter es el planeta más grande.",
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

function mostrarPantalla(id) {
  document.querySelectorAll(".screen").forEach(pantalla => {
    pantalla.classList.add("hidden");
  });

  document.getElementById(id)?.classList.remove("hidden");
}

function seleccionarPerfil(perfil) {
  if (!perfiles[perfil]) return;

  perfilActual = perfil;
  localStorage.setItem("academiaPerfil", perfil);

  document.getElementById("profile-name").textContent =
    perfiles[perfil].nombre;

  mostrarPantalla("subjects-screen");
}

function abrirAsignatura(asignatura) {
  if (!perfilActual || !asignaturas[asignatura]) return;

  asignaturaActual = asignatura;

  document.getElementById("challenge-title").textContent =
    asignaturas[asignatura];

  mostrarPantalla("challenge-screen");

  cargarPregunta();
}

async function cargarPregunta() {
  const prompt = document.getElementById("challenge-prompt");
  const feedback = document.getElementById("ai-feedback");
  const boton = document.getElementById("send-btn");

  prompt.textContent = "Preparando una pregunta...";
  feedback.textContent = "";
  boton.disabled = true;

  preguntaActual = null;
  preguntaLocal = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let response;

    try {
      response = await fetch("/api/academia/question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          perfil: perfiles[perfilActual].nombre,
          asignatura: asignaturas[asignaturaActual],
          nivel: perfiles[perfilActual].nivel
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error("El servidor respondió con error " + response.status);
    }

    const data = await response.json();

    if (!data.ok || !data.pregunta?.pregunta) {
      throw new Error("Respuesta no válida del servidor");
    }

    preguntaActual = data.pregunta;

  } catch (error) {
    console.warn("[ACADEMIA] Gemini no disponible:", error);

    const lista = preguntasLocales[asignaturaActual] || [];

    if (lista.length > 0) {
      preguntaActual =
        lista[Math.floor(Math.random() * lista.length)];

      preguntaLocal = true;
    }
  }

  if (!preguntaActual) {
    prompt.textContent =
      "No hay preguntas disponibles. Comprueba tu conexión e inténtalo de nuevo.";

    return;
  }

  prompt.textContent = preguntaActual.pregunta;
  document.getElementById("user-answer").value = "";

  boton.disabled = false;
}

function normalizar(texto) {
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[.,!?¿¡]/g, "");
}

function enviarRespuesta() {
  if (!preguntaActual) return;

  const respuesta =
    document.getElementById("user-answer").value;

  if (!respuesta.trim()) {
    alert("Escribe una respuesta antes de continuar.");
    return;
  }

  const correcta =
    normalizar(respuesta) === normalizar(preguntaActual.respuesta);

  const feedback = document.getElementById("ai-feedback");

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

  document.getElementById("send-btn").disabled = true;
}

function mostrarPista() {
  if (!preguntaActual) return;

  document.getElementById("ai-feedback").textContent =
    "💡 Pista: " + preguntaActual.pista;
}

function volverAsignaturas() {
  mostrarPantalla("subjects-screen");
}

function siguientePregunta() {
  cargarPregunta();
}

document.addEventListener("DOMContentLoaded", () => {
  const guardado = localStorage.getItem("academiaPerfil");

  if (guardado && perfiles[guardado]) {
    seleccionarPerfil(guardado);
  } else {
    mostrarPantalla("profiles-screen");
  }

  const botonPista = document.getElementById("hint-btn");

  if (botonPista) {
    botonPista.addEventListener("click", mostrarPista);
  }
});

window.seleccionarPerfil = seleccionarPerfil;
window.abrirAsignatura = abrirAsignatura;
window.enviarRespuesta = enviarRespuesta;
window.volverAsignaturas = volverAsignaturas;
window.siguientePregunta = siguientePregunta;
window.mostrarPista = mostrarPista;
