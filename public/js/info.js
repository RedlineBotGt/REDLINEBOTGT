// ======================================
// WEBLINE GT - APARTADO INFO
// ======================================

import IMAGENES from "../images/info.js";

export function initializeInfo() {

    const section = document.getElementById("info-section");
    const gallery = document.getElementById("info-gallery");

    if (!section || !gallery) {
        console.error("[INFO] No se encontraron los elementos.");
        return;
    }

    // Evitar inicializaciones duplicadas.

    if (gallery.dataset.initialized === "true") {
        return;
    }

    gallery.dataset.initialized = "true";

    // ======================================
    // OBTENER Y ORDENAR LAS IMÁGENES
    // ======================================

    const imagenes = Object.entries(IMAGENES)
        .filter(([key, url]) => {
            return /^info\d+$/.test(key) &&
                typeof url === "string" &&
                url.startsWith("https://");
        })
        .sort((a, b) => {
            const numeroA = Number(a[0].replace("info", ""));
            const numeroB = Number(b[0].replace("info", ""));

            return numeroA - numeroB;
        })
        .map(([key, url]) => ({
            numero: Number(key.replace("info", "")),
            url
        }));

    if (imagenes.length === 0) {
        gallery.innerHTML = `
            <p class="message">
                No hay imágenes disponibles.
            </p>
        `;

        console.error("[INFO] No se encontraron imágenes.");
        return;
    }

    // ======================================
    // CREAR GALERÍA
    // ======================================

    imagenes.forEach((imagen, index) => {

        const item = document.createElement("button");

        item.type = "button";
        item.className = "info-item";
        item.setAttribute(
            "aria-label",
            `Ampliar imagen ${imagen.numero}`
        );

        const img = document.createElement("img");

        img.src = imagen.url;
        img.alt = `Información WEBLINE GT ${imagen.numero}`;
        img.loading = index === 0 ? "eager" : "lazy";
        img.decoding = "async";

        const numero = document.createElement("span");

        numero.className = "info-number";
        numero.textContent = `INFO ${imagen.numero}`;

        item.appendChild(img);
        item.appendChild(numero);

        item.addEventListener("click", () => {
            abrirImagen(index);
        });

        gallery.appendChild(item);

    });

    // ======================================
    // VISOR DE IMÁGENES
    // ======================================

    const viewer = document.createElement("div");

    viewer.className = "info-viewer";
    viewer.setAttribute("role", "dialog");
    viewer.setAttribute("aria-modal", "true");
    viewer.setAttribute("aria-label", "Visor de información");
    viewer.hidden = true;

    viewer.innerHTML = `
        <div class="info-viewer-content">

            <button
                type="button"
                class="info-viewer-close"
                aria-label="Cerrar"
            >
                ×
            </button>

            <button
                type="button"
                class="info-viewer-prev"
                aria-label="Imagen anterior"
            >
                ‹
            </button>

            <img
                class="info-viewer-image"
                alt=""
            >

            <button
                type="button"
                class="info-viewer-next"
                aria-label="Imagen siguiente"
            >
                ›
            </button>

            <div class="info-viewer-counter"></div>

        </div>
    `;

    document.body.appendChild(viewer);

    const viewerImage = viewer.querySelector(".info-viewer-image");
    const counter = viewer.querySelector(".info-viewer-counter");

    const closeButton = viewer.querySelector(".info-viewer-close");
    const prevButton = viewer.querySelector(".info-viewer-prev");
    const nextButton = viewer.querySelector(".info-viewer-next");

    let currentIndex = 0;
    let previousFocus = null;

    // ======================================
    // MOSTRAR IMAGEN
    // ======================================

    function mostrarImagen(index) {

        currentIndex =
            (index + imagenes.length) % imagenes.length;

        const imagen = imagenes[currentIndex];

        viewerImage.src = imagen.url;
        viewerImage.alt = `Información WEBLINE GT ${imagen.numero}`;

        counter.textContent =
            `${currentIndex + 1} / ${imagenes.length}`;

    }

    // ======================================
    // ABRIR VISOR
    // ======================================

    function abrirImagen(index) {

        previousFocus = document.activeElement;

        mostrarImagen(index);

        viewer.hidden = false;

        document.body.classList.add("info-viewer-open");

        closeButton.focus();

    }

    // ======================================
    // CERRAR VISOR
    // ======================================

    function cerrarImagen() {

        if (viewer.hidden) {
            return;
        }

        viewer.hidden = true;

        viewerImage.removeAttribute("src");

        document.body.classList.remove("info-viewer-open");

        if (previousFocus) {
            previousFocus.focus();
        }

    }

    // ======================================
    // NAVEGACIÓN
    // ======================================

    function imagenAnterior() {
        mostrarImagen(currentIndex - 1);
    }

    function imagenSiguiente() {
        mostrarImagen(currentIndex + 1);
    }

    closeButton.addEventListener("click", cerrarImagen);

    prevButton.addEventListener("click", imagenAnterior);

    nextButton.addEventListener("click", imagenSiguiente);

    // ======================================
    // CERRAR AL TOCAR EL FONDO
    // ======================================

    viewer.addEventListener("click", event => {

        if (event.target === viewer) {
            cerrarImagen();
        }

    });

    // ======================================
    // TECLADO
    // ======================================

    document.addEventListener("keydown", event => {

        if (viewer.hidden) {
            return;
        }

        if (event.key === "Escape") {
            cerrarImagen();
        }

        if (event.key === "ArrowLeft") {
            imagenAnterior();
        }

        if (event.key === "ArrowRight") {
            imagenSiguiente();
        }

    });

    console.log(
        `[INFO] Galería inicializada con ${imagenes.length} imágenes.`
    );

}