import { GoogleGenAI } from '@google/genai';

export interface RetoLengua {
    pregunta: string;
    opciones: { texto: string; esCorrecta: boolean }[];
    explicacion: string;
    nivel: number;
}

// Inicializar el cliente de Google Gen AI con la clave de entorno
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '' });

/**
 * Generador dinámico de retos de Lengua usando IA (Nivel 2º de Primaria)
 */
export async function generarRetoLengua(nivelActual: number): Promise<RetoLengua> {
    try {
        const prompt = `Actúa como un profesor de lengua española experto en educación infantil, específicamente para niños de 2º de Primaria (7 años). 
        Genera un reto de lengua único y divertido (puede ser sobre ortografía básica, plurales sencillos, sinónimos, antónimos, verbos fáciles, uso de m antes de b o mayúsculas).
        
        Devuelve ÚNICAMENTE un objeto JSON válido (sin formato de bloque de código markdown adicional ni texto fuera del JSON) con esta estructura exacta:
        {
            "pregunta": "Texto de la pregunta clara y adaptada a 7 años",
            "opciones": [
                {"texto": "Opción 1", "esCorrecta": true},
                {"texto": "Opción 2", "esCorrecta": false},
                {"texto": "Opción 3", "esCorrecta": false},
                {"texto": "Opción 4", "esCorrecta": false}
            ],
            "explicacion": "Una explicación muy corta y sencilla de por qué es la respuesta correcta."
        }
        Asegúrate de que las opciones estén barajadas y que solo una sea la correcta.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', // O el modelo que estés usando
            contents: prompt,
        });

        const textoRespuesta = response.text?.trim() || '';
        
        // Limpiar posibles bloques de código markdown si la IA los incluye
        const jsonLimpio = textoRespuesta.replace(/```json/g, '').replace(/```/g, '').trim();
        const datosReto = JSON.parse(jsonLimpio);

        // Barajar las opciones por seguridad
        const opcionesBarajadas = (datosReto.opciones || []).sort(() => Math.random() - 0.5);

        return {
            pregunta: datosReto.pregunta || '¿Cómo se escribe correctamente?',
            opciones: opcionesBarajadas,
            explicacion: datosReto.explicacion || '¡Muy bien hecho!',
            nivel: nivelActual
        };

    } catch (error) {
        console.error('❌ Error al generar reto de lengua con IA, usando respaldo:', error);
        
        // Respaldo de seguridad por si falla la IA puntualmente
        return {
            pregunta: '¿Cómo se escribe correctamente el plural de "lápiz"?',
            opciones: [
                { texto: 'Lápices', esCorrecta: true },
                { texto: 'Lápis', esCorrecta: false },
                { texto: 'Lapises', esCorrecta: false },
                { texto: 'Lápizs', esCorrecta: false }
            ].sort(() => Math.random() - 0.5),
            explicacion: 'Termina en ces.',
            nivel: nivelActual
        };
    }
}
