
import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

import authRoutes from "./auth.js";
import { getCurrentEvent } from "./eventos.js";

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT) || 10000;

const MONGODB_URI = process.env.MONGODB_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!MONGODB_URI) {
    throw new Error("Falta la variable MONGODB_URI");
}

if (!SESSION_SECRET) {
    throw new Error("Falta la variable SESSION_SECRET");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicPath = path.resolve(__dirname, "../public");

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
            collectionName: "weblinegt_sessions",
            ttl: 7 * 24 * 60 * 60
        }),

        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        }
    })
);

app.use("/auth", authRoutes);

/* =========================================
   API: EVENTO ACTUAL
   ========================================= */

app.get("/api/evento", async (req, res) => {
    try {
        const user = (req.session as any).user;

        if (!user) {
            return res.status(401).json({
                error: "No has iniciado sesión."
            });
        }

        const evento = await getCurrentEvent();

        if (!evento) {
            return res.status(200).json({
                activo: false,
                mensaje: "No hay ningún evento publicado actualmente."
            });
        }

        return res.status(200).json({
            activo: true,
            evento
        });

    } catch (error) {
        console.error("❌ Error consultando el evento:", error);

        return res.status(500).json({
            error: "No se ha podido cargar el evento."
        });
    }
});

/* =========================================
   PÁGINA PRINCIPAL
   ========================================= */

app.get("/", (req, res) => {
    const user = (req.session as any).user;

    if (user) {
        return res.sendFile(path.join(publicPath, "index.html"));
    }

    return res.sendFile(path.join(publicPath, "login.html"));
});

/* =========================================
   ARCHIVOS PÚBLICOS
   ========================================= */

app.use(express.static(publicPath));

/* =========================================
   COMPROBACIÓN DEL SERVIDOR
   ========================================= */

app.get("/health", (_req, res) => {
    res.status(200).send("WEBLINEGT activo");
});

app.listen(PORT, () => {
    console.log(`WEBLINEGT activo en el puerto ${PORT}`);
});
