// ========================================
// DEBERES - ACADEMIA CAMPOS
// ========================================

import { obtenerPerfilActual } from "./users.js";

// ========================================
// CONFIGURACIÓN
// ========================================

const API_URL = "/api/academia/homework";
const TOKEN_KEY = "academiaPapaToken";

const ASIGNATURAS = {
  ciencias: "Ciencias",
  matematicas: "Matemáticas",
  lengua: "Lengua",
  geografia: "Geografía",
  historia: "Historia",
  ingles: "Inglés",
  cultura: "Cultura general",
  otras: "Otras"
};

const TIPOS = {
  enlace: "Enlace externo",
  ejercicio: "Ejercicio de Academia",
  escrito: "Tarea escrita"
};

const DESTINATARIOS = {
  leo: "Leo",
  mama: "Mamá"
};

let deberesActuales = [];
let deberEditando = null;

// ========================================
// SESIÓN DE PAPÁ
// ========================================

function obtenerToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function guardarToken(token) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error("[DEBERES] Error guardando sesión:", error);
  }
}

function cerrarSesion() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {}
}

// ========================================
// PETICIONES A LA API
// ========================================

async function solicitarAPI(url, opciones = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(opciones.headers || {})
  };

  if (obtenerPerfilActual() === "papa") {
    const token = obtenerToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const respuesta = await fetch(url, {
    ...opciones,
    headers
  });

  let datos;

  try {
    datos = await respuesta.json();
  } catch {
    throw new Error("El servidor no ha devuelto una respuesta válida.");
  }

  if (!respuesta.ok || datos.ok === false) {
    if (
      respuesta.status === 401 &&
      obtenerPerfilActual() === "papa" &&
      !url.endsWith("/auth")
    ) {
      cerrarSesion();
      mostrarAccesoPapa();
    }

    throw new Error(
      datos.error || "No se ha podido completar la operación."
    );
  }

  return datos;
}

// ========================================
// INICIAR SESIÓN DE PAPÁ
// ========================================

export async function iniciarSesionDeberes() {
  const pinInput = document.getElementById("homework-pin");
  const mensaje = document.getElementById("homework-login-message");
  const boton = document.getElementById("homework-login-btn");

  if (!pinInput || !mensaje || !boton) return;

  const pin = pinInput.value.trim();

  if (!pin) {
    mensaje.textContent = "Introduce el PIN.";
    return;
  }

  boton.disabled = true;
  mensaje.textContent = "Comprobando PIN...";

  try {
    const datos = await solicitarAPI(`${API_URL}/auth`, {
      method: "POST",
      body: JSON.stringify({ pin })
    });

    if (!datos.token) {
      throw new Error("El servidor no ha devuelto el acceso.");
    }

    guardarToken(datos.token);
    pinInput.value = "";
    mensaje.textContent = "";

    document.getElementById("homework-login")
      ?.classList.add("hidden");

    document.getElementById("homework-management")
      ?.classList.remove("hidden");

    await cargarDeberes();

  } catch (error) {
    mensaje.textContent = error.message;
  } finally {
    boton.disabled = false;
  }
}

// ========================================
// CONSULTAR DEBERES
// ========================================

export async function obtenerDeberes(filtros = {}) {
  const parametros = new URLSearchParams();

  if (filtros.perfil) {
    parametros.set("perfil", filtros.perfil);
  }

  if (filtros.asignatura) {
    parametros.set("asignatura", filtros.asignatura);
  }

  if (filtros.estado) {
    parametros.set("estado", filtros.estado);
  }

  const consulta = parametros.toString();

  return solicitarAPI(
    consulta ? `${API_URL}?${consulta}` : API_URL
  );
}

// ========================================
// CREAR DEBER
// ========================================

export async function crearDeber(deber) {
  if (obtenerPerfilActual() !== "papa") {
    throw new Error("Solo Papá puede crear deberes.");
  }

  validarDeber(deber);

  return solicitarAPI(API_URL, {
    method: "POST",
    body: JSON.stringify(deber)
  });
}

