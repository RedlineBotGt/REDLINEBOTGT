import { Attachment, AttachmentBuilder } from 'discord.js';

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_HOSTS = new Set([
    'cdn.discordapp.com',
    'media.discordapp.net'
]);

const EXTENSIONS: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/avif': 'avif'
};

/**
 * Descarga de forma segura una imagen subida a un modal de Discord
 * y la prepara como adjunto para reenviarla al canal de destino.
 */
async function buildOneModalImageAttachment(
    uploadedFile: Attachment,
    index: number
): Promise<AttachmentBuilder> {

    const url = new URL(uploadedFile.url);

    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
        throw new Error('La imagen no procede de un servidor CDN válido de Discord.');
    }

    const uploadedContentType = (uploadedFile.contentType || '').toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(EXTENSIONS, uploadedContentType)) {
        throw new Error('Solo se admiten imágenes JPG, PNG, GIF, WEBP o AVIF.');
    }

    if (uploadedFile.size > MAX_IMAGE_SIZE) {
        throw new Error('La imagen supera el límite de 8 MB.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(url, {
            method: 'GET',
            redirect: 'error',
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`Discord no permitió descargar la imagen (HTTP ${response.status}).`);
        }

        const contentType = (response.headers.get('content-type') || '')
            .split(';')[0]
            .trim()
            .toLowerCase();

        if (!Object.prototype.hasOwnProperty.call(EXTENSIONS, contentType)) {
            throw new Error('El contenido descargado no es una imagen compatible.');
        }

        const contentLength = Number(response.headers.get('content-length') || 0);
        if (contentLength > MAX_IMAGE_SIZE) {
            throw new Error('La imagen supera el límite de 8 MB.');
        }

        const data = Buffer.from(await response.arrayBuffer());

        if (data.length === 0 || data.length > MAX_IMAGE_SIZE) {
            throw new Error('La imagen está vacía o supera el límite de 8 MB.');
        }

        const extension = EXTENSIONS[contentType] || 'img';

        return new AttachmentBuilder(data, {
            name: `imagen-discord-${index + 1}.${extension}`
        });
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Descarga y prepara todas las imágenes seleccionadas en el modal.
 * Discord permite seleccionar hasta 10 archivos en este componente.
 */
export async function buildModalImageAttachments(
    uploadedFiles: Attachment[] = []
): Promise<AttachmentBuilder[]> {
    if (uploadedFiles.length > 10) {
        throw new Error('Solo se permiten hasta 10 imágenes por mensaje.');
    }

    return Promise.all(
        uploadedFiles.map((file, index) =>
            buildOneModalImageAttachment(file, index)
        )
    );
}
