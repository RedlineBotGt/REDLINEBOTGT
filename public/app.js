// =======================================
// ACADEMIA CAMPOS
// ARCHIVO PRINCIPAL DE LA APLICACIÓN
// =======================================

import {
  iniciarMenu,
  abrirPerfil,
  abrirAsignatura,
  volverAsignaturas,
  volverPerfiles
} from "./js/menu.js";

import {
  enviarRespuesta,
  mostrarPista,
  siguientePregunta,
  cancelarPregunta
} from "./js/challenges.js";

import {
  iniciarRanking
} from "./js/ranking.js";

import {
  iniciarDeberes
} from "./js/homework.js";

import { iniciarAvisos } from "./js/notices.js";

import {
  iniciarChat,
  abrirChat,
  volverDesdeChat
} from "./js/chat.js";

// ========================================
// CONEXIÓN CON LOS BOTONES DEL HTML
// ========================================

// Selección de perfil.
window.seleccionarPerfil = function(perfil) {
  abrirPerfil(perfil);
};

// Selección de asignatura.
window.abrirAsignatura = function(asignatura) {
  abrirAsignatura(asignatura);
};

// Volver a la selección de asignaturas.
window.volverAsignaturas = function() {
  cancelarPregunta();
  volverAsignaturas();
};

// Volver a la selección de perfiles.
window.volverPerfiles = function() {
  cancelarPregunta();
  volverPerfiles();
};

// Abrir y cerrar el chat familiar.
window.abrirChat = function() {
  abrirChat();
};

window.volverDesdeChat = function() {
  volverDesdeChat();
};

// Comprobar respuesta.
window.enviarRespuesta = function() {
  enviarRespuesta();
};

// Mostrar pista.
window.mostrarPista = function() {
  mostrarPista();
};

// Cargar siguiente pregunta.
window.siguientePregunta = function() {
  siguientePregunta();
};

// ========================================
// INICIALIZACIÓN GENERAL
// ========================================

function iniciarAcademia() {
  console.log("--------------------------------");
  console.log("🎓 ACADEMIA CAMPOS");
  console.log("--------------------------------");

  try {
    iniciarMenu();
    iniciarRanking();
    iniciarDeberes();
    iniciarChat();
    iniciarAvisos();

    console.log("[ACADEMIA] Todos los módulos iniciados.");

  } catch (error) {
    console.error(
      "[ACADEMIA] Error al iniciar la aplicación:",
      error
    );
  }
}

// ========================================
// ARRANQUE
// ========================================

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    iniciarAcademia,
    { once: true }
  );
} else {
  iniciarAcademia();
}