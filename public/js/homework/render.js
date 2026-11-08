
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
 * Obtiene los identificadores de deberes nuevos
 * durante la sesión actual.
 */
function obtenerDeberesNuevos(deberes, perfil) {
  if (perfil === "papa") {
    return [];
  }

  const claveSesion = `academiaHomeworkNewIds_${perfil}`;
  const claveVisita = `academiaHomeworkLastVisit_${perfil}`;

  try {
    const guardados = sessionStorage.getItem(claveSesion);

    // Ya se han identificado las novedades en esta sesión.
    if (guardados !== null) {
      return JSON.parse(guardados);
    }

    const ultimaVisita = Number(
      localStorage.getItem(claveVisita) || 0
    );

    const nuevos = ultimaVisita > 0
      ? deberes
          .filter(deber => {
            const fecha = new Date(deber.creadoEn).getTime();

            return (
              deber._id &&
              !Number.isNaN(fecha) &&
              fecha > ultimaVisita
            );
          })
          .map(deber => String(deber._id))
      : [];

    sessionStorage.setItem(
      claveSesion,
      JSON.stringify(nuevos)
    );

    localStorage.setItem(
      claveVisita,
      String(Date.now())
    );

    return nuevos;
  } catch (error) {
    console.warn(
      "[DEBERES] No se pudieron guardar las novedades:",
      error
    );

    return [];
  }
}

/**
 * Muestra las imágenes adjuntas en los deberes de Leo o Mamá.
 */
function pintarImagenesEjercicio(deber, perfil) {
  if (deber.tipo !== "ejercicio_imagen" || perfil === "papa" ||
      !Array.isArray(deber.imagenes) || deber.imagenes.length === 0) return "";
  const id = encodeURIComponent(String(deber._id || ""));
  return `
    <div class="homework-images-gallery">
      ${deber.imagenes.map(imagen => {
        const fileId = encodeURIComponent(String(imagen.fileId || ""));
        const nombre = escaparHTML(imagen.nombre || "Imagen del ejercicio");
        return `
          <figure class="homework-image-item">
            <img src="/api/academia/homework/${id}/images/${fileId}?perfil=${encodeURIComponent(perfil)}"
              alt="${nombre}" loading="lazy">
            <figcaption>${nombre}</figcaption>
          </figure>
        `;
      }).join("")}
    </div>
  `;
}

/**
 * Dibuja las preguntas de un ejercicio.
 *
 * Las respuestas correctas nunca se incluyen
 * en el HTML que recibe el navegador.
 */
function pintarPreguntasEjercicio(deber, perfil) {
  if (
    (deber.tipo !== "ejercicio" && deber.tipo !== "ejercicio_imagen") ||
    perfil === "papa"
  ) {
    return "";
  }

  const preguntas = Array.isArray(deber.preguntas)
    ? deber.preguntas
    : [];

  if (preguntas.length === 0) {
    return `
      <p class="homework-invalid-link">
        Este ejercicio todavía no tiene preguntas.
      </p>
    `;
  }

  const id = escaparHTML(deber._id || "");
  const completado = deber.estado === "completado";

  return `
    <div class="homework-exercise">

      <h4>📝 Responde las preguntas</h4>

      <form
        id="exercise-form-${id}"
        class="homework-exercise-form"
        onsubmit="event.preventDefault(); comprobarEjercicioPantalla('${id}')"
      >

        ${preguntas.map((pregunta, indice) => {
          const preguntaTexto = escaparHTML(
            pregunta.pregunta
          );

          const preguntaId = escaparHTML(
            pregunta.id || String(indice)
          );

          return `
            <div class="homework-exercise-question">

              <label for="answer-${id}-${indice}">
                <strong>
                  ${indice + 1}. ${preguntaTexto}
                </strong>
              </label>

              <textarea
                id="answer-${id}-${indice}"
                rows="2"
                maxlength="2000"
                placeholder="Escribe tu respuesta..."
                data-exercise-answer
                data-question-id="${preguntaId}"
                ${completado ? "disabled" : ""}
                required
              ></textarea>

            </div>
          `;
        }).join("")}

        <button
          type="submit"
          class="homework-exercise-submit"
          data-exercise-submit
          ${completado ? "disabled" : ""}
        >
          ${completado ? "Ejercicio terminado ✓" : "Comprobar respuestas"}
        </button>

        <p
          class="homework-exercise-feedback"
          data-exercise-feedback
          role="status"
          aria-live="polite"
        ></p>

      </form>

    </div>
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

  // Los ejercicios se completan al acertar todas las preguntas.
  if (deber.tipo === "ejercicio" || deber.tipo === "ejercicio_imagen") {
    return "";
  }

  // Botones para enlaces y otros deberes.
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

  // Identificar novedades de esta sesión.
  const deberesNuevos = obtenerDeberesNuevos(
    deberes,
    perfil
  );

  // Ordenar del más reciente al más antiguo.
  const deberesOrdenados = [...deberes].sort((a, b) => {
    const fechaA = new Date(a.creadoEn || 0).getTime();
    const fechaB = new Date(b.creadoEn || 0).getTime();

    return fechaB - fechaA;
  });

  lista.innerHTML = deberesOrdenados.map(deber => {
    const titulo = escaparHTML(deber.titulo);

    const asignatura = escaparHTML(
      ASIGNATURAS[deber.asignatura] || deber.asignatura
    );

    const completado = deber.estado === "completado";

    const contenido = escaparHTML(deber.contenido);

    const esNuevo = deberesNuevos.includes(
      String(deber._id)
    );

    return `
      <article class="homework-card">

        <div class="homework-card-header">
          <h3>${titulo}</h3>

          ${
            esNuevo
              ? `
                <span
                  class="homework-new-badge"
                  style="
                    display: inline-block;
                    background: #0ea5e9;
                    color: #ffffff;
                    padding: 4px 9px;
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: 800;
                    margin-left: 6px;
                    white-space: nowrap;
                  "
                >
                  🆕 NUEVO
                </span>
              `
              : ""
          }

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

        ${pintarImagenesEjercicio(deber, perfil)}

        ${pintarPreguntasEjercicio(deber, perfil)}

        ${pintarAcciones(deber, perfil)}

      </article>
    `;
  }).join("");
}