// ========================================
// EDITAR DEBER
// ========================================

export async function editarDeber(id, cambios) {
  if (obtenerPerfilActual() !== "papa") {
    throw new Error("Solo Papá puede editar deberes.");
  }

  if (!id) {
    throw new Error("Falta el identificador del deber.");
  }

  return solicitarAPI(`${API_URL}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(cambios)
  });
}

// ========================================
// ELIMINAR DEBER
// ========================================

export async function eliminarDeber(id) {
  if (obtenerPerfilActual() !== "papa") {
    throw new Error("Solo Papá puede eliminar deberes.");
  }

  if (!id) {
    throw new Error("Falta el identificador del deber.");
  }

  return solicitarAPI(`${API_URL}/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

// ========================================
// COMPLETAR DEBER
// ========================================

export async function completarDeber(id) {
  const perfil = obtenerPerfilActual();

  if (!DESTINATARIOS[perfil]) {
    throw new Error("Este perfil no puede completar deberes.");
  }

  if (!id) {
    throw new Error("Falta el identificador del deber.");
  }

  return solicitarAPI(
    `${API_URL}/${encodeURIComponent(id)}/complete`,
    {
      method: "PATCH",
      body: JSON.stringify({ perfil })
    }
  );
}

// ========================================
// VALIDAR DEBER
// ========================================

function validarDeber(deber) {
  if (!deber || typeof deber !== "object") {
    throw new Error("Los datos del deber no son válidos.");
  }

  if (
    typeof deber.titulo !== "string" ||
    !deber.titulo.trim()
  ) {
    throw new Error("El deber necesita un título.");
  }

  if (!ASIGNATURAS[deber.asignatura]) {
    throw new Error("Selecciona una asignatura válida.");
  }

  if (!TIPOS[deber.tipo]) {
    throw new Error("Selecciona un tipo de deber válido.");
  }

  if (!DESTINATARIOS[deber.destinatario]) {
    throw new Error("Selecciona Leo o Mamá como destinatario.");
  }

  if (
    typeof deber.contenido !== "string" ||
    !deber.contenido.trim()
  ) {
    throw new Error("Introduce el contenido del deber.");
  }

  if (deber.tipo === "enlace") {
    try {
      const url = new URL(deber.contenido);

      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error();
      }
    } catch {
      throw new Error("El enlace debe ser una dirección web válida.");
    }
  }

  if (deber.fechaLimite) {
    const fecha = new Date(deber.fechaLimite);

    if (Number.isNaN(fecha.getTime())) {
      throw new Error("La fecha límite no es válida.");
    }
  }
}

// ========================================
// ABRIR PANTALLA DE DEBERES
// ========================================

export function abrirDeberes() {
  const perfil = obtenerPerfilActual();

  if (!perfil) return;

  document.getElementById("profiles-screen")
    ?.classList.add("hidden");

  document.getElementById("subjects-screen")
    ?.classList.add("hidden");

  document.getElementById("challenge-screen")
    ?.classList.add("hidden");

  document.getElementById("homework-screen")
    ?.classList.remove("hidden");

  const titulo = document.getElementById("homework-title");
  const descripcion = document.getElementById("homework-description");

  if (titulo) {
    titulo.textContent = perfil === "papa"
      ? "📚 Gestión de deberes"
      : "📚 Mis deberes";
  }

  if (descripcion) {
    descripcion.textContent = perfil === "papa"
      ? "Consulta, crea y organiza los deberes de la familia."
      : "Aquí encontrarás tus tareas pendientes.";
  }

  if (perfil === "papa") {
    if (obtenerToken()) {
      document.getElementById("homework-login")
        ?.classList.add("hidden");

      document.getElementById("homework-management")
        ?.classList.remove("hidden");

      cargarDeberes();
    } else {
      mostrarAccesoPapa();
    }
  } else {
    document.getElementById("homework-login")
      ?.classList.add("hidden");

    document.getElementById("homework-management")
      ?.classList.add("hidden");

    cargarDeberes();
  }
}

// ========================================
// ACCESO DE PAPÁ
// ========================================

function mostrarAccesoPapa() {
  document.getElementById("homework-login")
    ?.classList.remove("hidden");

  document.getElementById("homework-management")
    ?.classList.add("hidden");

  const lista = document.getElementById("homework-list");

  if (lista) lista.innerHTML = "";

  const mensaje = document.getElementById("homework-login-message");

  if (mensaje) {
    mensaje.textContent = "Introduce tu PIN para continuar.";
  }
}

// ========================================
// VOLVER DESDE DEBERES
// ========================================

export function volverDesdeDeberes() {
  document.getElementById("homework-screen")
    ?.classList.add("hidden");

  document.getElementById("subjects-screen")
    ?.classList.remove("hidden");

  ocultarFormularioDeber();
}

// ========================================
// ESCAPAR TEXTO HTML
// ========================================

function escaparHTML(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[caracter]);
}

