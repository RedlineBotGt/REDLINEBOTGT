import express, { Router } from 'express';
import path from 'path';

export const academiaRouter = Router();

// Servir archivos estáticos (HTML, CSS, JS) de la carpeta academia/public
const publicPath = path.join(__dirname, 'public');
academiaRouter.use(express.static(publicPath));

// Ruta principal de la academia
academiaRouter.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});
