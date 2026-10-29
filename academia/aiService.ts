// academia/aiService.ts
import { GoogleGenAI } from '@google/genai';

// Inicializa el cliente (asegúrate de tener GEMINI_API_KEY en tus variables de entorno)
const ai = new GoogleGenAI();

/**
 * Genera un reto de pensamiento lateral adaptado al nivel actual del usuario.
 */
export async function generarRetoIA(nivelActual: number, historialPrevio: string[]) {
    try {
        const prompt = `
            Eres un tutor experto en pedagogía y altas capacidades infantiles. 
            Estás diseñando un reto de "Pensamiento Lateral y Lógica" para un niño (partiendo de una base de 2º de Primaria, pero estimulando su ingenio, creatividad y capacidad deductiva para evitar que se aburra).
            
            El nivel actual del alumno es: ${nivelActual}.
            Historial reciente de temas superados: ${JSON.stringify(historialPrevio.slice(-3))}.

            Genera UN NUEVO reto de pensamiento lateral original, divertido, ingenioso y que requiera pensar fuera de lo común.
            
            Devuelve la respuesta estrictamente en formato JSON con la siguiente estructura (sin florituras de markdown adicionales fuera del json si es posible, o asegúrate de parsearlo bien):
            {
                "prompt": "El texto del acertijo o problema de pensamiento lateral aquí...",
                "hint": "Una pista sutil por si se encalla"
            }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', // O el modelo que estés usando en tu entorno
            contents: prompt,
        });

        const textResponse = response.text || '';
        // Limpiamos posibles bloques de código markdown de la respuesta de la IA
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
 * Evalúa la respuesta del usuario y decide si sube de nivel o necesita una pista.
 */
export async function evaluarRespuestaIA(retoActual: string, respuestaUsuario: string) {
    try {
        const prompt = `
            Estás evaluando la respuesta de un niño a un reto de pensamiento lateral.
            Reto planteado: "${retoActual}"
            Respuesta del alumno: "${respuestaUsuario}"

            Analiza si el razonamiento es correcto, ingenioso o muestra comprensión lógica (no seas demasiado estricto con la ortografía, valora la lógica detrás).
            
            Devuelve un JSON con esta estructura:
            {
                "correct": true o false,
                "feedback": "Un mensaje motivador, cariñoso y estimulante explicándole por qué su respuesta es brillante o dándole una pista constructiva si le ha faltado una vuelta de tuerca."
            }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        const textResponse = response.text || '';
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
