
import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

import authRoutes, {
  getDiscordUserRoles
} from "./auth.js";

import { getCurrentEvent } from "./eventos.js";
import {
  ROLE_TITULAR,
  ROLE_RESERVA
} from "./eventos.js";

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT) || 10000;

const MONGODB_URI = process.env.MONGODB_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;
const BASE_URL = process.env.BASE_URL;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicPath = path.resolve(__dirname, "../public");

if (!MONGODB_URI) {
  throw new Error("Falta la variable MONGODB_URI.");
}

if (!SESSION_SECRET) {
  throw new Error("Falta la variable SESSION_SECRET.");
}

app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: "weblinegt.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    store: MongoStore.create({
      mongoUrl: MONGODB_URI,
      collectionName: "weblinegt_sessions"
    }),

    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })
);

// RUTAS DE AUTENTICACIÓN
app.use("/auth", authRoutes);

// API DEL EVENTO ACTUAL
app.get("/api/evento", async (req, res) => {
  try {
    const sessionData = req.session as any;

    if (!sessionData.user?.id) {
      return res.status(401).json({
        error: "No has iniciado sesión."
      });
    }

    // OBTENER EVENTO ACTUAL
    const evento = await getCurrentEvent();

    if (!evento) {
      return res.json({
        activo: false,
        mensaje: "No hay ningún evento publicado.",
        evento: null,
        permisos: null
      });
    }

    if (!evento.guildId) {
      console.error(
        "El evento no contiene guildId."
      );

      return res.status(500).json({
        error: "El evento no tiene identificado su servidor de Discord."
      });
    }

    // CONSULTAR LOS ROLES REALES DEL USUARIO
    const userRoles = await getDiscordUserRoles(
      req,
      evento.guildId
    );

    const esTitular = userRoles.includes(ROLE_TITULAR);
    const esReserva = userRoles.includes(ROLE_RESERVA);

    // APLICAR LAS RESTRICCIONES DE TITULAR Y RESERVA
    const permisos = {
      esTitular,
      esReserva,

      puedeSerTitular:
        esTitular && !esReserva,

      puedeSerReserva:
        esReserva && !esTitular
    };

    return res.json({
      activo: true,
      evento,
      permisos
    });

  } catch (error) {
    console.error(
      "Error obteniendo evento y permisos:",
      error
    );

    return res.status(502).json({
      error: error instanceof Error
        ? error.message
        : "No se pudo obtener el evento y los permisos."
    });
  }
});

// ARCHIVOS PÚBLICOS
app.use(express.static(publicPath));

// PÁGINA PRINCIPAL
app.get("/", (req, res) => {
  const sessionData = req.session as any;

  if (sessionData.user) {
    return res.sendFile(
      path.join(publicPath, "index.html")
    );
  }

  return res.sendFile(
    path.join(publicPath, "login.html")
  );
});

// COMPROBACIÓN DEL SERVIDOR
app.get("/health", (_req, res) => {
  return res.json({
    status: "ok",
    service: "WEBLINEGT"
  });
});

// INICIAR SERVIDOR
app.listen(PORT, () => {
  console.log(
    `WEBLINEGT activo en el puerto ${PORT}`
  );
});
