import express, { Router } from 'express';
import { getUserProgressCollection } from './models';
import { initialChallenges } from './challengesData';

export const academiaRouter = Router();

academiaRouter.use(express.json());

// Función auxiliar para añadir timeout a cualquier promesa (evita que se quede colgado eternamente)
function conTimeout<T>(promesa: Promise<T>, ms: number = 8000): Promise<T> {
    return Promise.race([
        promesa,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('⏱️ Timeout: La operación ha tardado demasiado en responder')), ms))
    ]);
}

// 1. Obtener el siguiente reto
academiaRouter.post('/api/academia/challenge/next', async (req, res) => {
    console.log('🔍 [Academia] Petición recibida en /next con body:', req.body);
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, error: 'Falta el userId' });
        }

        console.log('📦 [Academia] Intentando conectar con MongoDB...');
        // Protegemos la llamada a MongoDB con un timeout de 6 segundos
        const collection = await conTimeout(getUserProgressCollection(), 6000);
        
        console.log('📦 [Academia] Buscando progreso para usuario:', userId);
        let userProgress = await conTimeout(collection.findOne({ userId }), 5000);

        if (!userProgress) {
            console.log('👤 [Academia] Usuario nuevo, creando registro en Nivel 1...');
            userProgress = { userId, currentLevel: 1, completedChallenges: [] };
            await conTimeout(collection.insertOne(userProgress), 5000);
        }

        const currentLevel = userProgress.currentLevel || 1;
        const completed = userProgress.completedChallenges || [];

        let availableChallenges = initialChallenges.filter(
            c => c.level === currentLevel && !completed.includes(c.id)
        );

        let selectedChallenge: { id: string; prompt: string; category: string; explanation: string };

        if (availableChallenges.length > 0) {
            console.log('📚 [Academia] Cogiendo reto del banco estático.');
            const c = availableChallenges[0];
            selectedChallenge = { id: c.id, prompt: c.prompt, category: c.category, explanation: c.explanation };
        } else {
            console.log('🤖 [Academia] Banco agotado. Solicitando reto a la IA...');
            const apiKey = process.env.GEMINI_API_KEY || process.env.GEMAI_API_KEY;
            
            if (!apiKey) {
                console.log('⚠️ [Academia] No hay API Key, usando fallback.');
                const fallback = initialChallenges[0];
                selectedChallenge = { id: 'fb_' + Date.now(), prompt: fallback.prompt, category: fallback.category, explanation: fallback.explanation };
            } else {
                const promptGen = `
                Eres un profesor experto en educación primaria en España, diseñando fichas de ejercicios para niños de 6-7 años (nivel 2º de Primaria).
                Genera un único problema o ejercicio escolar nuevo de Matemáticas o Lengua adecuado para el Nivel ${currentLevel}.
                Responde estrictamente en formato JSON plano con esta estructura:
                {
                  "category": "Matemáticas 🔢" o "Lengua 📖" o "Problemas 🧩",
                  "prompt": "El enunciado claro, motivador y directo del problema o ejercicio.",
                  "explanation": "La solución exacta y una breve explicación para corregirlo."
                }
                `;

                const aiRes = await conTimeout(fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: promptGen }] }] })
                }), 8000);

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
            }
        }

        console.log('✅ [Academia] Enviando reto al cliente con éxito.');
        return res.json({
            success: true,
            level: currentLevel,
            challenge: {
                id: selectedChallenge.id,
                prompt: selectedChallenge.prompt,
                category: selectedChallenge.category
            }
        });

    } catch (error: any) {
        console.error('❌ [Academia Error Crítico en /next]:', error.message || error);
        return res.status(500).json({ success: false, error: error.message || 'Error interno del servidor' });
    }
});

// 2. Enviar respuesta y evaluar
academiaRouter.post('/api/academia/challenge/submit', async (req, res) => {
    console.log('🔍 [Academia] Petición recibida en /submit');
    try {
        const { userId, challengeId, userAnswer } = req.body;
        if (!userId || !userAnswer || !challengeId) {
            return res.status(400).json({ success: false, error: 'Faltan datos en la petición' });
        }

        let challenge = initialChallenges.find(c => c.id === challengeId) as any;
        let expectedExplanation = challenge ? challenge.explanation : "El resultado correcto según el planteamiento escolar.";
        let promptText = challenge ? challenge.prompt : "Ejercicio escolar de 2º de Primaria.";

        const apiKey = process.env.GEMINI_API_KEY || process.env.GEMAI_API_KEY;
        if (!apiKey) {
            throw new Error('Falta la API Key de Gemini');
        }

        const promptGemini = `
        Eres un profesor paciente y cariñoso de una academia escolar en familia ("Academia Campos").
        Enunciado: "${promptText}"
        Solución esperada: "${expectedExplanation}"
        Respuesta del alumno (6-7 años): "${userAnswer}"
        Evalúa si es correcta. Responde estrictamente en JSON:
        {
          "correct": true o false,
          "feedback": "Frase cariñosa y motivadora."
        }
        `;

        const response = await conTimeout(fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: promptGemini }] }] })
        }), 8000);

        const aiData = await response.json();
        const textResult = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const cleanJson = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
        const evaluation = JSON.parse(cleanJson);

        if (evaluation.correct) {
            const collection = await conTimeout(getUserProgressCollection(), 5000);
            await conTimeout(collection.updateOne(
                { userId },
                { $addToSet: { completedChallenges: challengeId } }
            ), 5000);
        }

        return res.json({
            success: true,
            correct: evaluation.correct,
            feedback: evaluation.feedback
        });

    } catch (error: any) {
        console.error('❌ [Academia Error Crítico en /submit]:', error.message || error);
        return res.status(500).json({ success: false, error: error.message || 'Error al procesar la evaluación' });
    }
});