// ========================================
// FORMATEAR FECHA
// ========================================

function formatearFecha(valor) {
  if (!valor) return "";

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) return "";

  return fecha.toLocaleDateString("es-ES");
}

// ========================================
// CARGAR DEBERES
// ========================================

export async function cargarDeberes() {
  const perfil = obtenerPerfilActual();
  const lista = document.getElementById("homework-list");
  const mensaje = document.getElementById("homework-message");

  if (!perfil || !lista) return;

  lista.innerHTML = "<p>Cargando deberes...</p>";

  if (mensaje) mensaje.textContent = "";

  try {
    const datos = await obtenerDeberes({ perfil });

    let deberes = datos.deberes || [];

    if (perfil === "papa") {
      const destinatario = document.getElementById(
        "homework-filter-recipient"
      )?.value || "";

      const asignatura = document.getElementById(
        "homework-filter-subject"
      )?.value || "";

      const estado = document.getElementById(
        "homework-filter-state"
      )?.value || "";

      if (destinatario) {
        deberes = deberes.filter(
          deber => deber.destinatario === destinatario
        );
      }

      if (asignatura) {
        deberes = deberes.filter(
          deber => deber.asignatura === asignatura
        );
      }

      if (estado) {
        deberes = deberes.filter(
          deber => deber.estado === estado
        );
      }
    }

    deberesActuales = deberes;
    pintarDeberes(deberes, perfil);

  } catch (error) {
    lista.innerHTML = "";

    if (mensaje) {
      mensaje.textContent = error.message;
    }
  }
}

// ========================================
// MOSTRAR DEBERES
// ========================================

