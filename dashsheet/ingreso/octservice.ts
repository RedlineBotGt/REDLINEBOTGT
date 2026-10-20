import { createWorker } from 'tesseract.js';

export interface ParsedDriverResult {
    position: string;
    pilot: string;
    totalTime: string;
    bestLap: string;
}

// 🗄️ Caché en memoria para guardar temporalmente los datos del OCR por usuario/sesión
export const pendingIngresoCache = new Map<string, ParsedDriverResult[]>();

/**
 * Procesa las URLs de las imágenes utilizando Tesseract.js (OCR real)
 * y realiza el matching automático con los pilotos oficiales de BD2.
 */
export async function processImagesWithOCR(imageUrls: string[], validPilots: string[]): Promise<ParsedDriverResult[]> {
    const results: ParsedDriverResult[] = [];
    
    // Si no hay lista de pilotos de BD2, no podemos procesar el matching de nombres
    if (!validPilots || validPilots.length === 0) {
        console.warn('⚠️ No se proporcionó lista de pilotos desde BD2!L2:L');
        return results;
    }

    try {
        const worker = await createWorker('eng');

        for (const url of imageUrls) {
            const { data: { text } } = await worker.recognize(url);
            console.log('📜 OCR Raw Output:\n', text);

            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            for (const line of lines) {
                // Buscar si la línea coincide con algún piloto oficial de BD2!L2:L
                const matchedPilot = validPilots.find(p => 
                    line.toLowerCase().includes(p.toLowerCase().trim())
                );

                if (matchedPilot) {
                    // Evitar registrar al mismo piloto más de una vez (si se pasan 2 fotos)
                    if (results.some(r => r.pilot === matchedPilot)) continue;

                    // Detectar posición al inicio de la línea
                    const posMatch = line.match(/^(\d+)/);
                    const position = posMatch ? posMatch[1] : `${results.length + 1}`;

                    // Extraer tiempos en formato M:SS.mmm o MM:SS.mmm
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

        await worker.terminate();
    } catch (error) {
        console.error('❌ Error ejecutando Tesseract OCR:', error);
    }

    return results;
}
