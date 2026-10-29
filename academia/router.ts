// academia/routers.ts
import express, { Router, Request, Response } from 'express';
import path from 'path';
import { UserProgress } from './models';

export const academiaRouter = Router();

// Servir archivos estáticos (HTML, CSS, JS)
const publicPath = path.join(__dirname, 'public');
academiaRouter.use(express.static(publicPath));

// Ruta principal
academiaRouter.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Endpoint: Obtener el siguiente reto adaptado según el nivel en MongoDB
academiaRouter.post('/api/academia/challenge/next', async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, error: "Usuario no especificado" });
        }

        // Buscar o crear el progreso del usuario en MongoDB
        let progress = await UserProgress.findOne({ userId });
        if (!progress) {
            progress = await UserProgress.create({ userId, currentLevel: 1, streak: 0, history: [] });
        }

        // Banco de retos de pensamiento lateral (nivel base 2º Primaria con chispa de lógica)
        const bancoRetos = [
            {
                id: "p_lat_01",
                level: 1,
                prompt: "Vas conduciendo un autobús. En la primera parada suben 4 personas. En la segunda baja 1 y suben 3. En la tercera bajan 2. ¿De qué color son los ojos del conductor?"
            },
            {
                id: "p_lat_02",
                level: 2,
                prompt: "Tengo un granero con tres interruptores fuera que encienden tres bombillas dentro. Desde fuera no se ve el interior. Si solo puedes entrar una vez a mirar, ¿cómo averiguas qué interruptor enciende cada bombilla?"
            },
            {
                id: "p_lat_03",
                level: 3,
                prompt: "Un murciélago y una pelota cuestan juntos 1,10 euros en total. El murciélago cuesta 1 euro más que la pelota. ¿Cuánto cuesta la pelota?"
            }
        ];

        // Seleccionar un reto acorde al nivel actual del usuario
        const retoActual = bancoRetos.find(r => r.level === progress.currentLevel) || bancoRetos[0];

        res.json({
            success: true,
            level: progress.currentLevel,
            challenge: retoActual
        });
    } catch (error) {
        console.error("Error al obtener reto:", error);
        res.status(500).json({ success: false, error: "Error al generar el reto" });
    }
});

// Endpoint: Evaluar respuesta y actualizar MongoDB
academiaRouter.post('/api/academia/challenge/submit', async (req: Request, res: Response) => {
    try {
        const { userId, userAnswer } = req.body;
        if (!userId || !userAnswer) {
            return res.status(400).json({ success: false, error: "Datos incompletos" });
        }

        let progress = await UserProgress.findOne({ userId });
        if (!progress) {
            progress = await UserProgress.create({ userId, currentLevel: 1, streak: 0, history: [] });
        }

        // Simulación de validación inteligente (en el siguiente paso lo enlazaremos con la IA generativa)
        const feedbackText = `¡Impresionante razonamiento, ${userId.toUpperCase()}! Has analizado el problema saliendo de lo habitual. Tu nivel de lógica es excelente.`;

        // Guardar en el historial y subir un nivel como recompensa
        progress.history.push({
            challengePrompt: "Reto de Pensamiento Lateral",
            userAnswer,
            aiFeedback: feedbackText,
            solvedAt: new Date()
        });
        progress.currentLevel += 1; // Sube de nivel dinámicamente
        await progress.save();

        res.json({
            success: true,
            correct: true,
            feedback: feedbackText
        });
    } catch (error) {
        console.error("Error al procesar respuesta:", error);
        res.status(500).json({ success: false, error: "Error al procesar la respuesta" });
    }
});
