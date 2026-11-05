import {
  runDiscordRequest,
  sleep,
  updateLastDiscordRequestAt
} from "./discordQueue.js";

const DISCORD_API = "https://discord.com/api/v10";

const CACHE_DURATION = 60 * 60 * 1000;
const ERROR_CACHE_DURATION = 60 * 1000;

const discordNameCache = new Map<
  string,
  {
    name: string;
    expiresAt: number;
  }
>();

const discordNamePending = new Map<
  string,
  Promise<string>
>();

export function getDiscordMemberName(
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
        const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

        if (!DISCORD_TOKEN) {
          console.error("Falta DISCORD_TOKEN.");
          return userId;
        }

        updateLastDiscordRequestAt();

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
            updateLastDiscordRequestAt();
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

export async function resolveEventPilotNames(evento: any) {
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