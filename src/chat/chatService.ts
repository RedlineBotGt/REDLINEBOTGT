
// ======================================
// WEBLINE GT - SERVICIO DEL CHAT
// ======================================

import {
  CHAT_CHANNEL_ID,
  CHAT_HISTORY_LIMIT,
  type ChatMessage
} from "./chatTypes.js";

// ======================================
// CONFIGURACIÓN
// ======================================

const DISCORD_API = "https://discord.com/api/v10";

// ======================================
// PETICIONES A DISCORD
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
// CONVERTIR MENSAJE DE DISCORD
// ======================================

function convertDiscordMessage(
  message: any
): ChatMessage {
  const author = message.author;

  const avatar = author.avatar
    ? `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  return {
    id: message.id,
    content: message.content || "",
    authorId: author.id,
    authorName: message.member?.nick || author.global_name || author.username,
    authorAvatar: avatar,
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
// ENVIAR MENSAJE
// ======================================

export async function sendChatMessage(
  content: string
): Promise<ChatMessage> {
  const cleanContent = content.trim();

  if (!cleanContent) {
    throw new Error("El mensaje no puede estar vacío.");
  }

  if (cleanContent.length > 2000) {
    throw new Error("El mensaje supera los 2000 caracteres.");
  }

  const message = await discordRequest(
    `/channels/${CHAT_CHANNEL_ID}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        content: cleanContent,
        allowed_mentions: {
          parse: ["users", "roles"]
        }
      })
    }
  );

  return convertDiscordMessage(message);
}

// ======================================
// OBTENER USUARIOS PARA MENCIONES
// ======================================

export async function getChatMembers(): Promise<any[]> {
  const members = await discordRequest(
    `/guilds/${process.env.DISCORD_GUILD_ID}/members?limit=1000`
  );

  return members.map((member: any) => ({
    id: member.user.id,
    name:
      member.nick ||
      member.user.global_name ||
      member.user.username,
    avatar: member.user.avatar
      ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png`
      : null,
    type: "user"
  }));
}

// ======================================
// OBTENER ROLES PARA MENCIONES
// ======================================

export async function getChatRoles(): Promise<any[]> {
  const roles = await discordRequest(
    `/guilds/${process.env.DISCORD_GUILD_ID}/roles`
  );

  return roles
    .filter((role: any) => role.name !== "@everyone")
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

  const [members, roles] = await Promise.all([
    getChatMembers(),
    getChatRoles()
  ]);

  const filteredMembers = members
    .filter((member: any) =>
      member.name.toLowerCase().includes(cleanQuery)
    );

  const filteredRoles = roles
    .filter((role: any) =>
      role.name.toLowerCase().includes(cleanQuery)
    );

  return [
    ...filteredMembers.slice(0, 15),
    ...filteredRoles.slice(0, 15)
  ];
}
