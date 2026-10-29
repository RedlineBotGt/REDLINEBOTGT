//academia/routers.ts
import express, { Router, Request, Response } from 'express';
import path from 'path';

export const academiaRouter = Router();

// Servir archivos estáticos (HTML, CSS, JS) de la carpeta academia/public
const publicPath = path.join(__dirname, 'public');
academiaRouter.use(express.static(publicPath));

// Ruta principal de la academia
academiaRouter.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Endpoint: Obtener el siguiente reto de pensamiento lateral adaptado
academiaRouter.post('/api/academia/challenge/next', async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        
        // TODO: Consultar en MongoDB el nivel actual de userId (ej. nivel de Leo)
        // Por ahora simulamos un reto dinámico de pensamiento lateral nivel 2º Primaria (altas capacidades)
        
        const retosEjemplo = [
            {
                id: "p_lat_01",
                prompt: "Vas conduciendo un autobús. En la primera parada suben 4 personas. En la segunda baja 1 y suben 3. En la tercera bajan 2. ¿De qué color son los ojos del conductor?"
            },
            {
                id: "p_lat_02",
                prompt: "Tengo un granero con tres interruptores fuera que encienden tres bombillas dentro. Desde fuera no se ve el interior. ¿Cómo puedes averiguar qué interruptor enciende cada bombilla si solo puedes entrar una vez a mirar?"
            }
        ];

        // Seleccionar uno de ejemplo de forma aleatoria o secuencial
        const retoAleatorio = retosEjemplo[Math.floor(Math.random() * retosEjemplo.length)];

        res.json({
            success: true,
            level: userId === 'leo' ? 2 : 1, // Ejemplo de adaptación por perfil
            challenge: retoAleatorio
        });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al generar el reto" });
    }
});

// Endpoint: Evaluar la respuesta del usuario con la IA
academiaRouter.post('/api/academia/challenge/submit', async (req: Request, res: Response) => {
    try {
        const { userId, userAnswer } = req.body;

        // Aquí conectaremos con el servicio de IA para evaluar si el razonamiento es brillante
        // y ajustar las estadísticas en MongoDB para el usuario.

        res.json({
            success: true,
            correct: true,
            feedback: `¡Excelente uso de la lógica, ${userId.toUpperCase()}! Has analizado el problema desde otra perspectiva y tu razonamiento es completamente acertado.`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al procesar la respuesta" });
    }
});
