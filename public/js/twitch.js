
// ======================================
// WEBLINE GT - APARTADO TWITCH
// ======================================

export function initializeTwitch() {

    const player = document.getElementById("twitch-player");
    const expandButton = document.getElementById("twitch-expand");
    const reduceButton = document.getElementById("twitch-reduce");

    if (!player || !expandButton || !reduceButton) {
        console.error("[TWITCH] No se encontraron los elementos.");
        return;
    }

    // ======================================
    // CONFIGURACIÓN DEL CANAL
    // ======================================

    const CHANNEL = "pollo_racinggt";

    // ======================================
    // CREAR REPRODUCTOR
    // ======================================

    function loadPlayer() {

        if (player.querySelector("iframe")) {
            return;
        }

        const iframe = document.createElement("iframe");

        const parentDomain = location.hostname;

        iframe.src =
            "https://player.twitch.tv/" +
            "?channel=" + encodeURIComponent(CHANNEL) +
            "&parent=" + encodeURIComponent(parentDomain) +
            "&muted=true";

        iframe.title = "Retransmisión en directo de " + CHANNEL;
        iframe.allowFullscreen = true;
        iframe.setAttribute("scrolling", "no");
        iframe.setAttribute("frameborder", "0");

        iframe.allow =
            "autoplay; fullscreen; picture-in-picture";

        player.innerHTML = "";
        player.appendChild(iframe);

        console.log("[TWITCH] Reproductor cargado.");
    }

    // ======================================
    // AMPLIAR REPRODUCTOR
    // ======================================

    expandButton.addEventListener("click", () => {

        player.classList.add("expanded");

        expandButton.hidden = true;
        reduceButton.hidden = false;

    });

    // ======================================
    // REDUCIR REPRODUCTOR
    // ======================================

    reduceButton.addEventListener("click", () => {

        player.classList.remove("expanded");

        reduceButton.hidden = true;
        expandButton.hidden = false;

    });

    // ======================================
    // INICIAR
    // ======================================

    loadPlayer();

    reduceButton.hidden = true;

    console.log("[TWITCH] Apartado inicializado.");

}
