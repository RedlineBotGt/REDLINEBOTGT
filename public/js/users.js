
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
// SELECCIONAR PERFIL
// ========================================

export function seleccionarPerfil(perfil) {
  if (!perfiles[perfil]) {
    console.warn("[ACADEMIA] Perfil desconocido:", perfil);
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

  console.log("[ACADEMIA] Perfil cerrado");
}
