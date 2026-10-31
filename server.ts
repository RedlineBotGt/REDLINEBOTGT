
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { generarPregunta } from "./services/aiService.ts";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inicio = Date.now();

// ========================================
// REGISTROS DE ARRANQUE
// ========================================

console.log("====================================");
console.log("   ACADEMIA CAMPOS - INICIANDO");
console.log("====================================");
console.log("[ARRANQUE] Node:", process.version);
console.log("[ARRANQUE] Puerto:", PORT);
console.log("[ARRANQUE] Entorno:", process.env.NODE_ENV || "no definido");
console.log("[ARRANQUE] Directorio:", __dirname);

if (process.env.GEMINI_API_KEY) {
  console.log("[CONFIG] GEMINI_API_KEY: configurada");
} else {
  console.warn("[CONFIG] GEMINI_API_KEY: NO CONFIGURADA");
}

// ========================================
// MIDDLEWARE
// ========================================

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Registrar peticiones HTTP
app.use((req, res, next) => {
  const comienzo = Date.now();

  res.on("finish", () => {
    console.log(
      `[HTTP] ${req.method} ${req.path} → ${res.statusCode} (${Date.now() - comienzo} ms)`
    );
  });

  next();
});

// Servir archivos de la web
app.use(express.static(path.join(__dirname, "public")));

// ========================================
// DIAGNÓSTICO GENERAL
// ========================================

app.get("/api/academia/status", (_req, res) => {
  res.json({
    ok: true,
    servicio: "Academia Campos",
    estado: "activo",
    tiempoActivo: Math.floor((Date.now() - inicio) / 1000),
    node: process.version,
    fecha: new Date().toISOString()
  });
});

// Diagnóstico de configuración
app.get("/api/academia/diagnostico", (_req, res) => {
  res.json({
    servidor: "activo",
    gemini: process.env.GEMINI_API_KEY
      ? "configurada"
      : "falta_api_key",
    puerto: PORT,
    node: process.version,
    memoria: {
      usada: Math.round(
        process.memoryUsage().heapUsed / 1024 / 1024
      ),
      total: Math.round(
        process.memoryUsage().heapTotal / 1024 / 1024
      )
    },
    tiempoActivo: Math.floor((Date.now() - inicio) / 1000)
  });
});

// ========================================
// INFORMACIÓN DE LA API
// ========================================

app.get("/api/academia", (_req, res) => {
  res.json({
    ok: true,
    message: "API de Academia Campos funcionando"
  });
});

// ========================================
// GENERAR PREGUNTA CON GEMINI
// ========================================

app.post("/api/academia/question", async (req, res) => {
  const { perfil, asignatura, nivel } = req.body || {};

  console.log("[GEMINI] Solicitud recibida");
  console.log("[GEMINI] Perfil:", perfil);
  console.log("[GEMINI] Asignatura:", asignatura);
  console.log("[GEMINI] Nivel:", nivel);

  if (!perfil || !asignatura || !nivel) {
    console.warn("[VALIDACIÓN] Faltan datos para generar pregunta");

    return res.status(400).json({
      ok: false,
      error: "Faltan perfil, asignatura o nivel"
    });
  }

  try {
    console.log("[GEMINI] Iniciando generación...");

    const pregunta = await generarPregunta(
      String(perfil),
      String(asignatura),
      String(nivel)
    );

    console.log("[GEMINI] Pregunta generada correctamente");

    return res.json({
      ok: true,
      pregunta
    });

  } catch (error) {
    console.error("[GEMINI] ERROR:", error);

    return res.status(502).json({
      ok: false,
      error: "Gemini no ha podido generar la pregunta. Inténtalo de nuevo."
    });
  }
});

// ========================================
// RUTAS NO ENCONTRADAS
// ========================================

app.use((req, res) => {
  console.warn("[404] Ruta inexistente:", req.method, req.path);

  res.status(404).json({
    ok: false,
    error: "Ruta no encontrada",
    ruta: req.path
  });
});

// ========================================
// ERRORES GENERALES
// ========================================

app.use((
  error: any,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction
) => {
  console.error("[ERROR SERVIDOR]", error);

  if (res.headersSent) return;

  res.status(500).json({
    ok: false,
    error: "Error interno del servidor"
  });
});

// ========================================
// ERRORES DE PROCESO
// ========================================

process.on("unhandledRejection", (error) => {
  console.error("[ERROR] Promesa no controlada:", error);
});

process.on("uncaughtException", (error) => {
  console.error("[ERROR FATAL] Excepción no controlada:", error);
  process.exit(1);
});

// ========================================
// ARRANQUE
// ========================================

app.listen(PORT, "0.0.0.0", () => {
  console.log("====================================");
  console.log("[OK] ACADEMIA CAMPOS ARRANCADA");
  console.log(`[OK] Puerto ${PORT}`);
  console.log("[OK] Servidor HTTP escuchando");
  console.log("====================================");
});
