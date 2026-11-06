
import IMAGENES from "../images/reglamento.js";

// ======================================
// WEBLINE GT - GALERÍA DE REGLAMENTO
// ======================================

export function initializeReglamento() {

    const section = document.getElementById("reglamento-section");
    const gallery = document.getElementById("reglamento-gallery");

    if (!section || !gallery) {
        console.error("[REGLAMENTO] No se encontraron los elementos.");
        return;
    }

    // Evitar inicializar dos veces.
    if (gallery.dataset.initialized === "true") {
        return;
    }

    gallery.dataset.initialized = "true";

    const imagenes = Object.entries(IMAGENES)
        .filter(([nombre, url]) =>
            nombre.startsWith("reglamento") &&
            typeof url === "string" &&
            url.startsWith("https://")
        )
        .sort(([a], [b]) => {
            const numeroA = Number(a.replace("reglamento", ""));
            const numeroB = Number(b.replace("reglamento", ""));
            return numeroA - numeroB;
        });

    if (imagenes.length === 0) {
        gallery.innerHTML = `
            <div class="message error">
                No se han podido cargar las imágenes del reglamento.
            </div>
        `;
        return;
    }

    // ======================================
    // CREAR GALERÍA
    // ======================================

    gallery.innerHTML = "";

    imagenes.forEach(([nombre, url], index) => {

        const item = document.createElement("button");

        item.type = "button";
        item.className = "reglamento-item";
        item.setAttribute(
            "aria-label",
            `Ampliar capítulo ${index + 1}`
        );

        const imagen = document.createElement("img");

        imagen.src = url;
        imagen.alt = `Reglamento - Capítulo ${index + 1}`;
        imagen.loading = index < 2 ? "eager" : "lazy";
        imagen.decoding = "async";

        const numero = document.createElement("span");

        numero.className = "reglamento-number";
        numero.textContent = `CAPÍTULO ${index + 1}`;

        item.appendChild(imagen);
        item.appendChild(numero);

        item.addEventListener("click", () => {
            abrirImagen(url, index);
        });

        gallery.appendChild(item);

    });

    // ======================================
    // VISOR DE IMÁGENES
    // ======================================

    const visor = document.createElement("div");

    visor.className = "reglamento-viewer";
    visor.setAttribute("role", "dialog");
    visor.setAttribute("aria-modal", "true");
    visor.setAttribute("aria-label", "Imagen del reglamento");
    visor.hidden = true;

    visor.innerHTML = `
        <button
            type="button"
            class="reglamento-close"
            aria-label="Cerrar imagen"
        >✕</button>

        <button
            type="button"
            class="reglamento-prev"
            aria-label="Imagen anterior"
        >‹</button>

        <div class="reglamento-viewer-content">
            <img class="reglamento-viewer-image" alt="">
            <div class="reglamento-viewer-counter"></div>
        </div>

        <button
            type="button"
            class="reglamento-next"
            aria-label="Imagen siguiente"
        >›</button>
    `;

    document.body.appendChild(visor);

    const imagenAmpliada = visor.querySelector(
        ".reglamento-viewer-image"
    );

    const contador = visor.querySelector(
        ".reglamento-viewer-counter"
    );

    const botonCerrar = visor.querySelector(
        ".reglamento-close"
    );

    const botonAnterior = visor.querySelector(
        ".reglamento-prev"
    );

    const botonSiguiente = visor.querySelector(
        ".reglamento-next"
    );

    let indiceActual = 0;
    let elementoAnterior = null;

    function actualizarVisor() {

        const [, url] = imagenes[indiceActual];

        imagenAmpliada.src = url;
        imagenAmpliada.alt =
            `Reglamento - Capítulo ${indiceActual + 1}`;

        contador.textContent =
            `CAPÍTULO ${indiceActual + 1} DE ${imagenes.length}`;

        botonAnterior.disabled = indiceActual === 0;
        botonSiguiente.disabled =
            indiceActual === imagenes.length - 1;
    }

    function abrirImagen(url, index) {

        elementoAnterior = document.activeElement;
        indiceActual = index;

        actualizarVisor();

        visor.hidden = false;
        document.body.classList.add("reglamento-viewer-open");

        botonCerrar.focus();
    }

    function cerrarImagen() {

        visor.hidden = true;

        document.body.classList.remove(
            "reglamento-viewer-open"
        );

        if (elementoAnterior) {
            elementoAnterior.focus();
        }
    }

    botonCerrar.addEventListener("click", cerrarImagen);

    botonAnterior.addEventListener("click", () => {

        if (indiceActual > 0) {
            indiceActual--;
            actualizarVisor();
        }

    });

    botonSiguiente.addEventListener("click", () => {

        if (indiceActual < imagenes.length - 1) {
            indiceActual++;
            actualizarVisor();
        }

    });

    visor.addEventListener("click", event => {

        if (event.target === visor) {
            cerrarImagen();
        }

    });

    document.addEventListener("keydown", event => {

        if (visor.hidden) return;

        if (event.key === "Escape") {
            cerrarImagen();
        }

        if (event.key === "ArrowLeft" && indiceActual > 0) {
            indiceActual--;
            actualizarVisor();
        }

        if (
            event.key === "ArrowRight" &&
            indiceActual < imagenes.length - 1
        ) {
            indiceActual++;
            actualizarVisor();
        }

    });

    console.log(
        `[REGLAMENTO] ${imagenes.length} imágenes cargadas.`
    );

}
