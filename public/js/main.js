
// ======================================
// WEBLINE GT - INICIO PRINCIPAL
// ======================================

import { initializeMenu } from "./menu.js";
import { initializeEvent } from "./event.js";
import { initializeChat } from "./chat.js";

// ======================================
// INICIAR APLICACIÓN
// ======================================

document.addEventListener("DOMContentLoaded", () => {

    // Iniciar Chat en segundo plano.
    initializeChat();

    // Iniciar el menú.
    // El Chat ya está inicializado y no debe repetirse
    // cuando el usuario entre en ese apartado.
    initializeMenu({
        chatAlreadyInitialized: true
    });

    // Cargar Eventos en segundo plano.
    initializeEvent();

});
