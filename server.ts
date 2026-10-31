
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { generarPregunta } from "./services/aiService.ts";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Servir la página web
app.use(express.static(path.join(__dirname, "public")));

// Comprobar el estado del servidor
app.get("/api/academia/status", (_req, res) => {
  res.json({
    ok: true,
    message: "Academia Campos está funcionando"
  });
});

// Información de la API
app.get("/api/academia", (_req, res) => {
  res.json({
    ok: true,
    message: "API de Academia Campos"
  });
});

// Generar una pregunta con Gemini
app.post("/api/academia/question", async (req, res) => {
  try {
    const { perfil, asignatura, nivel } = req.body;

    if (!perfil || !asignatura || !nivel) {
      return res.status(400).json({
        ok: false,
        error: "Faltan perfil, asignatura o nivel"
      });
    }

    const pregunta = await generarPregunta(
      String(perfil),
      String(asignatura),
      String(nivel)
    );

    return res.json({
      ok: true,
      pregunta
    });

  } catch (error) {
    console.error("Error generando pregunta:", error);

    return res.status(500).json({
      ok: false,
      error: "No se pudo generar la pregunta. Inténtalo de nuevo."
    });
  }
});

// Arrancar servidor
app.listen(PORT, () => {
  console.log(`Academia Campos activa en el puerto ${PORT}`);
});
