// Interfaz para la estructura de cada piloto detectado
export interface ParsedDriverResult {
    position: string;
    pilot: string;
    totalTime: string;
    bestLap: string;
}

/**
 * Procesa las URLs de las imágenes utilizando OCR y realiza el matching con los pilotos oficiales de BD2.
 * @param imageUrls Array con las URLs de las imágenes adjuntas en Discord.
 * @param validPilots Lista de apodos oficiales obtenidos de BD2!L2:L.
 */
export async function processImagesWithOCR(imageUrls: string[], validPilots: string[]): Promise<ParsedDriverResult[]> {
    const results: ParsedDriverResult[] = [];

    for (const url of imageUrls) {
        try {
            // TODO: Aquí integrarás tu lógica de OCR real (ej: Tesseract.js, Google Cloud Vision, etc.)
            // que descarga la imagen de la URL y extrae las líneas de texto de la clasificación/carrera.

            // Simulación de datos extraídos para estructurar el flujo:
            // Cada línea leída suele contener: Posición, Apodo/Piloto, Tiempo Total, Mejor Vuelta (VR)
            const simulatedOCRData = [
                { position: '1', pilot: 'dihondia', totalTime: '22:15.432', bestLap: '1:12.345' },
                { position: '2', pilot: 'PilotoEjemplo', totalTime: '22:18.910', bestLap: '1:12.890' }
            ];

            for (const item of simulatedOCRData) {
                // Aplicar el cruce (matching) con los pilotos válidos de BD2!L2:L
                const matchedPilot = matchPilotName(item.pilot, validPilots);

                results.push({
                    position: item.position,
                    pilot: matchedPilot,
                    totalTime: item.totalTime,
                    bestLap: item.bestLap
                });
            }
        } catch (error) {
            console.error(`❌ Error al procesar la imagen ${url} con OCR:`, error);
        }
    }

    return results;
}

/**
 * Compara el nombre detectado por OCR con la lista oficial de pilotos (BD2!L2:L)
 * para asegurar que el apodo sea exactamente el registrado.
 */
function matchPilotName(detectedName: string, validPilots: string[]): string {
    if (!validPilots || validPilots.length === 0) return detectedName;

    const cleanDetected = detectedName.toLowerCase().trim();

    // 1. Búsqueda de coincidencia exacta (ignorando mayúsculas/minúsculas)
    const exactMatch = validPilots.find(p => p.toLowerCase().trim() === cleanDetected);
    if (exactMatch) return exactMatch;

    // 2. Búsqueda de coincidencia parcial (si contiene parte del nombre)
    const partialMatch = validPilots.find(p => 
        p.toLowerCase().includes(cleanDetected) || cleanDetected.includes(p.toLowerCase())
    );
    if (partialMatch) return partialMatch;

    // Si no encuentra coincidencia cercana, devuelve el nombre detectado originalmente
    return detectedName;
}
