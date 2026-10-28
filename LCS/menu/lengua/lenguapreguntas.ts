export interface RetoLengua {
    pregunta: string;
    opciones: { texto: string; esCorrecta: boolean }[];
    explicacion: string;
    nivel: number;
}

/**
 * Generador dinámico de retos de Lengua usando la API REST de Gemini (Nivel 2º de Primaria)
 */
export async function generarRetoLengua(nivelActual: number): Promise<RetoLengua> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

    try {
        if (!apiKey) {
            throw new Error('No se encontró la clave de API de Gemini en las variables de entorno.');
        }

        const prompt = `Actúa como un profesor de lengua española experto en educación infantil, específicamente para niños de 2º de Primaria (7 años). 
        Genera un reto de lengua único y divertido (puede ser sobre ortografía básica, plurales sencillos, sinónimos, antónimos, verbos fáciles, uso de m antes de b o mayúsculas).
        
        Devuelve ÚNICAMENTE un objeto JSON válido (sin formato de bloque de código markdown ni texto adicional) con esta estructura exacta:
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

        // Usamos el modelo gemini-2.5-flash mediante fetch directo
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Error en la API de Gemini: ${response.statusText}`);
        }

        const data = await response.json() as any;
        const textoRespuesta = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        const jsonLimpio = textoRespuesta.replace(/```json/g, '').replace(/```/g, '').trim();
        const datosReto = JSON.parse(jsonLimpio);

        const opcionesBarajadas = (datosReto.opciones || []).sort(() => Math.random() - 0.5);

        return {
            pregunta: datosReto.pregunta || '¿Cómo se escribe correctamente?',
            opciones: opcionesBarajadas,
            explicacion: datosReto.explicacion || '¡Muy bien hecho!',
            nivel: nivelActual
        };

    } catch (error) {
        console.error('❌ Error al generar reto de lengua con IA, usando respaldo:', error);
        
        // Respaldo de seguridad si falla la llamada
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
