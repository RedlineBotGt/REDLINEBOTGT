
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
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicPath = path.resolve(__dirname, "../public");

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
// SISTEMA DE CACHÉ DE NOMBRES DE DISCORD
// ======================================

const discordNameCache = new Map<
  string,
  {
    name: string;
    expiresAt: number;
  }
>();

// Los nombres correctos se guardan durante una hora.
const CACHE_DURATION = 60 * 60 * 1000;

// Los errores se guardan durante un minuto.
const ERROR_CACHE_DURATION = 60 * 1000;

// Evita consultar dos veces al mismo usuario
// mientras su primera consulta sigue pendiente.
const discordNamePending = new Map<
  string,
  Promise<string>
>();

// ======================================
// COLA DE PETICIONES A DISCORD
// ======================================

// Solo se realiza una consulta a la vez.
// Dejamos un intervalo entre peticiones.
let discordRequestQueue: Promise<void> = Promise.resolve();

let lastDiscordRequestAt = 0;

const MIN_REQUEST_INTERVAL = 1100;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function runDiscordRequest<T>(
  task: () => Promise<T>
): Promise<T> {

  const result = discordRequestQueue.then(async () => {

    const elapsed = Date.now() - lastDiscordRequestAt;

    const wait = MIN_REQUEST_INTERVAL - elapsed;

    if (wait > 0) {
      await sleep(wait);
    }

    return task();
  });

  discordRequestQueue = result.then(
    () => undefined,
    () => undefined
  );

  return result;
}

// ======================================
// CONSULTAR NOMBRE DE UN MIEMBRO
// ======================================

