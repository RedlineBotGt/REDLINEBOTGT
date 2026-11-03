// ========================================
// NAVEGACIÓN DE ACADEMIA CAMPOS
// ========================================

import {
  obtenerPerfilActual,
  seleccionarPerfil,
  cerrarPerfil
} from "./users.js";

import {
  seleccionarAsignatura,
  cerrarAsignatura
} from "./subjects.js";

// ========================================
// UTILIDADES DE INTERFAZ
// ========================================

export function mostrarPantalla(id) {
  document.querySelectorAll(".screen").forEach(pantalla => {
    pantalla.classList.add("hidden");
  });

  const pantalla = document.getElementById(id);

  if (pantalla) {
    pantalla.classList.remove("hidden");
  } else {
    console.warn(
      "[ACADEMIA] No existe la pantalla:",
      id
    );
  }
}

// ========================================
// SELECCIÓN DE PERFIL
// ========================================

export function abrirPerfil(perfil) {
  const seleccionado = seleccionarPerfil(perfil);

  if (!seleccionado) {
    return;
  }

  mostrarPantalla("subjects-screen");
}

// ========================================
// ABRIR ASIGNATURA
// ========================================

export function abrirAsignatura(asignatura) {
  const perfil = obtenerPerfilActual();

  if (!perfil) {
    console.warn(
      "[ACADEMIA] Debes seleccionar un perfil primero"
    );

    mostrarPantalla("profiles-screen");
    return;
  }

  const seleccionada = seleccionarAsignatura(asignatura);

  if (!seleccionada) {
    return;
  }

  mostrarPantalla("challenge-screen");

  document.dispatchEvent(
    new CustomEvent("academia:cargar-pregunta")
  );
}

// ========================================
// VOLVER A ASIGNATURAS
// ========================================

export function volverAsignaturas() {
  if (!obtenerPerfilActual()) {
    mostrarPantalla("profiles-screen");
    return;
  }

  mostrarPantalla("subjects-screen");
}

// ========================================
// VOLVER A PERFILES
// ========================================

export function volverPerfiles() {
  cerrarAsignatura();
  cerrarPerfil();

  mostrarPantalla("profiles-screen");

  console.log(
    "[ACADEMIA] Regreso al menú de perfiles"
  );
}

// ========================================
// INICIALIZACIÓN DEL MENÚ
// ========================================

export function iniciarMenu() {
  document.querySelectorAll("[data-perfil]").forEach(boton => {
    boton.addEventListener("click", () => {
      abrirPerfil(boton.dataset.perfil);
    });
  });

  document.querySelectorAll("[data-asignatura]").forEach(boton => {
    boton.addEventListener("click", () => {
      abrirAsignatura(boton.dataset.asignatura);
    });
  });

  document.querySelectorAll("[data-volver-perfiles]").forEach(boton => {
    boton.addEventListener("click", volverPerfiles);
  });

  document.querySelectorAll("[data-volver-asignaturas]").forEach(boton => {
    boton.addEventListener("click", volverAsignaturas);
  });

  mostrarPantalla("profiles-screen");

  console.log(
    "[ACADEMIA] Menú iniciado correctamente"
  );
}