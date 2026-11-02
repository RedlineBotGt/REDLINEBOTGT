import {
  ASIGNATURAS,
  TIPOS,
  DESTINATARIOS
} from "./api.js";

/**
 * Escapa texto para evitar que se interprete como HTML.
 */
export function escaparHTML(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, caracter => {
    const entidades = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entidades[caracter];
  });
}

/**
 * Formatea una fecha para mostrarla en las tarjetas.
 */
export function formatearFecha(fecha) {
  if (!fecha) return "";

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return "";
  }

  return valor.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

/**
 * Comprueba que un enlace sea seguro y válido.
 */
function obtenerEnlaceSeguro(contenido) {
  try {
    const url = new URL(String(contenido));

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return "";
    }

    return url.href;
  } catch {
    return "";
  }
}

/**
 * Genera el botón para abrir un enlace.
 */
function pintarEnlace(deber) {
  if (deber.tipo !== "enlace") {
    return "";
  }

  const enlace = obtenerEnlaceSeguro(deber.contenido);

  if (!enlace) {
    return `
      <p class="homework-invalid-link">
        Este enlace no es válido.
      </p>
    `;
  }

  return `
    <div class="homework-link-container">
      <a
        class="homework-link-button"
        href="${escaparHTML(enlace)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        🔗 Abrir enlace
      </a>
    </div>
  `;
}

/**
 * Genera las acciones disponibles para cada perfil.
 */
function pintarAcciones(deber, perfil) {
  const id = escaparHTML(deber._id || "");
  const completado = deber.estado === "completado";

  if (perfil === "papa") {
    return `
      <div class="homework-actions">

        <button
          type="button"
          class="homework-action-button"
          onclick="editarDeberPantalla('${id}')"
        >
          ✏️ Editar
        </button>

        <button
          type="button"
          class="homework-action-button"
          onclick="eliminarDeberPantalla('${id}')"
        >
          🗑️ Eliminar
        </button>

        ${
          completado
            ? `
              <button
                type="button"
                class="homework-action-button"
                onclick="reabrirDeberPantalla('${id}')"
              >
                ↩️ Reabrir deber
              </button>
            `
            : ""
        }

      </div>
    `;
  }

  if (completado) {
    return `
      <div class="homework-actions">
        <button
          type="button"
          class="homework-action-button"
          onclick="reabrirDeberPantalla('${id}')"
        >
          ↩️ Reabrir deber
        </button>
      </div>
    `;
  }

  return `
    <div class="homework-actions">
      <button
        type="button"
        class="homework-action-button"
        onclick="completarDeberPantalla('${id}')"
      >
        ✓ Marcar como completado
      </button>
    </div>
  `;
}

/**
 * Dibuja todas las tarjetas de deberes.
 */
export function pintarDeberes(deberes, perfil) {
  const lista = document.getElementById("homework-list");

  if (!lista) return;

  if (!Array.isArray(deberes) || deberes.length === 0) {
    lista.innerHTML = `
      <p class="homework-empty">
        No hay deberes para mostrar.
      </p>
    `;
    return;
  }

  lista.innerHTML = deberes.map(deber => {
    const titulo = escaparHTML(deber.titulo);
    const asignatura = escaparHTML(
      ASIGNATURAS[deber.asignatura] || deber.asignatura
    );
    const tipo = escaparHTML(
      TIPOS[deber.tipo] || deber.tipo
    );
    const destinatario = escaparHTML(
      DESTINATARIOS[deber.destinatario] ||
      deber.destinatario
    );
    const contenido = escaparHTML(deber.contenido);

    const fecha = formatearFecha(deber.fechaLimite);
    const completado = deber.estado === "completado";

    return `
      <article class="homework-card">

        <div class="homework-card-header">
          <h3>${titulo}</h3>

          <span class="homework-status ${
            completado
              ? "homework-status-completed"
              : "homework-status-pending"
          }">
            ${completado ? "Completado" : "Pendiente"}
          </span>
        </div>

        <div class="homework-card-details">
          <span>${asignatura}</span>
          <span>${tipo}</span>
          <span>Para: ${destinatario}</span>
        </div>

        ${
          fecha
            ? `
              <p class="homework-deadline">
                Fecha límite: ${escaparHTML(fecha)}
              </p>
            `
            : ""
        }

        ${
          deber.tipo === "enlace"
            ? pintarEnlace(deber)
            : `
              <div class="homework-content">
                ${contenido.replace(/\n/g, "<br>")}
              </div>
            `
        }

        ${pintarAcciones(deber, perfil)}

      </article>
    `;
  }).join("");
}