function getDiscordMemberName(
  guildId: string,
  userId: string
): Promise<string> {

  const cacheKey = `${guildId}:${userId}`;

  // Comprobar caché.
  const cached = discordNameCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.name);
  }

  // Si ya se está consultando, reutilizar esa petición.
  const pending = discordNamePending.get(cacheKey);

  if (pending) {
    return pending;
  }

  const requestPromise = runDiscordRequest(async () => {

    // Reintentar si Discord responde con límite de peticiones.
    const MAX_ATTEMPTS = 5;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {

      try {

        lastDiscordRequestAt = Date.now();

        const response = await fetch(
          `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
          {
            headers: {
              Authorization: `Bot ${DISCORD_TOKEN}`
            }
          }
        );

        // Discord está limitando las consultas.
        if (response.status === 429) {

          const responseText = await response.text();

          let retryAfter = 2;

          try {
            const data = JSON.parse(responseText);

            if (typeof data.retry_after === "number") {
              retryAfter = data.retry_after;
            }
          } catch {
            // Si no hay JSON, utilizamos la cabecera.
          }

          const headerRetry = Number(
            response.headers.get("retry-after")
          );

          if (Number.isFinite(headerRetry) && headerRetry > 0) {
            retryAfter = Math.max(retryAfter, headerRetry);
          }

          const waitMs = Math.ceil(retryAfter * 1000) + 300;

          console.warn(
            `Discord limita las consultas. Esperando ${Math.ceil(waitMs / 1000)} segundos. Usuario: ${userId}`
          );

          if (attempt < MAX_ATTEMPTS) {
            await sleep(waitMs);
            lastDiscordRequestAt = Date.now();
            continue;
          }

          console.error(
            `Discord mantuvo el límite de peticiones para ${userId} después de ${MAX_ATTEMPTS} intentos.`
          );

          return userId;
        }

        // Otros errores de Discord.
        if (!response.ok) {

          console.error(
            `Discord no pudo resolver el usuario ${userId}. Estado: ${response.status}`
          );

          return userId;
        }

        const member = await response.json() as {
          nick?: string | null;
          user?: {
            username?: string;
            global_name?: string | null;
          };
        };

        const name =
          member.nick ||
          member.user?.global_name ||
          member.user?.username ||
          userId;

        return name;

      } catch (error) {

        console.error(
          `Error consultando el nombre de Discord ${userId}:`,
          error
        );

        return userId;
      }
    }

    return userId;

  }).then(name => {

    // Guardar nombre o ID en caché.
    discordNameCache.set(cacheKey, {
      name,
      expiresAt: Date.now() + (
        name === userId
          ? ERROR_CACHE_DURATION
          : CACHE_DURATION
      )
    });

    return name;

  }).catch(error => {

    console.error(
      `Error en la cola de Discord para ${userId}:`,
      error
    );

    discordNameCache.set(cacheKey, {
      name: userId,
      expiresAt: Date.now() + ERROR_CACHE_DURATION
    });

    return userId;

  }).finally(() => {

    discordNamePending.delete(cacheKey);

  });

  discordNamePending.set(cacheKey, requestPromise);

  return requestPromise;
}

// ======================================
// RESOLVER NOMBRES DE LAS LISTAS
// ======================================

async function resolveEventPilotNames(evento: any) {

  const rsvps = evento.rsvps || {};

  const yes = Array.isArray(rsvps.yes)
    ? rsvps.yes
    : [];

  const reserve = Array.isArray(rsvps.reserve)
    ? rsvps.reserve
    : [];

  const maybe = Array.isArray(rsvps.maybe)
    ? rsvps.maybe
    : [];

  const no = Array.isArray(rsvps.no)
    ? rsvps.no
    : [];

  const allIds = [
    ...new Set([
      ...yes,
      ...reserve,
      ...maybe,
      ...no
    ].map((id: unknown) => String(id)))
  ];

  const names = new Map<string, string>();

  // Aunque se use Promise.all, las consultas reales
  // pasan por la cola y se ejecutan de una en una.
  await Promise.all(
    allIds.map(async (userId) => {

      const name = await getDiscordMemberName(
        String(evento.guildId),
        userId
      );

      names.set(userId, name);
    })
  );

  return {
    yes: yes.map((id: unknown) =>
      names.get(String(id)) || String(id)
    ),

    reserve: reserve.map((id: unknown) =>
      names.get(String(id)) || String(id)
    ),

    maybe: maybe.map((id: unknown) =>
      names.get(String(id)) || String(id)
    ),

    no: no.map((id: unknown) =>
      names.get(String(id)) || String(id)
    )
  };
}

// ======================================
// CONFIGURACIÓN DE EXPRESS
// ======================================

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

// ======================================
// RUTAS DE AUTENTICACIÓN
// ======================================

app.use("/auth", authRoutes);

// ======================================
// API DEL EVENTO ACTUAL
// ======================================

app.get("/api/evento", async (req, res) => {

  try {

    const sessionData = req.session as any;

    if (!sessionData.user?.id) {
      return res.status(401).json({
        error: "No has iniciado sesión."
      });
    }

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

    // Consultar roles reales del usuario.
    const userRoles = await getDiscordUserRoles(
      req,
      evento.guildId
    );

    const esTitular = userRoles.includes(ROLE_TITULAR);
    const esReserva = userRoles.includes(ROLE_RESERVA);

    const permisos = {
      esTitular,
      esReserva,

      puedeSerTitular:
        esTitular && !esReserva,

      puedeSerReserva:
        esReserva && !esTitular
    };

    // Resolver nombres de los pilotos.
    const rsvpNames = await resolveEventPilotNames(
      evento
    );

    return res.json({
      activo: true,
      evento,
      rsvpNames,
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

// ======================================
// ARCHIVOS PÚBLICOS
// ======================================

app.use(express.static(publicPath));

// ======================================
// PÁGINA PRINCIPAL
// ======================================

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

// ======================================
// COMPROBACIÓN DEL SERVIDOR
// ======================================

app.get("/health", (_req, res) => {

  return res.json({
    status: "ok",
    service: "WEBLINEGT"
  });
});

// ======================================
// INICIAR SERVIDOR
// ======================================

app.listen(PORT, () => {

  console.log(
    `WEBLINEGT activo en el puerto ${PORT}`
  );

  console.log(
    "Resolución de nombres de Discord activada."
  );

  console.log(
    "Cola de consultas de Discord activada."
  );
});
