import { Attachment, AttachmentBuilder } from 'discord.js';

const MAX_TOTAL_SIZE = 25 * 1024 * 1024;
const MAX_FILES = 10;
const ALLOWED_HOSTS = new Set([
    'cdn.discordapp.com',
    'media.discordapp.net'
]);

const ALLOWED_TYPES: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'video/3gpp': '3gp'
};

async function downloadReportFile(
    uploadedFile: Attachment,
    index: number
): Promise<{ file: AttachmentBuilder; size: number }> {
    let url: URL;

    try {
        url = new URL(uploadedFile.url);
    } catch {
        throw new Error('Uno de los archivos tiene una dirección no válida.');
    }

    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
        throw new Error('Uno de los archivos no procede del CDN seguro de Discord.');
    }

    const uploadedType = (uploadedFile.contentType || '').split(';')[0].trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(ALLOWED_TYPES, uploadedType)) {
        throw new Error('Solo se admiten fotos JPG, PNG, GIF, WEBP, AVIF y vídeos MP4, WEBM, MOV o 3GP.');
    }

    if (!uploadedFile.size || uploadedFile.size > MAX_TOTAL_SIZE) {
        throw new Error('Uno de los archivos supera el límite permitido de 25 MB.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(url, {
            method: 'GET',
            redirect: 'error',
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`Discord no permitió descargar uno de los archivos (HTTP ${response.status}).`);
        }

        const responseType = (response.headers.get('content-type') || '')
            .split(';')[0]
            .trim()
            .toLowerCase();

        if (!Object.prototype.hasOwnProperty.call(ALLOWED_TYPES, responseType)) {
            throw new Error('El contenido descargado no es una foto o vídeo compatible.');
        }

        if (responseType !== uploadedType) {
            throw new Error('El tipo real de uno de los archivos no coincide con el declarado por Discord.');
        }

        const declaredLength = Number(response.headers.get('content-length') || 0);
        if (declaredLength > MAX_TOTAL_SIZE) {
            throw new Error('Uno de los archivos supera el límite permitido de 25 MB.');
        }

        const data = Buffer.from(await response.arrayBuffer());
        if (!data.length || data.length > MAX_TOTAL_SIZE) {
            throw new Error('Uno de los archivos está vacío o supera el límite de 25 MB.');
        }

        const extension = ALLOWED_TYPES[responseType];
        const originalName = (uploadedFile.name || `prueba-${index + 1}`)
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .slice(0, 80);
        const baseName = originalName.replace(/\.[^.]+$/, '') || `prueba-${index + 1}`;

        return {
            file: new AttachmentBuilder(data, {
                name: `${baseName}.${extension}`
            }),
            size: data.length
        };
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Descarga y prepara los adjuntos para el hilo privado.
 * Máximo 10 archivos y 25 MB en total por reporte.
 */
export async function buildReportAttachments(
    uploadedFiles: Attachment[] = []
): Promise<AttachmentBuilder[]> {
    if (uploadedFiles.length < 1 || uploadedFiles.length > MAX_FILES) {
        throw new Error('Selecciona entre 1 y 10 archivos.');
    }

    const results: Array<{ file: AttachmentBuilder; size: number }> = [];
    let totalSize = 0;

    for (let index = 0; index < uploadedFiles.length; index++) {
        const result = await downloadReportFile(uploadedFiles[index], index);
        totalSize += result.size;

        if (totalSize > MAX_TOTAL_SIZE) {
            throw new Error('El conjunto de archivos supera el límite total de 25 MB por reporte.');
        }

        results.push(result);
    }

    return results.map(result => result.file);
}
