// ======================================
// WEBLINE GT - SISTEMA DE EVENTOS
// ======================================

import {
    escapeHTML,
    formatDiscordText,
    formatDate
} from "./utils.js";

const eventContainer = document.getElementById("event-container");

// ======================================
// MOSTRAR NOMBRES REALES DE DISCORD
// ======================================

function renderPilotList(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return '<div class="empty-list">Ningún piloto todavía</div>';
    }

    return items.map(name => {
        const safeName = escapeHTML(name);
        return `<div class="pilot">${safeName}</div>`;
    }).join("");
}

// ======================================
// GENERAR CADA LISTA DE PARTICIPANTES
// ======================================

function renderList(title, items, type) {
    const count = Array.isArray(items) ? items.length : 0;

    return `
        <section class="list-card">
            <div class="list-title ${type}">
                ${title} (${count})
            </div>
            <div class="list-body">
                ${renderPilotList(items)}
            </div>
        </section>
    `;
}

// ======================================
// MOSTRAR EVENTO Y BOTONES
// ======================================

function renderEvent(event, permisos, rsvpNames) {
    const rsvps = rsvpNames || {
        yes: event.rsvps?.yes || [],
        reserve: event.rsvps?.reserve || [],
        maybe: event.rsvps?.maybe || [],
        no: event.rsvps?.no || []
    };

    const puedeSerTitular =
        permisos?.puedeSerTitular === true;

    const puedeSerReserva =
        permisos?.puedeSerReserva === true;

    const imageHTML = event.image
        ? `<img class="event-image" id="event-image"
            src="${escapeHTML(event.image)}"
            alt="Imagen del evento">`
        : "";

    let permisoMensaje = "";

    if (puedeSerTitular) {
        permisoMensaje =
            "Tu rol de Discord te permite seleccionar TITULAR.";
    } else if (puedeSerReserva) {
        permisoMensaje =
            "Tu rol de Discord te permite seleccionar RESERVA.";
    } else {
        permisoMensaje =
            "TITULAR y RESERVA requieren sus roles correspondientes.";
    }

    eventContainer.innerHTML = `
        <article class="event-card">

            <header class="event-header">
                <span class="event-tag">EVENTO ACTUAL</span>

                <h2 class="event-title">
                    ${escapeHTML(event.title || "Evento REDLINE GT")}
                </h2>

                <div class="event-meta">
                    📅 ${escapeHTML(formatDate(event.scheduledAt))}<br>
                    📢 ${escapeHTML(event.channelName || "Canal de eventos")}
                </div>
            </header>

            ${imageHTML}

            <div class="event-description">${formatDiscordText(
                event.description || "Sin descripción adicional."
            )}</div>

            <div class="event-content">

                <h3 class="section-heading">
                    CONFIRMA TU ASISTENCIA
                </h3>

                <div class="rsvp-buttons">

                    <button
                        class="rsvp-button yes ${puedeSerTitular ? "available" : ""}"
                        data-respuesta="yes"
                        type="button"
                        ${puedeSerTitular ? "" : "disabled"}
                    >
                        ✅ TITULAR
                    </button>

                    <button
                        class="rsvp-button reserve ${puedeSerReserva ? "available" : ""}"
                        data-respuesta="reserve"
                        type="button"
                        ${puedeSerReserva ? "" : "disabled"}
                    >
                        🔃 RESERVA
                    </button>

                    <button
                        class="rsvp-button maybe available"
                        data-respuesta="maybe"
                        type="button"
                    >
                        ❔ DUDA
                    </button>

                    <button
                        class="rsvp-button no available"
                        data-respuesta="no"
                        type="button"
                    >
                        ❌ NO PUEDO
                    </button>

                </div>

                <p class="rsvp-note">
                    ${escapeHTML(permisoMensaje)}
                    DUDA y NO PUEDO están disponibles para cualquier usuario que haya iniciado sesión.
                </p>

                <p
                    class="rsvp-status"
                    id="rsvp-status"
                    aria-live="polite"
                ></p>

                <h3 class="section-heading">
                    LISTA DE PARTICIPANTES
                </h3>

                <div class="lists-grid">
                    ${renderList("✅ TITULARES", rsvps.yes, "yes")}
                    ${renderList("🔃 RESERVAS", rsvps.reserve, "reserve")}
                    ${renderList("❔ DUDAS", rsvps.maybe, "maybe")}
                    ${renderList("❌ NO PUEDEN", rsvps.no, "no")}
                </div>

            </div>
        </article>
    `;

    // ======================================
    // CARGA DE IMAGEN DEL EVENTO
    // ======================================

    const image = document.getElementById("event-image");

    if (image) {
        image.addEventListener("error", () => {
            image.style.display = "none";
        });

        image.addEventListener("load", () => {
            image.style.display = "block";
        });
    }

    // ======================================
    // CONECTAR BOTONES DE RESPUESTA
    // ======================================

    const responseButtons =
        eventContainer.querySelectorAll("[data-respuesta]");

    responseButtons.forEach(button => {
        button.addEventListener("click", () => {
            sendRsvp(button.dataset.respuesta);
        });
    });
}

