import { GoogleGenAI } from '@google/genai';

export interface RetoLengua {
    pregunta: string;
    opciones: { texto: string; esCorrecta: boolean }[];
    explicacion: string;
    nivel: number;
}

// Inicializar el cliente oficial de Google Gen AI (lee automáticamente process.env.GEMINI_API_KEY)
const ai = new GoogleGenAI({});

/**
 * Generador dinámico de retos de Lengua usando la IA oficial de Gemini (Nivel 2º de Primaria)
 */
export async function generarRetoLengua(nivelActual: number): Promise<RetoLengua> {
    try {
        const prompt = `Actúa como un profesor de lengua española experto en educación infantil para niños de 2º de Primaria (7 años). 
        Genera un reto de lengua ÚNICO, original y divertido. Varía los temas obligatoriamente entre ortografía básica (m antes de b, z/c), plurales sencillos, sinónimos, antónimos, o identificación de nombres y verbos.
        
        Devuelve ÚNICAMENTE un objeto JSON válido (sin bloques de código markdown ni texto adicional) con esta estructura exacta:
        {
            "pregunta": "Texto de la pregunta clara y adaptada a 7 años",
            "opciones": [
                {"texto": "Opción 1", "esCorrecta": true},
                {"texto": "Opción 2", "esCorrecta": false},
                {"texto": "Opción 3", "esCorrecta": false},
                {"texto": "Opción 4", "esCorrecta": false}
            ],
            "explicacion": "Una explicación muy corta y sencilla de por qué es la respuesta correcta."
        }`;

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: prompt,
            // Forzamos la salida en JSON puro
            config: {
                responseMimeType: 'application/json',
                temperature: 1.0 // Máxima creatividad para que no repita preguntas
            }
        });

        const textoRespuesta = response.text?.trim() || '';
        
        const jsonLimpio = textoRespuesta.replace(/```json/g, '').replace(/```/g, '').trim();
        const datosReto = JSON.parse(jsonLimpio);

        // Barajar las opciones aleatoriamente
        const opcionesBarajadas = (datosReto.opciones || []).sort(() => Math.random() - 0.5);

        return {
            pregunta: datosReto.pregunta || '¿Cómo se escribe correctamente?',
            opciones: opcionesBarajadas,
            explicacion: datosReto.explicacion || '¡Muy bien hecho!',
            nivel: nivelActual
        };

    } catch (error) {
        console.error('❌ [GEMINI] Error al generar reto de lengua, usando banco de respaldo:', error);
        
        // 🛡️ Banco de respaldo variado por si la API sufre cualquier altibajo
        const bancoRespaldo = [
            {
                pregunta: '¿Cuál es el sinónimo de la palabra "contento"?',
                opciones: [
                    { texto: 'Feliz', esCorrecta: true },
                    { texto: 'Triste', esCorrecta: false },
                    { texto: 'Enojado', esCorrecta: false },
                    { texto: 'Cansado', esCorrecta: false }
                ],
                explicacion: 'Estar contento es estar feliz.'
            },
            {
                pregunta: '¿Cómo se escribe correctamente?',
                opciones: [
                    { texto: 'Zanahoria', esCorrecta: true },
                    { texto: 'Sanahoria', esCorrecta: false },
                    { texto: 'Zanajoria', esCorrecta: false },
                    { texto: 'Sanajoria', esCorrecta: false }
                ],
                explicacion: 'Se escribe con z y h.'
            },
            {
                pregunta: '¿Cuál es el plural de la palabra "flor"?',
                opciones: [
                    { texto: 'Flores', esCorrecta: true },
                    { texto: 'Floreses', esCorrecta: false },
                    { texto: 'Flors', esCorrecta: false },
                    { texto: 'Floris', esCorrecta: false }
                ],
                explicacion: 'A las palabras que terminan en consonante se les añade "es".'
            },
            {
                pregunta: '¿Qué palabra indica una acción (un verbo)?',
                opciones: [
                    { texto: 'Saltar', esCorrecta: true },
                    { texto: 'Pelota', esCorrecta: false },
                    { texto: 'Rojo', esCorrecta: false },
                    { texto: 'Mesa', esCorrecta: false }
                ],
                explicacion: 'Saltar es algo que podemos hacer.'
            },
            {
                pregunta: '¿Qué letra se escribe siempre antes de la letra "p"?',
                opciones: [
                    { texto: 'M', esCorrecta: true },
                    { texto: 'N', esCorrecta: false },
                    { texto: 'L', esCorrecta: false },
                    { texto: 'R', esCorrecta: false }
                ],
                explicacion: 'Antes de P y B siempre va M.'
            }
        ];

        const elegido = bancoRespaldo[Math.floor(Math.random() * bancoRespaldo.length)];

        return {
            pregunta: elegido.pregunta,
            opciones: elegido.opciones.sort(() => Math.random() - 0.5),
            explicacion: elegido.explicacion,
            nivel: nivelActual
        };
    }
}
