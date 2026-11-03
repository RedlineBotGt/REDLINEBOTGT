import {
  ASIGNATURAS
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
 * Genera el botón azul para abrir un enlace.
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
    <a
      class="homework-link-button"
      href="${escaparHTML(enlace)}"
      target="_blank"
      rel="noopener noreferrer"
      style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        min-height: 42px;
        box-sizing: border-box;
        background: #2563eb;
        color: #ffffff;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 600;
        font-size: 14px;
      "
    >
      🔗 Abrir enlace
    </a>
  `;
}

/**
 * Genera las acciones disponibles para cada perfil.
 */
function pintarAcciones(deber, perfil) {
  const id = escaparHTML(deber._id || "");
  const completado = deber.estado === "completado";

  // Botones de administración de Papá.
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

  // Botones para Leo y Mamá.
  return `
    <div
      class="homework-student-actions"
      style="
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        width: 100%;
        margin-top: 12px;
      "
    >

      ${pintarEnlace(deber)}

      <button
        type="button"
        class="homework-complete-button"
        onclick="${
          completado
            ? ""
            : `completarDeberPantalla('${id}')`
        }"
        ${completado ? "disabled" : ""}
        style="
          width: 100%;
          min-height: 42px;
          box-sizing: border-box;
          background: #dc2626;
          color: #ffffff;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13px;
          opacity: ${completado ? "0.65" : "1"};
          cursor: ${completado ? "not-allowed" : "pointer"};
        "
      >
        ${completado ? "Terminado ✓" : "Marcar como terminado"}
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

    const completado = deber.estado === "completado";

    const contenido = escaparHTML(deber.contenido);

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
        </div>

        ${
          deber.tipo !== "enlace"
            ? `
              <div class="homework-content">
                ${contenido.replace(/\n/g, "<br>")}
              </div>
            `
            : ""
        }

        ${pintarAcciones(deber, perfil)}

      </article>
    `;
  }).join("");
}