// ======================================
// ENVIAR RESPUESTA AL SERVIDOR
// ======================================

async function sendRsvp(respuesta) {
    const status = document.getElementById("rsvp-status");

    if (!respuesta || !status) {
        return;
    }

    const buttons =
        eventContainer.querySelectorAll("[data-respuesta]");

    const previousStates = [];

    buttons.forEach(button => {
        previousStates.push({
            respuesta: button.dataset.respuesta,
            disabled: button.disabled
        });

        button.disabled = true;
    });

    status.className = "rsvp-status";
    status.textContent = "Registrando tu respuesta...";

    try {
        const response = await fetch("/api/evento/responder", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({ respuesta })
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                result.error || result.message ||
                "No se pudo registrar tu respuesta."
            );
        }

        await loadEvent();

        const newStatus =
            document.getElementById("rsvp-status");

        if (newStatus) {
            newStatus.className = "rsvp-status";
            newStatus.textContent =
                result.message || "Respuesta registrada correctamente.";
        }

    } catch (error) {
        const currentStatus =
            document.getElementById("rsvp-status");

        if (currentStatus) {
            currentStatus.className = "rsvp-status error";
            currentStatus.textContent =
                error.message || "Ha ocurrido un error.";
        }

        // Recuperar los botones si ha fallado la petición.
        previousStates.forEach(item => {
            const button = eventContainer.querySelector(
                `[data-respuesta="${item.respuesta}"]`
            );

            if (button) {
                button.disabled = item.disabled;
            }
        });
    }
}

// ======================================
// CARGAR EVENTO
// ======================================

async function loadEvent() {
    try {
        const response = await fetch("/api/evento", {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store"
        });

        if (
            response.status === 401 ||
            response.status === 403
        ) {
            window.location.href = "/auth/discord";
            return;
        }

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                result.error || "No se pudo cargar el evento."
            );
        }

        if (!result.evento) {
            eventContainer.innerHTML = `
                <div class="message">
                    Actualmente no hay ningún evento publicado.
                </div>
            `;
            return;
        }

        renderEvent(
            result.evento,
            result.permisos || {},
            result.rsvpNames || null
        );

    } catch (error) {
        console.error("Error cargando evento:", error);

        eventContainer.innerHTML = `
            <div class="message error">
                No se ha podido cargar el evento.<br>
                ${escapeHTML(error.message)}
            </div>
        `;
    }
}

// ======================================
// INICIO DEL SISTEMA DE EVENTOS
// ======================================

export function initializeEvent() {
    if (!eventContainer) {
        console.error("No se encuentra event-container.");
        return;
    }

    loadEvent();
}