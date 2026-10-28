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
            throw new Error('Falta la API Key en las variables de entorno.');
        }

        const prompt = `Actúa como un profesor de lengua española para niños de 2º de Primaria (7 años). 
        Genera un reto de lengua ÚNICO, original y variado sobre ortografía básica, plurales, sinónimos, antónimos o gramática elemental.
        
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

        // Usamos gemini-2.5-flash que es el modelo activo y recomendado en la API REST actual
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 1.0
                }
            })
        });

        if (!response.ok) {
            const errorTexto = await response.text();
            throw new Error(`Error HTTP ${response.status}: ${errorTexto}`);
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
        console.error('❌ Error al generar reto con Gemini, usando respaldo:', error);
        
        // 🛡️ Banco de respaldo con rotación amplia por si hay intermitencias de red
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

        const elegido = bancoRespaldo[Math.floor(Math.random() * bancoRespaldo.length)];

        return {
            pregunta: elegido.pregunta,
            opciones: elegido.opciones.sort(() => Math.random() - 0.5),
            explicacion: elegido.explicacion,
            nivel: nivelActual
        };
    }
}
