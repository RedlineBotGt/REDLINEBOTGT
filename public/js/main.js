// ======================================
// WEBLINE GT - INICIO PRINCIPAL
// ======================================

import { initializeMenu } from "./menu.js";
import { initializeEvent } from "./event.js";
import { initializeReglamento } from "./reglamento.js";

// ======================================
// INICIAR APLICACIÓN
// ======================================

document.addEventListener("DOMContentLoaded", () => {

    // Inicializar menú flotante.
    initializeMenu();

    // Inicializar apartado de eventos.
    initializeEvent();

    // Inicializar apartado de reglamento.
    initializeReglamento();

});