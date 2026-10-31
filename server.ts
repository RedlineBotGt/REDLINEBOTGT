import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Servir la web
app.use(express.static(path.join(__dirname, "public")));

// Comprobar que el servidor funciona
app.get("/api/academia/status", (_req, res) => {
  res.json({
    ok: true,
    message: "Academia Campos está funcionando"
  });
});

// Ruta principal de la API
app.get("/api/academia", (_req, res) => {
  res.json({
    ok: true,
    message: "API de Academia Campos"
  });
});

app.listen(PORT, () => {
  console.log(`Academia Campos activa en el puerto ${PORT}`);
});