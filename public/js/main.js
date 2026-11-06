
// ======================================
// WEBLINE GT - INICIO PRINCIPAL
// ======================================

import { initializeMenu } from "./menu.js";
import { initializeEvent } from "./event.js";
import { initializeReglamento } from "./reglamento.js";
import { initializeInfo } from "./info.js";
import { initializeClasificacion } from "./clasificacion.js";

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

    // Inicializar apartado de información.
    initializeInfo();

    // Inicializar apartado de clasificación.
    initializeClasificacion();

});
