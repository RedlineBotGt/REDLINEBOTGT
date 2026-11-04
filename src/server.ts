import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

import authRoutes, {
  getDiscordUserRoles
} from "./auth.js";

import {
  getCurrentEvent,
  getEventsCollection,
  ROLE_TITULAR,
  ROLE_RESERVA
} from "./eventos.js";

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT) || 10000;

const MONGODB_URI = process.env.MONGODB_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

const DISCORD_API = "https://discord.com/api/v10";

const MAX_PILOTOS = 15;

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
// CACHÉ DE NOMBRES DE DISCORD
// ======================================

const discordNameCache = new Map<
  string,
  {
    name: string;
    expiresAt: number;
  }
>();

const CACHE_DURATION = 60 * 60 * 1000;
const ERROR_CACHE_DURATION = 60 * 1000;

const discordNamePending = new Map<
  string,
  Promise<string>
>();

// ======================================
// COLA DE PETICIONES A DISCORD
// ======================================

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

  const cached = discordNameCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.name);
  }

  const pending = discordNamePending.get(cacheKey);

  if (pending) {
    return pending;
  }

  const requestPromise = runDiscordRequest(async () => {
    const MAX_ATTEMPTS = 5;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        lastDiscordRequestAt = Date.now();

        const response = await fetch(
          `${DISCORD_API}/guilds/${guildId}/members/${userId}`,
          {
            headers: {
              Authorization: `Bot ${DISCORD_TOKEN}`
            }
          }
        );

        if (response.status === 429) {
          const responseText = await response.text();

          let retryAfter = 2;

          try {
            const data = JSON.parse(responseText);

            if (typeof data.retry_after === "number") {
              retryAfter = data.retry_after;
            }
          } catch {
            // Se utiliza el tiempo predeterminado.
          }

          const headerRetry = Number(
            response.headers.get("retry-after")
          );

          if (Number.isFinite(headerRetry) && headerRetry > 0) {
            retryAfter = Math.max(retryAfter, headerRetry);
          }

          const waitMs = Math.ceil(retryAfter * 1000) + 300;

          console.warn(
            `Discord limita las consultas. Esperando ${Math.ceil(waitMs / 1000)} segundos.`
          );

          if (attempt < MAX_ATTEMPTS) {
            await sleep(waitMs);
            lastDiscordRequestAt = Date.now();
            continue;
          }

          return userId;
        }

        if (!response.ok) {
          console.error(
            `Discord no pudo resolver ${userId}. Estado: ${response.status}`
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

        return (
          member.nick ||
          member.user?.global_name ||
          member.user?.username ||
          userId
        );

      } catch (error) {
        console.error(
          `Error consultando el nombre ${userId}:`,
          error
        );

        return userId;
      }
    }

    return userId;

  }).then(name => {
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

  const yes = Array.isArray(rsvps.yes) ? rsvps.yes : [];
  const reserve = Array.isArray(rsvps.reserve) ? rsvps.reserve : [];
  const maybe = Array.isArray(rsvps.maybe) ? rsvps.maybe : [];
  const no = Array.isArray(rsvps.no) ? rsvps.no : [];

  const allIds = [
    ...new Set([
      ...yes,
      ...reserve,
      ...maybe,
      ...no
    ].map((id: unknown) => String(id)))
  ];

  const names = new Map<string, string>();

  await Promise.all(
    allIds.map(async userId => {
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
// PETICIONES DEL BOT A DISCORD
// ======================================

async function discordBotRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const response = await fetch(
    `${DISCORD_API}${endpoint}`,
    {
      ...options,
      headers: {
        Authorization: `Bot ${DISCORD_TOKEN}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    }
  );

  if (!response.ok) {
    const details = await response.text();

    throw new Error(
      `Discord API ${response.status}: ${details}`
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// ======================================
// GESTIONAR EL ROL ASISTENTE
// ======================================

async function setAssistantRole(
  guildId: string,
  userId: string,
  add: boolean
): Promise<void> {
  try {
    const roles = await discordBotRequest(
      `/guilds/${guildId}/roles`
    );

    let assistantRole = roles.find(
      (role: any) =>
        String(role.name).toLowerCase() === "asistente"
    );

    if (add && !assistantRole) {
      assistantRole = await discordBotRequest(
        `/guilds/${guildId}/roles`,
        {
          method: "POST",
          body: JSON.stringify({
            name: "asistente",
            color: 0x00FF00,
            mentionable: true,
            reason: "Rol automático de asistencia WEBLINEGT."
          })
        }
      );
    }

    if (!assistantRole?.id) {
      return;
    }

    const endpoint =
      `/guilds/${guildId}/members/${userId}/roles/${assistantRole.id}`;

    await discordBotRequest(endpoint, {
      method: add ? "PUT" : "DELETE"
    });

  } catch (error) {
    console.error(
      `No se pudo ${add ? "añadir" : "retirar"} el rol asistente a ${userId}:`,
      error
    );
  }
}

// ======================================
// RECONSTRUIR EL MENSAJE DEL EVENTO
// ======================================

function buildDiscordEventMessage(eventDoc: any) {
  const rsvps = eventDoc.rsvps || {};

  const yes = Array.isArray(rsvps.yes) ? rsvps.yes : [];
  const reserve = Array.isArray(rsvps.reserve) ? rsvps.reserve : [];
  const maybe = Array.isArray(rsvps.maybe) ? rsvps.maybe : [];
  const no = Array.isArray(rsvps.no) ? rsvps.no : [];

  const formatList = (ids: string[]) =>
    ids.length > 0
      ? ids.map(id => `<@${id}>`).join("\n")
      : "Ninguno";

  const isClosed =
    eventDoc.status === "completed" ||
    eventDoc.status === "cancelled";

  const description =
    `📅 **Fecha:** ${eventDoc.date || "Por determinar"} a las ${eventDoc.time || "00:00"} CET\n\n` +
    `${eventDoc.description || "Sin descripción"}`;

  const embed: any = {
    color: isClosed ? 0x808080 : 0x0055FF,
    title: isClosed
      ? `🔒 [FINALIZADO] ${eventDoc.title}`
      : `🏁 ${eventDoc.title}`,
    description,
    fields: [
      {
        name: `✅ Titulares (${yes.length}/15)`,
        value: formatList(yes),
        inline: false
      },
      {
        name: `🔃 Reservas (${reserve.length}/11)`,
        value: formatList(reserve),
        inline: false
      },
      {
        name: `❔ Duda (${maybe.length})`,
        value: formatList(maybe),
        inline: false
      },
      {
        name: `❌ No puedo (${no.length})`,
        value: formatList(no),
        inline: false
      }
    ],
    timestamp: new Date().toISOString()
  };

  if (
    eventDoc.image &&
    typeof eventDoc.image === "string" &&
    eventDoc.image.startsWith("http")
  ) {
    embed.image = {
      url: eventDoc.image
    };
  }

  const button = (
    customId: string,
    label: string,
    style: number,
    emoji: string
  ) => ({
    type: 2,
    custom_id: customId,
    label,
    style,
    emoji: {
      name: emoji
    },
    disabled: isClosed
  });

  const rowRsvp = {
    type: 1,
    components: [
      button("event_rsvp_yes", "Titulares", 3, "✅"),
      button("event_rsvp_reserve", "Reserva", 1, "🔃"),
      button("event_rsvp_maybe", "Duda", 2, "❓"),
      button("event_rsvp_no", "No puedo", 4, "✖️")
    ]
  };

  const rowAdmin = {
    type: 1,
    components: [
      {
        type: 2,
        custom_id: "event_admin_manage",
        label: "Gestión Admin",
        style: 2,
        emoji: {
          name: "⚙️"
        },
        disabled: isClosed
      }
    ]
  };

  return {
    embeds: [embed],
    components: isClosed
      ? [rowRsvp]
      : [rowRsvp, rowAdmin]
  };
}

// ======================================
// ACTUALIZAR MENSAJE ORIGINAL DE DISCORD
// ======================================

async function updateDiscordEventMessage(
  eventDoc: any
): Promise<void> {
  if (!eventDoc.channelId || !eventDoc.messageId) {
    throw new Error(
      "El evento no tiene channelId o messageId."
    );
  }

  await discordBotRequest(
    `/channels/${eventDoc.channelId}/messages/${eventDoc.messageId}`,
    {
      method: "PATCH",
      body: JSON.stringify(
        buildDiscordEventMessage(eventDoc)
      )
    }
  );
}

// ======================================
// PROMOCIONAR PRIMERA RESERVA
// ======================================

async function promoteFirstReserve(
  eventDoc: any
): Promise<string | null> {
  if (!eventDoc.reminderSent) {
    return null;
  }

  const scheduledAt = new Date(
    eventDoc.scheduledAt
  ).getTime();

  if (
    !Number.isFinite(scheduledAt) ||
    scheduledAt <= Date.now()
  ) {
    return null;
  }

  if (!Array.isArray(eventDoc.rsvps.reserve)) {
    return null;
  }

  if (!Array.isArray(eventDoc.rsvps.yes)) {
    eventDoc.rsvps.yes = [];
  }

  if (eventDoc.rsvps.yes.length >= MAX_PILOTOS) {
    return null;
  }

  let promotedUserId: string | null = null;

  while (eventDoc.rsvps.reserve.length > 0) {
    const candidateId = eventDoc.rsvps.reserve.shift();

    if (
      typeof candidateId === "string" &&
      candidateId.length > 0 &&
      !eventDoc.rsvps.yes.includes(candidateId)
    ) {
      promotedUserId = candidateId;
      break;
    }
  }

  if (!promotedUserId) {
    return null;
  }

  eventDoc.rsvps.yes.push(promotedUserId);

  await setAssistantRole(
    String(eventDoc.guildId),
    promotedUserId,
    true
  );

  return promotedUserId;
}

// ======================================
// AVISAR AL RESERVA PROMOCIONADO
// ======================================

async function notifyPromotedReserve(
  eventDoc: any,
  userId: string
): Promise<void> {
  try {
    await discordBotRequest(
      `/channels/${eventDoc.channelId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          content:
            `🎉 <@${userId}> **¡Has conseguido plaza como TITULAR!**\n` +
            `Se ha producido una baja en el evento **"${eventDoc.title}"** y entras por orden de reserva.\n` +
            `¡Te esperamos en pista!`,
          allowed_mentions: {
            users: [userId]
          }
        })
      }
    );
  } catch (error) {
    console.error(
      "Error avisando al reserva promocionado:",
      error
    );
  }
}
// ======================================
// EVITAR MODIFICACIONES SIMULTÁNEAS
// ======================================

const eventLocks = new Map<string, Promise<void>>();

async function withEventLock<T>(
  key: string,
  action: () => Promise<T>
): Promise<T> {
  const previous = eventLocks.get(key) || Promise.resolve();

  let release!: () => void;

  const current = new Promise<void>(resolve => {
    release = resolve;
  });

  eventLocks.set(key, current);

  await previous;

  try {
    return await action();
  } finally {
    release();

    if (eventLocks.get(key) === current) {
      eventLocks.delete(key);
    }
  }
}

// ======================================
// ACTUALIZAR SOLO EL EMBED
// CONSERVANDO LOS BOTONES ORIGINALES
// ======================================

async function updateDiscordEventEmbedOnly(
  eventDoc: any
): Promise<void> {
  if (!eventDoc.channelId || !eventDoc.messageId) {
    throw new Error(
      "El evento no tiene channelId o messageId."
    );
  }

  const message = buildDiscordEventMessage(eventDoc);

  await discordBotRequest(
    `/channels/${eventDoc.channelId}/messages/${eventDoc.messageId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        embeds: message.embeds
      })
    }
  );
}

// ======================================
// CONFIGURACIÓN EXPRESS
// ======================================

app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,

    store: MongoStore.create({
      mongoUrl: MONGODB_URI!
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
// AUTENTICACIÓN DISCORD
// ======================================

app.use("/auth", authRoutes);

// ======================================
// COMPROBAR SESIÓN
// ======================================

function getSessionUser(req: express.Request): any {
  return (req.session as any)?.user || null;
}

// ======================================
// PERMISOS DEL USUARIO
// ======================================

async function getUserPermissions(
  req: express.Request,
  guildId: string
) {
  const roles = await getDiscordUserRoles(req, guildId);

  const esTitular = roles.includes(ROLE_TITULAR);
  const esReserva = roles.includes(ROLE_RESERVA);

  return {
    esTitular,
    esReserva,
    puedeSerTitular: esTitular && !esReserva,
    puedeSerReserva: esReserva && !esTitular
  };
}

// ======================================
// OBTENER EVENTO ACTUAL
// ======================================

app.get("/api/evento", async (req, res) => {
  try {
    const user = getSessionUser(req);

    if (!user?.id) {
      return res.status(401).json({
        error: "Debes iniciar sesión."
      });
    }

    const evento = await getCurrentEvent();

    if (!evento) {
      return res.json({
        activo: false
      });
    }

    const permisos = await getUserPermissions(
      req,
      String(evento.guildId)
    );

    const rsvpNames = await resolveEventPilotNames(evento);

    return res.json({
      activo: true,
      evento,
      rsvpNames,
      permisos
    });

  } catch (error) {
    console.error(
      "Error obteniendo el evento:",
      error
    );

    return res.status(500).json({
      error: "No se pudo cargar el evento."
    });
  }
});

// ======================================
// RESPONDER AL EVENTO DESDE WEBLINEGT
// ======================================

app.post("/api/evento/responder", async (req, res) => {
  try {
    const user = getSessionUser(req);

    if (!user?.id) {
      return res.status(401).json({
        success: false,
        error: "Debes iniciar sesión."
      });
    }

    const respuesta = String(
      req.body?.respuesta || ""
    ).toLowerCase();

    const respuestasPermitidas = [
      "yes",
      "reserve",
      "maybe",
      "no"
    ];

    if (!respuestasPermitidas.includes(respuesta)) {
      return res.status(400).json({
        success: false,
        error: "Respuesta no válida."
      });
    }

    const eventoActual = await getCurrentEvent();

    if (
      !eventoActual ||
      !eventoActual.messageId ||
      !eventoActual.guildId
    ) {
      return res.status(404).json({
        success: false,
        error: "No hay ningún evento activo."
      });
    }

    const guildId = String(eventoActual.guildId);
    const messageId = String(eventoActual.messageId);
    const userId = String(user.id);

    // TITULAR y RESERVA necesitan su rol correspondiente.

    const permisos = await getUserPermissions(
      req,
      guildId
    );

    if (
      respuesta === "yes" &&
      !permisos.puedeSerTitular
    ) {
      return res.status(403).json({
        success: false,
        error: "Necesitas el rol TITULAR para apuntarte como titular."
      });
    }

    if (
      respuesta === "reserve" &&
      !permisos.puedeSerReserva
    ) {
      return res.status(403).json({
        success: false,
        error: "Necesitas el rol RESERVA para apuntarte como reserva."
      });
    }

    const collection = await getEventsCollection();

    const result = await withEventLock(
      `${guildId}:${messageId}`,
      async () => {
        const eventDoc = await collection.findOne({
          messageId,
          guildId,
          status: "sent"
        });

        if (!eventDoc) {
          return {
            error: "El evento ya no está disponible.",
            status: 404
          };
        }

        if (!eventDoc.rsvps) {
          eventDoc.rsvps = {};
        }

        const rsvps = eventDoc.rsvps as any;

        if (!Array.isArray(rsvps.yes)) {
          rsvps.yes = [];
        }

        if (!Array.isArray(rsvps.reserve)) {
          rsvps.reserve = [];
        }

        if (!Array.isArray(rsvps.maybe)) {
          rsvps.maybe = [];
        }

        if (!Array.isArray(rsvps.no)) {
          rsvps.no = [];
        }

        const previousWasYes =
          rsvps.yes.includes(userId);

        // Límite de 15 titulares.
        if (
          respuesta === "yes" &&
          !previousWasYes &&
          rsvps.yes.length >= MAX_PILOTOS
        ) {
          return {
            error: "No quedan plazas de titular disponibles.",
            status: 409
          };
        }

        // El usuario solo puede aparecer en una lista.
        rsvps.yes = rsvps.yes.filter(
          (id: string) => id !== userId
        );

        rsvps.reserve = rsvps.reserve.filter(
          (id: string) => id !== userId
        );

        rsvps.maybe = rsvps.maybe.filter(
          (id: string) => id !== userId
        );

        rsvps.no = rsvps.no.filter(
          (id: string) => id !== userId
        );

        // Añadir a la lista elegida.
        if (respuesta === "yes") {
          rsvps.yes.push(userId);
        }

        if (respuesta === "reserve") {
          rsvps.reserve.push(userId);
        }

        if (respuesta === "maybe") {
          rsvps.maybe.push(userId);
        }

        if (respuesta === "no") {
          rsvps.no.push(userId);
        }

        let promotedUserId: string | null = null;

        // Si un titular se da de baja, se promociona
        // la primera reserva cuando corresponde.
        if (
          respuesta === "no" &&
          previousWasYes
        ) {
          promotedUserId = await promoteFirstReserve(
            eventDoc
          );
        }

        const updateResult = await collection.updateOne(
          {
            messageId,
            guildId,
            status: "sent"
          },
          {
            $set: {
              rsvps
            }
          }
        );

        if (updateResult.matchedCount === 0) {
          return {
            error: "El evento ha cambiado o ya no está disponible.",
            status: 409
          };
        }

        // Actualizar el rol asistente.
        await setAssistantRole(
          guildId,
          userId,
          respuesta !== "no"
        );

        // Actualizar el mensaje original de Discord.
        try {
          await updateDiscordEventEmbedOnly(eventDoc);
        } catch (error) {
          console.error(
            "No se pudo actualizar el mensaje de Discord:",
            error
          );

          return {
            success: true,
            warning: "La respuesta se guardó, pero no se pudo actualizar el mensaje de Discord.",
            promotedUserId
          };
        }

        // Avisar al reserva si ha sido promocionado.
        if (promotedUserId) {
          await notifyPromotedReserve(
            eventDoc,
            promotedUserId
          );
        }

        return {
          success: true,
          promotedUserId
        };
      }
    );

    if ("error" in result) {
      return res.status(result.status || 400).json({
        success: false,
        error: result.error
      });
    }

    const eventoActualizado = await getCurrentEvent();

    const rsvpNames = eventoActualizado
      ? await resolveEventPilotNames(eventoActualizado)
      : null;

    return res.json({
      success: true,
      message: "Respuesta guardada correctamente.",
      respuesta,
      rsvpNames,
      promotedUserId: result.promotedUserId || null,
      warning: result.warning || null
    });

  } catch (error) {
    console.error(
      "Error registrando respuesta al evento:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "No se pudo registrar tu respuesta."
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
  const user = getSessionUser(req);

  if (!user?.id) {
    return res.redirect("/auth/discord");
  }

  return res.sendFile(
    path.join(publicPath, "index.html")
  );
});

// ======================================
// COMPROBACIÓN DEL SERVIDOR
// ======================================

app.get("/health", (_req, res) => {
  res.status(200).send("WEBLINEGT activo");
});

// ======================================
// INICIAR SERVIDOR
// ======================================

app.listen(PORT, () => {
  console.log(
    `🌐 WEBLINEGT activo en el puerto ${PORT}`
  );
});