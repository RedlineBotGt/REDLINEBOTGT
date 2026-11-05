
import "dotenv/config";

import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./auth.js";
import eventRoutes from "./routes/eventRoutes.js";

// ======================================
// CONFIGURACIÓN GENERAL
// ======================================

const PORT = Number(process.env.PORT) || 10000;

const MONGODB_URI = process.env.MONGODB_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicPath = path.resolve(
  __dirname,
  "../public"
);

// ======================================
// COMPROBAR VARIABLES DE ENTORNO
// ======================================

if (!MONGODB_URI) {
  throw new Error("Falta la variable MONGODB_URI.");
}

if (!SESSION_SECRET) {
  throw new Error("Falta la variable SESSION_SECRET.");
}

if (!DISCORD_TOKEN) {
  throw new Error("Falta la variable DISCORD_TOKEN.");
}

// ======================================
// CREAR APLICACIÓN EXPRESS
// ======================================

const app = express();

app.set("trust proxy", 1);

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true
  })
);

// ======================================
// CONFIGURACIÓN DE SESIONES
// ======================================

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    store: MongoStore.create({
      mongoUrl: MONGODB_URI
    }),

    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })
);

// ======================================
// CONECTAR RUTAS
// ======================================

app.use("/auth", authRoutes);

app.use("/api", eventRoutes);

// ======================================
// PÁGINA PRINCIPAL
// ======================================

app.get("/", (req, res) => {
  const user = (req.session as any)?.user;

  if (!user) {
    return res.redirect("/auth/discord");
  }

  return res.sendFile(
    path.join(publicPath, "index.html")
  );
});

// ======================================
// ARCHIVOS PÚBLICOS
// ======================================

app.use(express.static(publicPath));

// ======================================
// COMPROBACIÓN DEL SERVIDOR
// ======================================

app.get("/health", (_req, res) => {
  return res.send("WEBLINEGT activo");
});

// ======================================
// ARRANCAR SERVIDOR
// ======================================

app.listen(PORT, () => {
  console.log(`WEBLINEGT activo en el puerto ${PORT}`);
  console.log("Sistema de autenticación conectado.");
  console.log("Sistema de eventos conectado.");
});
