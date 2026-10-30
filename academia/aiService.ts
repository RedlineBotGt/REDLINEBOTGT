
// academia/aiService.ts

export interface RetoGenerado {
    prompt: string;
    hint: string;
    solution: string;
    category: string;
}

export interface EvaluacionReto {
    correct: boolean;
    feedback: string;
    explanation: string;
}

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function obtenerApiKey(): string {
    const apiKey =
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.GEMAI_API_KEY;

    if (!apiKey) {
        throw new Error('No se ha encontrado la clave de API de Gemini en Render.');
    }

    return apiKey;
}

function extraerJson(texto: string): any {
    const limpio = texto
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

    const inicio = limpio.indexOf('{');
    const final = limpio.lastIndexOf('}');

    if (inicio === -1 || final === -1 || final <= inicio) {
        throw new Error('Gemini no ha devuelto un JSON válido.');
    }

    return JSON.parse(limpio.substring(inicio, final + 1));
}

async function consultarGemini(prompt: string): Promise<any> {
    const apiKey = obtenerApiKey();
    const controller = new AbortController();

    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
        const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{ text: prompt }]
                    }
                ],
                generationConfig: {
                    temperature: 0.9,
                    responseMimeType: 'application/json'
                }
            }),
            signal: controller.signal
        });

        const data = await response.json() as any;

        if (!response.ok) {
            const detalle = data.error?.message || `HTTP ${response.status}`;
            throw new Error(`Error de Gemini: ${detalle}`);
        }

        const texto = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!texto) {
            throw new Error('Gemini ha devuelto una respuesta vacía.');
        }

        return extraerJson(texto);
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Genera un reto nuevo de pensamiento lateral.
 */
export async function generarRetoIA(
    nivelActual: number,
    historialPrevio: string[] = []
): Promise<RetoGenerado> {

    const historial = historialPrevio
        .slice(-15)
        .map((tema, indice) => `${indice + 1}. ${tema}`)
        .join('\n');

    const prompt = `
Eres un experto en pedagogía, creatividad y pensamiento lateral.

Diseñas retos para una academia familiar española.
Debes adaptar los retos a la capacidad real del alumno.

NIVEL ACTUAL: ${nivelActual}

TEMAS Y RETOS RECIENTES QUE DEBES EVITAR:
${historial || 'Todavía no hay retos anteriores.'}

OBJETIVO:
Crear UN reto de pensamiento lateral completamente original.

REGLAS:
- No repitas acertijos clásicos ni preguntas anteriores.
- Evita preguntas que dependan de conocimientos especializados.
- El reto debe tener una solución lógica y demostrable.
- Debe permitir razonar, imaginar y buscar perspectivas diferentes.
- Adapta la complejidad al nivel indicado.
- Utiliza situaciones cotidianas, sorprendentes o divertidas.
- No hagas preguntas ambiguas que admitan múltiples respuestas sin explicación.
- No reveles la solución en el enunciado.
- La pista debe ayudar sin regalar la respuesta.

Devuelve exclusivamente este JSON:

{
  "prompt": "Enunciado del reto",
  "hint": "Pista para ayudar al alumno",
  "solution": "Solución correcta y razonamiento completo",
  "category": "Categoría del reto"
}
`;

    const resultado = await consultarGemini(prompt);

    if (
        typeof resultado.prompt !== 'string' ||
        typeof resultado.solution !== 'string' ||
        !resultado.prompt.trim() ||
        !resultado.solution.trim()
    ) {
        throw new Error('El reto generado por Gemini está incompleto.');
    }

    return {
        prompt: resultado.prompt.trim(),
        hint: typeof resultado.hint === 'string'
            ? resultado.hint.trim()
            : 'Intenta observar el problema desde otro punto de vista.',
        solution: resultado.solution.trim(),
        category: typeof resultado.category === 'string'
            ? resultado.category.trim()
            : 'Pensamiento lateral 🧠'
    };
}

/**
 * Evalúa una respuesta teniendo en cuenta la solución real del reto.
 */
export async function evaluarRespuestaIA(
    retoActual: string,
    respuestaUsuario: string,
    solucionEsperada?: string
): Promise<EvaluacionReto> {

    if (!respuestaUsuario.trim()) {
        throw new Error('La respuesta del alumno está vacía.');
    }

    if (!solucionEsperada) {
        throw new Error('No se dispone de la solución original del reto.');
    }

    const prompt = `
Eres un profesor paciente, justo y motivador de una academia familiar.

Debes evaluar la respuesta de un alumno a un reto de pensamiento lateral.

ENUNCIADO:
${retoActual}

SOLUCIÓN Y RAZONAMIENTO ESPERADOS:
${solucionEsperada}

RESPUESTA DEL ALUMNO:
${respuestaUsuario}

CRITERIOS:
- Comprueba si el razonamiento llega a una solución válida.
- Acepta respuestas expresadas con otras palabras.
- Acepta soluciones alternativas si son lógicas y coherentes.
- No penalices faltas de ortografía.
- No des por correcta una respuesta que solo sea una ocurrencia sin razonamiento válido.
- Si la respuesta es parcialmente correcta, explica qué parte ha entendido y qué falta.
- Sé especialmente cuidadoso y motivador cuando el alumno sea un niño.
- No regales el acierto por el mero hecho de intentarlo.

Devuelve exclusivamente este JSON:

{
  "correct": true,
  "feedback": "Comentario personalizado para el alumno",
  "explanation": "Explicación breve de la solución y del razonamiento"
}

El campo correct debe ser true únicamente cuando la respuesta sea válida.
`;

    const resultado = await consultarGemini(prompt);

    if (typeof resultado.correct !== 'boolean') {
        throw new Error('Gemini no ha indicado correctamente si la respuesta es válida.');
    }

    if (typeof resultado.feedback !== 'string') {
        throw new Error('Gemini no ha devuelto una valoración.');
    }

    return {
        correct: resultado.correct,
        feedback: resultado.feedback.trim(),
        explanation: typeof resultado.explanation === 'string'
            ? resultado.explanation.trim()
            : ''
    };
}
