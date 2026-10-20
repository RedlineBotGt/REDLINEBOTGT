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
    
    // Inicializar el worker de Tesseract para inglés/español
    const worker = await createWorker('eng');

    for (const url of imageUrls) {
        try {
            // Reconocimiento óptico de caracteres desde la URL de la imagen de Discord
            const { data: { text } } = await worker.recognize(url);
            console.log('📜 Texto bruto extraído por OCR:\n', text);

            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            
            let detectedCount = 0;
            for (const line of lines) {
                // Buscar si la línea contiene algún piloto válido de la BD (BD2!L2:L)
                const matchedPilot = validPilots.find(p => line.toLowerCase().includes(p.toLowerCase()));
                
                if (matchedPilot) {
                    detectedCount++;
                    // Extraer posición (primeros dígitos de la línea o contador)
                    const positionMatch = line.match(/^\d+/);
                    const position = positionMatch ? positionMatch[0] : `${detectedCount}`;
                    
                    // Extraer tiempos de vuelta o totales (formato M:SS.mmm o MM:SS.mmm)
                    const timeMatches = line.match(/\d+:\d{2}\.\d{3}/g);
                    const bestLap = timeMatches && timeMatches.length > 0 ? timeMatches[timeMatches.length - 1] : '';
                    const totalTime = timeMatches && timeMatches.length > 1 ? timeMatches[0] : '';

                    // Evitar duplicados si el OCR lee la misma línea dos veces
                    if (!results.some(r => r.pilot === matchedPilot)) {
                        results.push({
                            position,
                            pilot: matchedPilot,
                            totalTime: totalTime || '',
                            bestLap: bestLap || ''
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Error al procesar la imagen ${url} con OCR:`, error);
        }
    }

    await worker.terminate();
    return results;
}
