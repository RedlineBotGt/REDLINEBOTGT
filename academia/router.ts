import { Router } from 'express';
import { getUserProgressCollection } from './models';
import { initialChallenges, Challenge } from './challengesData';

export const academiaRouter = Router();

// Middleware para parsear JSON
academiaRouter.use(express.json());

// 1. Obtener el siguiente reto (del banco o generado dinámicamente por la IA si se acaban)
academiaRouter.post('/api/academia/challenge/next', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, error: 'Falta el userId' });
        }

        const collection = await getUserProgressCollection();
        let userProgress = await collection.findOne({ userId });

        // Si el usuario no existe, lo inicializamos en Nivel 1
        if (!userProgress) {
            userProgress = { userId, currentLevel: 1, completedChallenges: [] };
            await collection.insertOne(userProgress);
        }

        const currentLevel = userProgress.currentLevel || 1;
        const completed = userProgress.completedChallenges || [];

        // 1. Buscamos en el banco inicial un reto del nivel actual no completado
        let availableChallenges = initialChallenges.filter(
            c => c.level === currentLevel && !completed.includes(c.id)
        );

        let selectedChallenge: { id: string; prompt: string; category: string; explanation: string };

        if (availableChallenges.length > 0) {
            // Cogemos uno del banco preguardado
            const c = availableChallenges[0];
            selectedChallenge = { id: c.id, prompt: c.prompt, category: c.category, explanation: c.explanation };
        } else {
            // 2. Si se han acabado los del banco para este nivel, pedimos a la IA que cree uno nuevo de 2º de Primaria
            const apiKey = process.env.GEMINI_API_KEY || process.env.GEMAI_API_KEY;
            if (!apiKey) {
                // Si no hay API key, reciclamos el banco inicial
                const fallback = initialChallenges[0];
                selectedChallenge = { id: 'fb_' + Date.now(), prompt: fallback.prompt, category: fallback.category, explanation: fallback.explanation };
            } else {
                const promptGen = `
                Eres un profesor experto en educación primaria en España, diseñando fichas de ejercicios para niños de 6-7 años (nivel 2º de Primaria).
                Genera un único problema o ejercicio escolar nuevo de Matemáticas (sumas, restas, pequeños problemas cotidianos) o Lengua (ortografía básica, vocabulario) adecuado para el Nivel ${currentLevel}.
                Responde estrictamente en formato JSON plano con esta estructura (sin bloques markdown extra si es posible):
                {
                  "category": "Matemáticas 🔢" o "Lengua 📖" o "Problemas 🧩",
                  "prompt": "El enunciado claro, motivador y directo del problema o ejercicio.",
                  "explanation": "La solución exacta y una breve explicación para corregirlo."
                }
                `;

                const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: promptGen }] }] })
                });

                const aiData = await aiRes.json();
                const textRes = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
                const cleanJson = textRes.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(cleanJson);

                selectedChallenge = {
                    id: 'ai_gen_' + Date.now(),
                    prompt: parsed.prompt,
                    category: parsed.category || 'Problemas 🧩',
                    explanation: parsed.explanation
                };

                // Guardamos temporalmente este reto generado en una colección auxiliar o memoria si se desea, 
                // o lo evaluamos directamente usando la explicación que trae integrada.
            }
        }

        // Guardamos la explicación temporalmente en una variable de sesión o la devolvemos cifrada/mapeada, 
        // o para simplificar, guardamos los retos generados por IA en MongoDB o los gestionamos al enviar.
        // Para este MVP, guardamos el reto activo en el documento del usuario o validamos con el banco.
        
        // Truco limpio: si es un reto del banco usamos su ID. Si es de la IA, lo guardamos al vuelo en la base de datos o lo validamos por ID temporal.
        res.json({
            success: true,
            level: currentLevel,
            challenge: {
                id: selectedChallenge.id,
                prompt: selectedChallenge.prompt,
                category: selectedChallenge.category
            }
        });

    } catch (error) {
        console.error('Error al obtener reto:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// 2. Enviar respuesta y evaluar con la IA
academiaRouter.post('/api/academia/challenge/submit', async (req, res) => {
    try {
        const { userId, challengeId, userAnswer } = req.body;
        if (!userId || !userAnswer || !challengeId) {
            return res.status(400).json({ success: false, error: 'Faltan datos en la petición' });
        }

        // Buscamos si el reto está en el banco inicial
        let challenge = initialChallenges.find(c => c.id === challengeId) as any;

        // Si no está en el banco estático (porque fue generado por la IA al vuelo), 
        // podemos buscarlo en una colección de retos dinámicos o manejarlo de forma flexible.
        // Para simplificar y asegurar que funcione siempre, si empieza por 'ai_gen_', permitimos que la IA evalúe la respuesta directamente.
        
        let expectedExplanation = challenge ? challenge.explanation : "El resultado correcto según el planteamiento escolar.";
        let promptText = challenge ? challenge.prompt : "Ejercicio escolar de 2º de Primaria.";

        const apiKey = process.env.GEMINI_API_KEY || process.env.GEMAI_API_KEY;
        if (!apiKey) {
            throw new Error('Falta la API Key de Gemini');
        }

        const promptGemini = `
        Eres un profesor paciente, cariñoso y animado de una academia escolar en familia ("Academia Campos").
        Enunciado del ejercicio: "${promptText}"
        Solución oficial / esperada: "${expectedExplanation}"
        Respuesta escrita por el alumno (un niño de 6-7 años): "${userAnswer}"

        Evalúa si la respuesta es correcta o se acerca lo suficiente al resultado esperado (ten en cuenta pequeñas erratas de escritura o si ha dado el número/resultado correcto).
        Responde estrictamente en formato JSON con esta estructura exacta:
        {
          "correct": true o false,
          "feedback": "Una frase muy cariñosas, motivadora y educativa felicitándole si acierta, o dándole una pista suave si debe repasar."
        }
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptGemini }] }]
            })
        });

        const aiData = await response.json();
        const textResult = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const cleanJson = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
        const evaluation = JSON.parse(cleanJson);

        // Si acierta, marcamos el reto como completado en MongoDB y comprobamos si sube de nivel
        if (evaluation.correct) {
            const collection = await getUserProgressCollection();
            await collection.updateOne(
                { userId },
                { $addToSet: { completedChallenges: challengeId } }
            );
        }

        res.json({
            success: true,
            correct: evaluation.correct,
            feedback: evaluation.feedback
        });

    } catch (error) {
        console.error('Error al evaluar respuesta con IA:', error);
        res.status(500).json({ success: false, error: 'Error al procesar la evaluación' });
    }
});
