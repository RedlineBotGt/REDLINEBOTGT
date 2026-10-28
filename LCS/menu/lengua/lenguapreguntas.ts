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

        const prompt = `Actúa como un profesor de lengua española experto en educación infantil para niños de 2º de Primaria (7 años). 
        Genera un reto de lengua ÚNICO, original y divertido. 
        Varía los temas obligatoriamente entre: ortografía básica (m antes de b, z/c), plurales, sinónimos, antónimos, o identificar nombres y verbos.
        
        Devuelve ÚNICAMENTE un objeto JSON válido (sin markdown ni texto adicional) con esta estructura exacta:
        {
            "pregunta": "Texto de la pregunta clara y adaptada a 7 años",
            "opciones": [
                {"texto": "Opción 1", "esCorrecta": true},
                {"texto": "Opción 2", "esCorrecta": false},
                {"texto": "Opción 3", "esCorrecta": false},
                {"texto": "Opción 4", "esCorrecta": false}
            ],
            "explicacion": "Una explicación muy corta y sencilla."
        }`;

        // Usamos gemini-1.5-flash que es el modelo estándar más estable para la API REST
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
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
                    responseMimeType: "application/json",
                    temperature: 1.0
                }
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Error HTTP ${response.status}: ${errorBody}`);
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
        console.error('❌ Error exacto al generar reto con Gemini:', error);
        
        // 🛡️ Banco de respaldo amplio y variado para que nunca se repita lo mismo
        const respaldos = [
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
                pregunta: '¿Cómo se escribe antes de la letra "p"?',
                opciones: [
                    { texto: 'Siempre M', esCorrecta: true },
                    { texto: 'Siempre N', esCorrecta: false },
                    { texto: 'Depende', esCorrecta: false },
                    { texto: 'Con H', esCorrecta: false }
                ],
                explicacion: 'Antes de P y B siempre va M.'
            },
            {
                pregunta: '¿Cuál es el antónimo (lo contrario) de "grande"?',
                opciones: [
                    { texto: 'Pequeño', esCorrecta: true },
                    { texto: 'Alto', esCorrecta: false },
                    { texto: 'Gordo', esCorrecta: false },
                    { texto: 'Ancho', esCorrecta: false }
                ],
                explicacion: 'Lo contrario de grande es pequeño.'
            }
        ];

        const elegido = respaldos[Math.floor(Math.random() * respaldos.length)];

        return {
            pregunta: elegido.pregunta,
            opciones: elegido.opciones.sort(() => Math.random() - 0.5),
            explicacion: elegido.explicacion,
            nivel: nivelActual
        };
    }
}
