import { google } from 'googleapis';

export interface ParsedDriverResult {
    position: string;
    pilot: string;
    totalTime: string;
    bestLap: string;
}

// 🗄️ Caché en memoria para guardar temporalmente los datos
export const pendingIngresoCache = new Map<string, ParsedDriverResult[]>();

/**
 * Autenticación con Google Cloud Vision utilizando las mismas credenciales de Sheets
 */
function getVisionClient() {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    return google.vision({ version: 'v1', auth });
}

/**
 * Procesa las URLs de las imágenes con Google Cloud Vision API
 * y realiza el matching con los pilotos oficiales de BD2.
 */
export async function processImagesWithOCR(imageUrls: string[], validPilots: string[]): Promise<ParsedDriverResult[]> {
    const results: ParsedDriverResult[] = [];

    if (!validPilots || validPilots.length === 0) {
        console.warn('⚠️ No se proporcionó lista de pilotos desde BD2!L2:L');
        return results;
    }

    try {
        const vision = getVisionClient();

        for (const url of imageUrls) {
            // Solicitud a Google Vision API enviando la URL de Discord
            const response = await vision.images.annotate({
                requestBody: {
                    requests: [
                        {
                            image: { source: { imageUri: url } },
                            features: [{ type: 'TEXT_DETECTION' }],
                        },
                    ],
                },
            });

            const textAnnotations = response.data.responses?.[0]?.textAnnotations;
            if (!textAnnotations || textAnnotations.length === 0) continue;

            // El primer elemento contiene todo el texto completo extraído
            const fullText = textAnnotations[0].description || '';
            console.log('📜 OCR Google Vision Raw:\n', fullText);

            const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            for (const line of lines) {
                // Coincidencia con pilotos oficiales de BD2!L2:L
                const matchedPilot = validPilots.find(p => 
                    line.toLowerCase().includes(p.toLowerCase().trim())
                );

                if (matchedPilot) {
                    // Evitar duplicados
                    if (results.some(r => r.pilot === matchedPilot)) continue;

                    // Posición (número al inicio de línea)
                    const posMatch = line.match(/^(\d+)/);
                    const position = posMatch ? posMatch[1] : `${results.length + 1}`;

                    // Tiempos (M:SS.mmm o MM:SS.mmm)
                    const timeMatches = line.match(/\d+:\d{2}\.\d{3}/g) || [];

                    let totalTime = '';
                    let bestLap = '';

                    if (timeMatches.length >= 2) {
                        totalTime = timeMatches[0];
                        bestLap = timeMatches[1];
                    } else if (timeMatches.length === 1) {
                        bestLap = timeMatches[0];
                    }

                    results.push({
                        position,
                        pilot: matchedPilot,
                        totalTime,
                        bestLap
                    });
                }
            }
        }
    } catch (error) {
        console.error('❌ Error al procesar imagen con Google Cloud Vision API:', error);
    }

    return results;
}
