
// ======================================
// WEBLINE GT - MENÚ FLOTANTE Y NAVEGACIÓN
// ======================================

import { initializeChat, closeChat } from "./chat.js";

export function initializeMenu({
    chatAlreadyInitialized = false
} = {}) {

    const menu = document.getElementById("floating-menu");
    const toggle = document.getElementById("menu-toggle");
    const panel = document.getElementById("menu-panel");
    const backdrop = document.getElementById("menu-backdrop");

    const eventSection = document.getElementById("event-section");
    const chatSection = document.getElementById("chat-section");
    const welcomeScreen = document.getElementById("welcome-screen");

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
    let chatInitialized = chatAlreadyInitialized;

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

    function changeSection(section, fromUser = false) {

        if (section !== "event" && section !== "chat") {
            return;
        }

        currentSection = section;

        eventSection.hidden = section !== "event";
        chatSection.hidden = section !== "chat";

        // La bienvenida solo desaparece cuando
        // el usuario selecciona un apartado.

        if (fromUser && welcomeScreen) {
            welcomeScreen.hidden = true;
        }

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

        // Inicializar el chat únicamente si todavía
        // no se había iniciado en segundo plano.

        if (section === "chat" && !chatInitialized) {
            initializeChat();
            chatInitialized = true;
        }

        // Mantener el comportamiento anterior
        // al salir del apartado Chat.

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

                changeSection(button.dataset.section, true);

            });

        });

    // ======================================
    // ESTADO INICIAL
    // ======================================

    // Mostrar Evento detrás de la bienvenida,
    // sin ocultar todavía la pantalla inicial.

    changeSection(currentSection, false);

    console.log("[MENU] Navegación inicializada.");

}
