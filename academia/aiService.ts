// academia/aiService.ts

/**
 * Genera un reto de pensamiento lateral adaptado al nivel actual del usuario usando fetch nativo.
 */
export async function generarRetoIA(nivelActual: number, historialPrevio: string[]) {
    try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            throw new Error("No se ha configurado la clave de API de Gemini");
        }

        const prompt = `
            Eres un tutor experto en pedagogía y altas capacidades infantiles. 
            Estás diseñando un reto de "Pensamiento Lateral y Lógica" para un niño (partiendo de una base de 2º de Primaria, pero estimulando su ingenio, creatividad y capacidad deductiva para evitar que se aburra).
            
            El nivel actual del alumno es: ${nivelActual}.
            Historial reciente de temas superados: ${JSON.stringify(historialPrevio.slice(-3))}.

            Genera UN NUEVO reto de pensamiento lateral original, divertido, ingenioso y que requiera pensar fuera de lo común.
            
            Devuelve la respuesta estrictamente en formato JSON con la siguiente estructura (sin texto adicional fuera del json):
            {
                "prompt": "El texto del acertijo o problema de pensamiento lateral aquí...",
                "hint": "Una pista sutil por si se encalla"
            }
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error("Error generando reto con IA:", error);
        // Fallback por seguridad si falla la red o la IA
        return {
            prompt: "Si vas corriendo una maratón y adelantas al que va en segundo lugar, ¿en qué posición pasas a estar?",
            hint: "Piensa dónde estaba la persona a la que acabas de rebasar."
        };
    }
}

/**
 * Evalúa la respuesta del usuario y decide si sube de nivel usando fetch nativo.
 */
export async function evaluarRespuestaIA(retoActual: string, respuestaUsuario: string) {
    try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            throw new Error("No se ha configurado la clave de API de Gemini");
        }

        const prompt = `
            Estás evaluando la respuesta de un niño a un reto de pensamiento lateral.
            Reto planteado: "${retoActual}"
            Respuesta del alumno: "${respuestaUsuario}"

            Analiza si el razonamiento es correcto, ingenioso o muestra comprensión lógica (no seas demasiado estricto con la ortografía, valora la lógica detrás).
            
            Devuelve un JSON con esta estructura exacta:
            {
                "correct": true o false,
                "feedback": "Un mensaje motivador, cariñoso y estimulante explicándole por qué su respuesta es brillante o dándole una pista constructiva si le ha faltado una vuelta de tuerca."
            }
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error("Error evaluando con IA:", error);
        return {
            correct: true,
            feedback: "¡Gran esfuerzo! Tu razonamiento muestra mucha creatividad."
        };
    }
}