function pintarDeberes(deberes, perfil) {
  const lista = document.getElementById("homework-list");

  if (!lista) return;

  if (!deberes.length) {
    lista.innerHTML = `
      <p class="homework-empty">
        No hay deberes para mostrar.
      </p>
    `;
    return;
  }

  lista.innerHTML = deberes.map(deber => {
    const id = escaparHTML(deber._id);
    const titulo = escaparHTML(deber.titulo);
    const contenido = escaparHTML(deber.contenido);

    const asignatura = escaparHTML(
      ASIGNATURAS[deber.asignatura] || deber.asignatura
    );

    const tipo = escaparHTML(
      TIPOS[deber.tipo] || deber.tipo
    );

    const destinatario = escaparHTML(
      DESTINATARIOS[deber.destinatario] || deber.destinatario
    );

    const fecha = formatearFecha(deber.fechaLimite);
    const completado = deber.estado === "completado";

    let contenidoHTML;

    if (deber.tipo === "enlace") {
      let enlace = "";

      try {
        const url = new URL(deber.contenido);

        if (["http:", "https:"].includes(url.protocol)) {
          enlace = escaparHTML(url.href);
        }
      } catch {}

      contenidoHTML = enlace
        ? `<a href="${enlace}" target="_blank" rel="noopener noreferrer">Abrir enlace ↗</a>`
        : `<p>${contenido}</p>`;
    } else {
      contenidoHTML = `<p>${contenido}</p>`;
    }

    let acciones = "";

    if (perfil === "papa") {
      acciones = `
        <div class="homework-actions">
          <button type="button"
            onclick="editarDeberPantalla('${id}')">
            ✏️ Editar
          </button>

          <button type="button"
            onclick="eliminarDeberPantalla('${id}')">
            🗑️ Eliminar
          </button>
        </div>
      `;
    } else if (!completado) {
      acciones = `
        <button type="button"
          onclick="completarDeberPantalla('${id}')">
          ✓ Marcar como completado
        </button>
      `;
    }

    return `
      <article class="homework-card ${completado ? "homework-completed" : ""}">
        <div class="homework-card-header">
          <h3>${titulo}</h3>
          <span class="homework-status">
            ${completado ? "Completado" : "Pendiente"}
          </span>
        </div>

        <p><strong>Asignatura:</strong> ${asignatura}</p>
        <p><strong>Tipo:</strong> ${tipo}</p>

        ${perfil === "papa"
          ? `<p><strong>Asignado a:</strong> ${destinatario}</p>`
          : ""}

        ${fecha
          ? `<p><strong>Fecha límite:</strong> ${escaparHTML(fecha)}</p>`
          : ""}

        <div class="homework-content">
          ${contenidoHTML}
        </div>

        ${completado && deber.completadoEn
          ? `<p><strong>Completado:</strong> ${escaparHTML(formatearFecha(deber.completadoEn))}</p>`
          : ""}

        ${acciones}
      </article>
    `;
  }).join("");
}
// ========================================
// MOSTRAR FORMULARIO DE CREACIÓN / EDICIÓN
// ========================================

