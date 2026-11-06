import { initializeMenu } from "./menu.js";
import { initializeEvent } from "./event.js";
import { initializeChat } from "./chat.js";
import { initializeReglamento } from "./reglamento.js";

document.addEventListener("DOMContentLoaded", () => {

    // Inicializar CHAT
    initializeChat();

    // Inicializar MENÚ
    initializeMenu({
        chatAlreadyInitialized: true
    });

    // Inicializar EVENTO
    initializeEvent();

    // Inicializar REGLAMENTO
    initializeReglamento();

});