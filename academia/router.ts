import express, { Router } from 'express';
import { getUserProgressCollection } from './models';
import { initialChallenges } from './challengesData';

export const academiaRouter = Router();

academiaRouter.use(express.json());

// 1. Obtener el siguiente reto
academiaRouter.post('/api/academia/challenge/next', async (req, res) => {
    console.log('🔍 [Academia] Recibida petición POST /api/academia/challenge/next con body:', req.body);
    try {
        const { userId } = req.body;
        if (!userId) {
            console.log('⚠️ [Academia] Falta el userId');
            return res.status(400).json({ success: false, error: 'Falta el userId' });
        }

        console.log('📦 [Academia] Conectando con MongoDB para usuario:', userId);
        const collection = await getUserProgressCollection();
        let userProgress = await collection.findOne({ userId });

        if (!userProgress) {
            console.log('👤 [Academia] Usuario nuevo, inicializando en Nivel 1');
            userProgress = { userId, currentLevel: 1, completedChallenges: [] };
            await collection.insertOne(userProgress);
        }

        const currentLevel = userProgress.currentLevel || 1;
        const completed = userProgress.completedChallenges || [];
        console.log(`📊 [Academia] Nivel actual: ${currentLevel}, Retos completados: ${completed.length}`);

        let availableChallenges = initialChallenges.filter(
            c => c.level === currentLevel && !completed.includes(c.id)
        );

        let selectedChallenge: { id: string; prompt: string; category: string; explanation: string };

        if (availableChallenges.length > 0) {
            console.log('📚 [Academia] Seleccionando reto del banco estático...');
            const c = availableChallenges[0];
            selectedChallenge = { id: c.id, prompt: c.prompt, category: c.category, explanation: c.explanation };
        } else {
            console.log('🤖 [Academia] Banco agotado para este nivel. Solicitando reto a la IA...');
            const apiKey = process.env.GEMINI_API_KEY || process.env.GEMAI_API_KEY;
            
            if (!apiKey) {
                console.log('⚠️ [Academia] No hay API Key de Gemini, usando fallback del banco.');
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

                console.log('🚀 [Academia] Enviando petición HTTP a Google Gemini...');
                const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: promptGen }] }] })
                });

                console.log('📥 [Academia] Respuesta recibida de Gemini, procesando JSON...');
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

        console.log('✅ [Academia] Enviando reto seleccionado al cliente:', selectedChallenge.id);
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
        console.error('❌ [Academia Error en /next]:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor en academia' });
    }
});

// 2. Enviar respuesta y evaluar
academiaRouter.post('/api/academia/challenge/submit', async (req, res) => {
    console.log('🔍 [Academia] Recibida petición POST /api/academia/challenge/submit');
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

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: promptGemini }] }] })
        });

        const aiData = await response.json();
        const textResult = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const cleanJson = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
        const evaluation = JSON.parse(cleanJson);

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
        console.error('❌ [Academia Error en /submit]:', error);
        res.status(500).json({ success: false, error: 'Error al procesar la evaluación' });
    }
});
