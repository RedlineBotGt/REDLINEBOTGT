
// ======================================
// WEBLINE GT - SERVICIO DEL CHAT
// ======================================

import {
  CHAT_CHANNEL_ID,
  CHAT_HISTORY_LIMIT,
  type ChatMessage
} from "./chatTypes.js";

import {
  getCurrentEvent
} from "../eventos.js";

// ======================================
// CONFIGURACIÓN
// ======================================

const DISCORD_API = "https://discord.com/api/v10";

// ======================================
// PETICIONES A DISCORD CON EL BOT
// ======================================

async function discordRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = process.env.DISCORD_TOKEN;

  if (!token) {
    throw new Error("Falta la variable DISCORD_TOKEN.");
  }

  const response = await fetch(
    `${DISCORD_API}${endpoint}`,
    {
      ...options,
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
        ...options.headers
      }
    }
  );

  if (!response.ok) {
    const error = await response.text();

    throw new Error(
      `Error de Discord (${response.status}): ${error}`
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// ======================================
// OBTENER ID DEL SERVIDOR
// ======================================

async function getChatGuildId(): Promise<string> {
  const event = await getCurrentEvent();

  if (!event?.guildId) {
    throw new Error(
      "No se ha encontrado el servidor del evento activo."
    );
  }

  return String(event.guildId);
}

// ======================================
// AVATAR DE DISCORD
// ======================================

function getAvatarUrl(author: any): string {
  if (author.avatar && author.id) {
    const extension = author.avatar.startsWith("a_")
      ? "gif"
      : "png";

    return `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.${extension}?size=256`;
  }

  return "https://cdn.discordapp.com/embed/avatars/0.png";
}

// ======================================
// CONVERTIR MENSAJE DE DISCORD
// ======================================

function convertDiscordMessage(
  message: any
): ChatMessage {
  const author = message.author;

  return {
    id: message.id,
    content: message.content || "",
    authorId: author.id,
    authorName:
      message.member?.nick ||
      author.global_name ||
      author.username,
    authorAvatar: getAvatarUrl(author),
    createdAt: message.timestamp,
    source: "discord",
    replyTo: null,
    mentions: {
      users: message.mentions?.map(
        (user: any) => user.id
      ) || [],
      roles: message.mention_roles || []
    }
  };
}

// ======================================
// OBTENER ÚLTIMOS MENSAJES
// ======================================

export async function getChatHistory(): Promise<ChatMessage[]> {
  const messages = await discordRequest(
    `/channels/${CHAT_CHANNEL_ID}/messages?limit=${CHAT_HISTORY_LIMIT}`
  );

  return messages
    .map(convertDiscordMessage)
    .reverse();
}

// ======================================
// ENVIAR MENSAJE COMO USUARIO WEB
// ======================================

interface ChatWebUser {
  id: string;
  username?: string;
  globalName?: string;
  avatar?: string | null;
}

export async function sendChatMessage(
  content: string,
  user: ChatWebUser
): Promise<ChatMessage> {
  const cleanContent = content.trim();

  if (!cleanContent) {
    throw new Error("El mensaje no puede estar vacío.");
  }

  if (cleanContent.length > 1997) {
    throw new Error("El mensaje supera el límite permitido.");
  }

  if (!user?.id) {
    throw new Error("No se ha podido identificar al usuario.");
  }

  const webhookUrl = process.env.DISCORD_CHAT_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new Error(
      "Falta configurar DISCORD_CHAT_WEBHOOK_URL en Render."
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(webhookUrl);
  } catch {
    throw new Error("La URL del webhook de Discord no es válida.");
  }

  const validHost = [
    "discord.com",
    "discordapp.com"
  ].includes(parsedUrl.hostname);

  const validPath = /^\/api\/webhooks\/\d+\/[^/]+\/?$/.test(
    parsedUrl.pathname
  );

  if (
    parsedUrl.protocol !== "https:" ||
    !validHost ||
    !validPath
  ) {
    throw new Error("La URL del webhook de Discord no es válida.");
  }

  parsedUrl.searchParams.set("wait", "true");

  const displayName = (
    user.globalName ||
    user.username ||
    "Usuario"
  ).slice(0, 80);

  let avatarUrl: string;

  if (user.avatar) {
    const extension = user.avatar.startsWith("a_")
      ? "gif"
      : "png";

    avatarUrl =
      `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=256`;
  } else {
    const defaultAvatar = Number(
      (BigInt(user.id) >> 22n) % 6n
    );

    avatarUrl =
      `https://cdn.discordapp.com/embed/avatars/${defaultAvatar}.png`;
  }

  const response = await fetch(parsedUrl.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      username: displayName,
      avatar_url: avatarUrl,
      content: `🌐 ${cleanContent}`,
      allowed_mentions: {
        parse: ["users", "roles"]
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();

    console.error(
      "[CHAT] Error del webhook:",
      response.status,
      error
    );

    throw new Error(
      `Discord no pudo publicar el mensaje (HTTP ${response.status}).`
    );
  }

  const message = await response.json();

  return convertDiscordMessage(message);
}

// ======================================
// OBTENER USUARIOS PARA MENCIONES
// ======================================

export async function getChatMembers(
  query: string
): Promise<any[]> {
  const guildId = await getChatGuildId();

  const cleanQuery = query.trim();

  if (!cleanQuery) {
    return [];
  }

  const endpoint =
    `/guilds/${guildId}/members/search?query=${encodeURIComponent(cleanQuery)}&limit=100`;

  const members = await discordRequest(endpoint);

  return members
    .filter((member: any) => member.user?.id)
    .map((member: any) => {
      const user = member.user;

      const extension = user.avatar?.startsWith("a_")
        ? "gif"
        : "png";

      return {
        id: user.id,
        name:
          member.nick ||
          user.global_name ||
          user.username,
        avatar: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=64`
          : null,
        type: "user"
      };
    });
}

// ======================================
// OBTENER ROLES PARA MENCIONES
// ======================================

export async function getChatRoles(): Promise<any[]> {
  const guildId = await getChatGuildId();

  const roles = await discordRequest(
    `/guilds/${guildId}/roles`
  );

  return roles
    .filter((role: any) =>
      role.name !== "@everyone" &&
      role.mentionable === true
    )
    .map((role: any) => ({
      id: role.id,
      name: role.name,
      type: "role"
    }));
}

// ======================================
// BUSCAR USUARIOS Y ROLES
// ======================================

export async function searchChatMentions(
  query: string
): Promise<any[]> {
  const cleanQuery = query.trim().toLowerCase();

  const [membersResult, rolesResult] = await Promise.allSettled([
    getChatMembers(cleanQuery),
    getChatRoles()
  ]);

  let members: any[] = [];
  let roles: any[] = [];

  if (membersResult.status === "fulfilled") {
    members = membersResult.value;
  } else {
    console.warn(
      "[CHAT] No se pudieron consultar usuarios:",
      membersResult.reason
    );
  }

  if (rolesResult.status === "fulfilled") {
    roles = rolesResult.value;
  } else {
    console.warn(
      "[CHAT] No se pudieron consultar roles:",
      rolesResult.reason
    );
  }

  // Si fallan las dos consultas, no ocultamos el error.
  if (
    membersResult.status === "rejected" &&
    rolesResult.status === "rejected"
  ) {
    throw new Error(
      "Discord no ha permitido consultar usuarios ni roles."
    );
  }

  const filteredMembers = members.filter(
    (member: any) =>
      member.name.toLowerCase().includes(cleanQuery)
  );

  const filteredRoles = roles.filter(
    (role: any) =>
      role.name.toLowerCase().includes(cleanQuery)
  );

  const sortMatches = (a: any, b: any) => {
    const aStarts = a.name.toLowerCase().startsWith(cleanQuery);
    const bStarts = b.name.toLowerCase().startsWith(cleanQuery);

    if (aStarts !== bStarts) {
      return aStarts ? -1 : 1;
    }

    return a.name.localeCompare(b.name, "es");
  };

  filteredMembers.sort(sortMatches);
  filteredRoles.sort(sortMatches);

  return [
    ...filteredMembers.slice(0, 15),
    ...filteredRoles.slice(0, 15)
  ];
}
