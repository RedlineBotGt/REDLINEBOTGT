
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import questionsRouter from "./routes/questions.ts";
import homeworkRouter from "./routes/homework.ts";

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

if (process.env.MONGODB_URI) {
  console.log("[CONFIG] MONGODB_URI: configurada");
} else {
  console.warn("[CONFIG] MONGODB_URI: NO CONFIGURADA");
}

if (process.env.PAPA_PIN && process.env.PAPA_SESSION_SECRET) {
  console.log("[CONFIG] Acceso privado de Papá: configurado");
} else {
  console.warn("[CONFIG] Acceso privado de Papá: incompleto");
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

// ========================================
// ARCHIVOS DE LA WEB
// ========================================

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

// ========================================
// DIAGNÓSTICO DE CONFIGURACIÓN
// ========================================

app.get("/api/academia/diagnostico", (_req, res) => {
  res.json({
    servidor: "activo",
    gemini: process.env.GEMINI_API_KEY
      ? "configurada"
      : "falta_api_key",
    mongodb: process.env.MONGODB_URI
      ? "configurada"
      : "falta_configuracion",
    accesoPapa:
      process.env.PAPA_PIN && process.env.PAPA_SESSION_SECRET
        ? "configurado"
        : "incompleto",
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
// RUTAS DE FUNCIONALIDADES
// ========================================

// Preguntas y generación con Gemini
app.use("/api/academia", questionsRouter);

// Gestión de deberes
app.use("/api/academia", homeworkRouter);

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
  console.log("[OK] Rutas de preguntas registradas");
  console.log("[OK] Rutas de deberes registradas");
  console.log("====================================");
});
