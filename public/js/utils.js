// ======================================
// WEBLINE GT - FUNCIONES AUXILIARES
// ======================================

// ======================================
// PROTEGER CONTENIDO HTML
// ======================================

export function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[character];
    });
}

// ======================================
// CONVERTIR MARKDOWN DE DISCORD A HTML
// ======================================

export function formatDiscordText(value) {
    let text = escapeHTML(value ?? "");

    // Enlaces Markdown.
    text = text.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        (match, label, url) => {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
        }
    );

    // Enlaces directos.
    text = text.replace(
        /(^|[\s(])(https?:\/\/[^\s<]+)/g,
        (match, prefix, url) => {
            const cleanUrl = url.replace(/[.,!?;:]+$/, "");
            const ending = url.slice(cleanUrl.length);

            return `${prefix}<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>${ending}`;
        }
    );

    // Código en línea.
    text = text.replace(
        /`([^`\n]+)`/g,
        "<code>$1</code>"
    );

    // Negrita y cursiva combinadas.
    text = text.replace(
        /\*\*\*([\s\S]+?)\*\*\*/g,
        "<strong><em>$1</em></strong>"
    );

    // Negrita.
    text = text.replace(
        /\*\*([\s\S]+?)\*\*/g,
        "<strong>$1</strong>"
    );

    // Subrayado.
    text = text.replace(
        /__([\s\S]+?)__/g,
        "<u>$1</u>"
    );

    // Tachado.
    text = text.replace(
        /~~([\s\S]+?)~~/g,
        "<del>$1</del>"
    );

    // Cursiva.
    text = text.replace(
        /(^|[^*])\*([^*\n]+)\*(?!\*)/g,
        "$1<em>$2</em>"
    );

    text = text.replace(
        /(^|[^_])_([^_\n]+)_(?!_)/g,
        "$1<em>$2</em>"
    );

    return text;
}

// ======================================
// FORMATO DE FECHAS
// ======================================

export function formatDate(value) {
    if (!value) {
        return "Fecha pendiente";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Fecha no disponible";
    }

    return new Intl.DateTimeFormat("es-ES", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Madrid"
    }).format(date);
}