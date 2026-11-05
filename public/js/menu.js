
// ======================================
// WEBLINE GT - MENÚ FLOTANTE Y NAVEGACIÓN
// ======================================

import { initializeChat, closeChat } from "./chat.js";

export function initializeMenu() {

    const menu = document.getElementById("floating-menu");
    const toggle = document.getElementById("menu-toggle");
    const panel = document.getElementById("menu-panel");
    const backdrop = document.getElementById("menu-backdrop");

    const eventSection = document.getElementById("event-section");
    const chatSection = document.getElementById("chat-section");

    if (
        !menu ||
        !toggle ||
        !panel ||
        !backdrop ||
        !eventSection ||
        !chatSection
    ) {
        console.error("[MENU] No se encontraron los elementos.");
        return;
    }

    let currentSection = "event";
    let chatInitialized = false;

    // ======================================
    // ABRIR MENÚ
    // ======================================

    function openMenu() {
        menu.classList.add("open");
        backdrop.classList.add("visible");

        toggle.setAttribute("aria-expanded", "true");
        panel.setAttribute("aria-hidden", "false");
    }

    // ======================================
    // CERRAR MENÚ
    // ======================================

    function closeMenu() {
        menu.classList.remove("open");
        backdrop.classList.remove("visible");

        toggle.setAttribute("aria-expanded", "false");
        panel.setAttribute("aria-hidden", "true");
    }

    // ======================================
    // CAMBIAR APARTADO
    // ======================================

    function changeSection(section) {

        if (section !== "event" && section !== "chat") {
            return;
        }

        currentSection = section;

        eventSection.hidden = section !== "event";
        chatSection.hidden = section !== "chat";

        // Actualizar botón activo.

        panel.querySelectorAll(".menu-button[data-section]")
            .forEach(button => {

                const active =
                    button.dataset.section === section;

                button.classList.toggle("active", active);
                button.setAttribute(
                    "aria-current",
                    active ? "page" : "false"
                );

            });

        // Inicializar el chat únicamente la primera vez.

        if (section === "chat" && !chatInitialized) {
            initializeChat();
            chatInitialized = true;
        }

        // Cerrar conexión al salir del chat.

        if (section !== "chat" && chatInitialized) {
            closeChat();
        }

        closeMenu();
    }

    // ======================================
    // BOTÓN DEL MENÚ
    // ======================================

    toggle.addEventListener("click", () => {

        if (menu.classList.contains("open")) {
            closeMenu();
        } else {
            openMenu();
        }

    });

    // ======================================
    // CERRAR AL TOCAR FUERA
    // ======================================

    backdrop.addEventListener("click", closeMenu);

    // ======================================
    // CERRAR CON ESCAPE
    // ======================================

    document.addEventListener("keydown", event => {

        if (event.key === "Escape") {
            closeMenu();
        }

    });

    // ======================================
    // SELECCIONAR APARTADO
    // ======================================

    panel.querySelectorAll(".menu-button[data-section]")
        .forEach(button => {

            button.addEventListener("click", () => {

                changeSection(button.dataset.section);

            });

        });

    // ======================================
    // ESTADO INICIAL
    // ======================================

    changeSection(currentSection);

    console.log("[MENU] Navegación inicializada.");

}
