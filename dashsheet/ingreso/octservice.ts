import { google } from 'googleapis';

export interface ParsedDriverResult {
    position: string;
    pilot: string;
    totalTime: string;
    bestLap: string;
}

// 🗄️ Caché en memoria para guardar los resultados del OCR
export const pendingIngresoCache = new Map<string, ParsedDriverResult[]>();

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
 * Lee la imagen con Google Cloud Vision y extrae los datos tal cual aparecen.
 * Sin depender ni filtrar por la lista de pilotos de BD2.
 */
export async function processImagesWithOCR(imageUrls: string[], validPilots: string[] = []): Promise<ParsedDriverResult[]> {
    const results: ParsedDriverResult[] = [];

    try {
        const vision = getVisionClient();

        for (const url of imageUrls) {
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

            const fullText = textAnnotations[0].description || '';
            console.log('📜 OCR Raw Output:\n', fullText);

            const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            for (const line of lines) {
                // Buscamos cualquier línea que contenga tiempos (formato M:SS.mmm o MM:SS.mmm) o estructura de fila
                const timeMatches = line.match(/\d+:\d{2}\.\d{3}/g) || [];
                
                // Si la línea tiene tiempos o parece una fila de clasificación/carrera
                const posMatch = line.match(/^(\d{1,2})\b/); // Detecta posición al inicio (1-99)
                
                if (posMatch || timeMatches.length > 0) {
                    const position = posMatch ? posMatch[1] : `${results.length + 1}`;
                    
                    // Limpiar la línea quitando la posición inicial y los tiempos para aislar el nombre del piloto
                    let rawPilotName = line
                        .replace(/^\d{1,2}\s*/, '') // Quitar número inicial
                        .replace(/\d+:\d{2}\.\d{3}/g, '') // Quitar tiempos
                        .replace(/\+\d+\.\d+/g, '') // Quitar diferencias (+00.181, etc.)
                        .replace(/F-type Gr\.\d/gi, '') // Quitar modelos de coche habituales de la interfaz
                        .replace(/[|]/g, '') // Quitar barras
                        .trim();

                    let totalTime = '';
                    let bestLap = '';

                    if (timeMatches.length >= 2) {
                        totalTime = timeMatches[0];
                        bestLap = timeMatches[1];
                    } else if (timeMatches.length === 1) {
                        bestLap = timeMatches[0];
                    }

                    // Si hemos obtenido un nombre utilizable
                    if (rawPilotName.length >= 2) {
                        results.push({
                            position,
                            pilot: rawPilotName,
                            totalTime,
                            bestLap
                        });
                    }
                }
            }
        }
    } catch (error) {
        console.error('❌ Error al procesar la imagen con Google Cloud Vision:', error);
    }

    return results;
}
