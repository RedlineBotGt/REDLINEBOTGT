// ======================================
// WEBLINE GT - MENÚ FLOTANTE
// ======================================

export function initializeMenu() {
    const menu = document.getElementById("floating-menu");
    const toggle = document.getElementById("menu-toggle");
    const panel = document.getElementById("menu-panel");
    const backdrop = document.getElementById("menu-backdrop");

    if (!menu || !toggle || !panel || !backdrop) {
        console.error("No se ha podido inicializar el menú.");
        return;
    }

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
    // CAMBIAR ESTADO
    // ======================================

    function toggleMenu() {
        const isOpen = menu.classList.contains("open");

        if (isOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    }

    // ======================================
    // BOTÓN DEL LOGO
    // ======================================

    toggle.addEventListener("click", toggleMenu);

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
    // CERRAR AL SELECCIONAR UNA OPCIÓN
    // ======================================

    const menuButtons = panel.querySelectorAll(".menu-button");

    menuButtons.forEach(button => {
        button.addEventListener("click", () => {
            closeMenu();
        });
    });

    // ======================================
    // ESTADO INICIAL
    // ======================================

    closeMenu();
}