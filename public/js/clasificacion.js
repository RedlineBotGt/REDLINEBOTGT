
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

        const thead = document.createElement("thead");
        const tbody = document.createElement("tbody");

        const headerRow = document.createElement("tr");
        const headers = rows[0] || [];

        for (let column = 0; column < TOTAL_COLUMNS; column++) {

            const th = document.createElement("th");

            th.textContent = headers[column] ?? "";
            headerRow.appendChild(th);

        }

        thead.appendChild(headerRow);

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

        table.appendChild(thead);
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
