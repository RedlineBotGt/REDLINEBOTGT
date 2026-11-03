// ========================================
// PERFILES DE ACADEMIA CAMPOS
// ========================================

export const perfiles = {
  leo: {
    nombre: "Leo",
    nivel: "Primaria"
  },

  papa: {
    nombre: "Papá",
    nivel: "Adulto"
  },

  mama: {
    nombre: "Mamá",
    nivel: "Adulto"
  }
};

// ========================================
// PERFIL ACTUAL
// ========================================

export let perfilActual = null;

// ========================================
// RECUPERAR PERFIL GUARDADO
// ========================================

function recuperarPerfilGuardado() {
  try {
    const perfilGuardado = localStorage.getItem("academiaPerfil");

    if (perfilGuardado && perfiles[perfilGuardado]) {
      perfilActual = perfilGuardado;

      console.log(
        "[ACADEMIA] Perfil recuperado:",
        perfiles[perfilGuardado].nombre
      );
    } else {
      perfilActual = null;
    }
  } catch (error) {
    perfilActual = null;

    console.warn(
      "[ACADEMIA] No se pudo recuperar el perfil:",
      error
    );
  }
}

// Recuperar el perfil al cargar el módulo.
recuperarPerfilGuardado();

// ========================================
// SELECCIONAR PERFIL
// ========================================

export function seleccionarPerfil(perfil) {
  if (!perfiles[perfil]) {
    console.warn(
      "[ACADEMIA] Perfil desconocido:",
      perfil
    );

    return false;
  }

  perfilActual = perfil;

  try {
    localStorage.setItem("academiaPerfil", perfil);
  } catch (error) {
    console.warn(
      "[ACADEMIA] No se pudo guardar el perfil:",
      error
    );
  }

  const nombre = document.getElementById("profile-name");

  if (nombre) {
    nombre.textContent = perfiles[perfil].nombre;
  }

  console.log(
    "[ACADEMIA] Perfil seleccionado:",
    perfiles[perfil].nombre
  );

  return true;
}

// ========================================
// CONSULTAR PERFIL ACTUAL
// ========================================

export function obtenerPerfilActual() {
  return perfilActual;
}

// ========================================
// CERRAR PERFIL
// ========================================

export function cerrarPerfil() {
  perfilActual = null;

  try {
    localStorage.removeItem("academiaPerfil");
  } catch (error) {
    console.warn(
      "[ACADEMIA] No se pudo borrar el perfil guardado:",
      error
    );
  }

  console.log("[ACADEMIA] Perfil cerrado");
}