export function mostrarFormularioDeber(id = null) {
  if (obtenerPerfilActual() !== "papa") return;

  deberEditando = id;

  const contenedor = document.getElementById(
    "homework-form-container"
  );

  const formulario = document.getElementById("homework-form");
  const titulo = document.getElementById("homework-form-title");
  const mensaje = document.getElementById("homework-form-message");

  if (!contenedor || !formulario) return;

  formulario.reset();

  document.getElementById("homework-id").value = "";

  if (mensaje) mensaje.textContent = "";

  if (id) {
    const deber = deberesActuales.find(
      elemento => String(elemento._id) === String(id)
    );

    if (!deber) return;

    document.getElementById("homework-id").value = id;
    document.getElementById("homework-title-input").value =
      deber.titulo;

    document.getElementById("homework-subject").value =
      deber.asignatura;

    document.getElementById("homework-type").value =
      deber.tipo;

    document.getElementById("homework-content").value =
      deber.contenido;

    document.getElementById("homework-recipient").value =
      deber.destinatario;

    document.getElementById("homework-deadline").value =
      deber.fechaLimite
        ? String(deber.fechaLimite).slice(0, 10)
        : "";

    if (titulo) titulo.textContent = "Editar deber";

  } else {
    if (titulo) titulo.textContent = "Nuevo deber";
  }

  contenedor.classList.remove("hidden");

  contenedor.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

// ========================================
// OCULTAR FORMULARIO
// ========================================

export function ocultarFormularioDeber() {
  document.getElementById("homework-form-container")
    ?.classList.add("hidden");

  deberEditando = null;
}

// ========================================
// GUARDAR FORMULARIO
// ========================================

async function guardarFormularioDeber(evento) {
  evento.preventDefault();

  if (obtenerPerfilActual() !== "papa") return;

  const boton = document.getElementById("homework-save-btn");
  const mensaje = document.getElementById("homework-form-message");

  const deber = {
    titulo: document.getElementById(
      "homework-title-input"
    ).value.trim(),

    asignatura: document.getElementById(
      "homework-subject"
    ).value,

    tipo: document.getElementById(
      "homework-type"
    ).value,

    contenido: document.getElementById(
      "homework-content"
    ).value.trim(),

    destinatario: document.getElementById(
      "homework-recipient"
    ).value,

    fechaLimite: document.getElementById(
      "homework-deadline"
    ).value || null
  };

  try {
    validarDeber(deber);

    boton.disabled = true;
    mensaje.textContent = "Guardando deber...";

    if (deberEditando) {
      await editarDeber(deberEditando, deber);
      mensaje.textContent = "Deber actualizado correctamente.";
    } else {
      await crearDeber(deber);
      mensaje.textContent = "Deber creado correctamente.";
    }

    ocultarFormularioDeber();
    await cargarDeberes();

  } catch (error) {
    mensaje.textContent = error.message;
  } finally {
    boton.disabled = false;
  }
}

// ========================================
// EDITAR DESDE LA TARJETA
// ========================================

export function editarDeberPantalla(id) {
  mostrarFormularioDeber(id);
}

// ========================================
// ELIMINAR DESDE LA TARJETA
// ========================================

export async function eliminarDeberPantalla(id) {
  if (obtenerPerfilActual() !== "papa") return;

  const confirmar = window.confirm(
    "¿Seguro que quieres eliminar este deber?"
  );

  if (!confirmar) return;

  const mensaje = document.getElementById("homework-message");

  try {
    if (mensaje) mensaje.textContent = "Eliminando deber...";

    await eliminarDeber(id);

    if (mensaje) mensaje.textContent = "Deber eliminado.";

    await cargarDeberes();

  } catch (error) {
    if (mensaje) mensaje.textContent = error.message;
  }
}

// ========================================
// COMPLETAR DESDE LA TARJETA
// ========================================

export async function completarDeberPantalla(id) {
  const perfil = obtenerPerfilActual();

  if (!DESTINATARIOS[perfil]) return;

  const mensaje = document.getElementById("homework-message");

  try {
    if (mensaje) mensaje.textContent = "Actualizando deber...";

    await completarDeber(id);

    if (mensaje) {
      mensaje.textContent = "¡Deber completado!";
    }

    await cargarDeberes();

  } catch (error) {
    if (mensaje) mensaje.textContent = error.message;
  }
}

// ========================================
// INICIALIZACIÓN
// ========================================

export function iniciarDeberes() {
  const formulario = document.getElementById("homework-form");

  if (formulario) {
    formulario.addEventListener(
      "submit",
      guardarFormularioDeber
    );
  }

  const filtroDestinatario = document.getElementById(
    "homework-filter-recipient"
  );

  const filtroAsignatura = document.getElementById(
    "homework-filter-subject"
  );

  const filtroEstado = document.getElementById(
    "homework-filter-state"
  );

  [
    filtroDestinatario,
    filtroAsignatura,
    filtroEstado
  ].forEach(control => {
    control?.addEventListener("change", () => {
      if (obtenerPerfilActual() === "papa") {
        cargarDeberes();
      }
    });
  });

  // Conectar las funciones utilizadas por los botones del HTML.
  window.abrirDeberes = abrirDeberes;
  window.volverDesdeDeberes = volverDesdeDeberes;
  window.iniciarSesionDeberes = iniciarSesionDeberes;
  window.mostrarFormularioDeber = mostrarFormularioDeber;
  window.ocultarFormularioDeber = ocultarFormularioDeber;
  window.cargarDeberes = cargarDeberes;
  window.editarDeberPantalla = editarDeberPantalla;
  window.eliminarDeberPantalla = eliminarDeberPantalla;
  window.completarDeberPantalla = completarDeberPantalla;

  console.log("[DEBERES] Módulo iniciado correctamente.");
}