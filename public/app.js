// ========================================
// ACADEMIA CAMPOS - APLICACIÓN PRINCIPAL
// ========================================

const perfiles = {
  leo: { nombre: "Leo" },
  papa: { nombre: "Papá" },
  mama: { nombre: "Mamá" }
};

const asignaturas = {
  lateral: "Cultura general",
  matematicas: "Matemáticas",
  geografia: "Geografía"
};

let perfilActual = null;
let asignaturaActual = null;
let preguntaActual = null;
let respuestasCorrectas = 0;
let preguntasRespondidas = 0;

// Banco provisional de preguntas.
// Más adelante lo conectaremos con Gemini y MongoDB.
const preguntas = {
  lateral: [
    {
      pregunta: "¿Cuál es el planeta más grande del sistema solar?",
      respuesta: "jupiter",
      explicacion: "Júpiter es el planeta más grande del sistema solar."
    },
    {
      pregunta: "¿Cuántos lados tiene un hexágono?",
      respuesta: "6",
      explicacion: "Un hexágono tiene seis lados."
    },
    {
      pregunta: "¿Qué animal es el mamífero más grande del mundo?",
      respuesta: "ballena azul",
      explicacion: "La ballena azul es el animal más grande conocido."
    }
  ],
  matematicas: [
    {
      pregunta: "¿Cuánto es 8 × 7?",
      respuesta: "56",
      explicacion: "8 multiplicado por 7 es 56."
    },
    {
      pregunta: "¿Cuánto es 125 + 75?",
      respuesta: "200",
      explicacion: "125 más 75 es 200."
    }
  ],
  geografia: [
    {
      pregunta: "¿Cuál es la capital de España?",
      respuesta: "madrid",
      explicacion: "Madrid es la capital de España."
    },
    {
      pregunta: "¿En qué continente está Egipto?",
      respuesta: "africa",
      explicacion: "Egipto está situado principalmente en África."
    }
  ]
};

// ========================================
// CAMBIAR DE PANTALLA
// ========================================

function mostrarPantalla(id) {
  document.querySelectorAll(".screen").forEach(pantalla => {
    pantalla.classList.add("hidden");
  });

  const pantalla = document.getElementById(id);

  if (pantalla) {
    pantalla.classList.remove("hidden");
  }
}

// ========================================
// SELECCIONAR PERFIL
// ========================================

function seleccionarPerfil(perfil) {
  if (!perfiles[perfil]) return;

  perfilActual = perfil;

  localStorage.setItem("academiaPerfil", perfil);

  document.getElementById("profile-name").textContent =
    perfiles[perfil].nombre;

  mostrarPantalla("subjects-screen");
}

// ========================================
// ABRIR ASIGNATURA
// ========================================

function abrirAsignatura(asignatura) {
  if (!perfilActual) return;

  if (!preguntas[asignatura]) {
    alert("Esta asignatura todavía no tiene preguntas.");
    return;
  }

  asignaturaActual = asignatura;

  document.getElementById("challenge-title").textContent =
    asignaturas[asignatura];

  mostrarPantalla("challenge-screen");

  cargarPregunta();
}

// ========================================
// CARGAR PREGUNTA
// ========================================

function cargarPregunta() {
  const lista = preguntas[asignaturaActual];

  if (!lista || lista.length === 0) {
    document.getElementById("challenge-prompt").textContent =
      "No hay preguntas disponibles.";

    return;
  }

  preguntaActual =
    lista[Math.floor(Math.random() * lista.length)];

  document.getElementById("challenge-prompt").textContent =
    preguntaActual.pregunta;

  document.getElementById("user-answer").value = "";

  document.getElementById("ai-feedback").textContent = "";

  document.getElementById("send-btn").disabled = false;
}

// ========================================
// COMPROBAR RESPUESTA
// ========================================

function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function enviarRespuesta() {
  if (!preguntaActual) return;

  const respuesta = document
    .getElementById("user-answer")
    .value;

  if (!respuesta.trim()) {
    alert("Escribe una respuesta antes de continuar.");
    return;
  }

  const correcta =
    normalizar(respuesta) ===
    normalizar(preguntaActual.respuesta);

  preguntasRespondidas++;

  if (correcta) {
    respuestasCorrectas++;
  }

  const feedback = document.getElementById("ai-feedback");

  if (correcta) {
    feedback.textContent =
      "¡Correcto! 🎉 " + preguntaActual.explicacion;
  } else {
    feedback.textContent =
      "Todavía no. La respuesta correcta es: " +
      preguntaActual.respuesta +
      ". " +
      preguntaActual.explicacion;
  }

  document.getElementById("send-btn").disabled = true;

  guardarProgreso();
}

// ========================================
// GUARDAR PROGRESO PROVISIONAL
// ========================================

function guardarProgreso() {
  if (!perfilActual) return;

  const progreso = JSON.parse(
    localStorage.getItem("academiaProgreso") || "{}"
  );

  progreso[perfilActual] = {
    correctas: respuestasCorrectas,
    respondidas: preguntasRespondidas
  };

  localStorage.setItem(
    "academiaProgreso",
    JSON.stringify(progreso)
  );
}

// ========================================
// VOLVER A ASIGNATURAS
// ========================================

function volverAsignaturas() {
  mostrarPantalla("subjects-screen");
}

// ========================================
// SIGUIENTE PREGUNTA
// ========================================

function siguientePregunta() {
  cargarPregunta();
}

// ========================================
// INICIAR APLICACIÓN
// ========================================

document.addEventListener("DOMContentLoaded", () => {
  const perfilGuardado =
    localStorage.getItem("academiaPerfil");

  if (perfilGuardado && perfiles[perfilGuardado]) {
    seleccionarPerfil(perfilGuardado);
  } else {
    mostrarPantalla("profiles-screen");
  }
});

// ========================================
// FUNCIONES DISPONIBLES DESDE HTML
// ========================================

window.seleccionarPerfil = seleccionarPerfil;
window.abrirAsignatura = abrirAsignatura;
window.enviarRespuesta = enviarRespuesta;
window.volverAsignaturas = volverAsignaturas;
window.siguientePregunta = siguientePregunta;