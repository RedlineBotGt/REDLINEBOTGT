// ======================================
// WEBLINE GT - CLASIFICACIÓN
// ======================================

export function initializeClasificacion() {

    const container = document.getElementById(
        "clasificacion-container"
    );

    const status = document.getElementById(
        "clasificacion-status"
    );

    const refreshButton = document.getElementById(
        "clasificacion-refresh"
    );

    if (!container || !status || !refreshButton) {
        console.error(
            "[CLASIFICACION] No se encontraron los elementos."
        );
        return;
    }

    const TOTAL_COLUMNS = 13;

    const IMAGENES = {
        cupmediano:
            "https://res.cloudinary.com/iir4vyqc/image/upload/f_auto,q_auto/1000110668",

        horizontal:
            "https://res.cloudinary.com/iir4vyqc/image/upload/f_auto,q_auto/1000110671",

        gt7:
            "https://res.cloudinary.com/iir4vyqc/image/upload/f_auto,q_auto/1000110670"
    };

    let loading = false;

    // ======================================
    // MOSTRAR MENSAJE
    // ======================================

    function showMessage(message, type = "") {

        container.replaceChildren();

        const element = document.createElement("div");

        element.className = `message ${type}`.trim();
        element.textContent = message;

        container.appendChild(element);
    }

    // ======================================
    // CREAR CELDA CON LOGO
    // ======================================

    function createLogoCell(className, imageUrl, alt, colSpan, rowSpan) {

        const cell = document.createElement("td");

        cell.className = `clasificacion-logo-cell ${className}`;
        cell.colSpan = colSpan;
        cell.rowSpan = rowSpan;

        const image = document.createElement("img");

        image.src = imageUrl;
        image.alt = alt;
        image.loading = "eager";

        cell.appendChild(image);

        return cell;
    }

    // ======================================
    // FILAS SUPERIORES CON LOGOS
    // ======================================

    function createLogoRows() {

        const fragment = document.createDocumentFragment();

        for (let row = 1; row <= 7; row++) {

            const tr = document.createElement("tr");

            tr.className = "clasificacion-logo-row";

            if (row === 1) {

                // B1:C7
                tr.appendChild(
                    createLogoCell(
                        "logo-cup",
                        IMAGENES.cupmediano,
                        "REDLINE GTCUP",
                        2,
                        7
                    )
                );

                // D1:M4
                tr.appendChild(
                    createLogoCell(
                        "logo-horizontal",
                        IMAGENES.horizontal,
                        "REDLINE GT",
                        10,
                        4
                    )
                );

                // N1:N7
                tr.appendChild(
                    createLogoCell(
                        "logo-gt7",
                        IMAGENES.gt7,
                        "Gran Turismo 7",
                        1,
                        7
                    )
                );

            } else if (row > 4) {

                // Espacio central de las filas 5, 6 y 7.
                const emptyCell = document.createElement("td");

                emptyCell.className = "clasificacion-logo-empty";
                emptyCell.colSpan = 10;

                tr.appendChild(emptyCell);

            }

            fragment.appendChild(tr);
        }

        return fragment;
    }

    // ======================================
    // CONSTRUIR TABLA
    // ======================================

    function renderTable(rows) {

        if (!Array.isArray(rows) || rows.length === 0) {
            showMessage(
                "No hay datos disponibles en la clasificación."
            );
            return;
        }

        const table = document.createElement("table");
        table.className = "clasificacion-table";

        const tbody = document.createElement("tbody");

        // Logos integrados en la propia tabla.
        tbody.appendChild(createLogoRows());

        // Cabecera original de la clasificación.
        const headerRow = document.createElement("tr");
        headerRow.className = "clasificacion-header-row";

        const headers = rows[0] || [];

        for (let column = 0; column < TOTAL_COLUMNS; column++) {

            const th = document.createElement("th");

            th.textContent = headers[column] ?? "";

            headerRow.appendChild(th);
        }

        tbody.appendChild(headerRow);

        // Datos originales.
        rows.slice(1).forEach((row, rowIndex) => {

            const tr = document.createElement("tr");

            for (let column = 0; column < TOTAL_COLUMNS; column++) {

                const td = document.createElement("td");

                td.textContent = row[column] ?? "";

                tr.appendChild(td);
            }

            tr.dataset.row = String(rowIndex + 2);

            tbody.appendChild(tr);
        });

        table.appendChild(tbody);

        const wrapper = document.createElement("div");
        wrapper.className = "clasificacion-table-wrapper";

        wrapper.appendChild(table);

        container.replaceChildren(wrapper);

        status.textContent =
            `${rows.length - 1} filas de clasificación`;
    }

    // ======================================
    // CARGAR DATOS
    // ======================================

    async function loadClasificacion() {

        if (loading) {
            return;
        }

        loading = true;
        refreshButton.disabled = true;
        refreshButton.textContent = "CARGANDO...";

        status.textContent = "Actualizando datos...";

        if (!container.querySelector("table")) {
            showMessage("Cargando clasificación...");
        }

        try {

            const response = await fetch(
                "/api/clasificacion",
                {
                    method: "GET",
                    credentials: "same-origin",
                    headers: {
                        "Accept": "application/json"
                    }
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.error || "No se pudo cargar la clasificación."
                );
            }

            renderTable(result.values);

        } catch (error) {

            console.error(
                "[CLASIFICACION] Error:",
                error
            );

            status.textContent = "No se pudo actualizar";

            showMessage(
                error.message || "Error cargando la clasificación.",
                "error"
            );

        } finally {

            loading = false;
            refreshButton.disabled = false;
            refreshButton.textContent = "↻ ACTUALIZAR";

        }
    }

    // ======================================
    // ACTUALIZAR MANUALMENTE
    // ======================================

    refreshButton.addEventListener(
        "click",
        loadClasificacion
    );

    // ======================================
    // INICIO
    // ======================================

    loadClasificacion();

    console.log(
        "[CLASIFICACION] Módulo inicializado."
    );
}