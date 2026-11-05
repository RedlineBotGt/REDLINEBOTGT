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

interface GuildDirectory {
  roles: Array<{ id: string; name: string }>;
  channels: Array<{ id: string; name: string }>;
  expiresAt: number;
}

const directoryCache = new Map<string, GuildDirectory>();

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

  const response = await fetch(`${DISCORD_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...options.headers
    }
  });

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
// OBTENER SERVIDOR
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
// DIRECTORIO DE ROLES Y CANALES
// ======================================

async function getGuildDirectory(
  guildId: string
): Promise<GuildDirectory> {

  const cached = directoryCache.get(guildId);

  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  const [discordRoles, discordChannels] = await Promise.all([
    discordRequest(`/guilds/${guildId}/roles`),
    discordRequest(`/guilds/${guildId}/channels`)
  ]);

  const roles = (discordRoles || [])
    .filter((role: any) => role.name !== "@everyone")
    .map((role: any) => ({
      id: String(role.id),
      name: String(role.name)
    }));

  const channels = (discordChannels || [])
    .filter((channel: any) =>
      channel.type === 0 || channel.type === 5
    )
    .map((channel: any) => ({
      id: String(channel.id),
      name: String(channel.name)
    }));

  const directory: GuildDirectory = {
    roles,
    channels,
    expiresAt: Date.now() + 5 * 60 * 1000
  };

  directoryCache.set(guildId, directory);

  return directory;
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
// EXTRAER IDS DE LAS MENCIONES DEL TEXTO
// ======================================

function extractMentionIds(content: string) {

  const users = new Set<string>();
  const roles = new Set<string>();
  const channels = new Set<string>();

  const regex = /<@!?(\d+)>|<@&(\d+)>|<#(\d+)>/g;

  let match;

  while ((match = regex.exec(content)) !== null) {

    if (match[1]) {
      users.add(match[1]);
    }

    if (match[2]) {
      roles.add(match[2]);
    }

    if (match[3]) {
      channels.add(match[3]);
    }
  }

  return {
    users: [...users],
    roles: [...roles],
    channels: [...channels]
  };
}

// ======================================
// CONVERTIR MENSAJE DE DISCORD
// ======================================

function convertDiscordMessage(
  message: any,
  directory?: GuildDirectory,
  guildId?: string
): ChatMessage {

  const author = message.author;
  const content = message.content || "";

  // IDs encontrados directamente en el texto.
  const textMentions = extractMentionIds(content);

  // Usuarios devueltos por Discord.
  const discordUsers = (message.mentions || [])
    .filter((user: any) => user?.id);

  // Combinar IDs del texto y datos de Discord.
  const userIds = new Set<string>([
    ...textMentions.users,
    ...discordUsers.map((user: any) => String(user.id))
  ]);

  const mentionedUsers = [...userIds].map((id) => {

    const user = discordUsers.find(
      (item: any) => String(item.id) === id
    );

    const member = (message.mention_members || []).find(
      (item: any) => String(item.user?.id) === id
    );

    return {
      id,
      name:
        member?.nick ||
        member?.user?.global_name ||
        user?.global_name ||
        user?.username ||
        "usuario"
    };
  });

  // ROLES

  const discordRoleIds: string[] =
    (message.mention_roles || []).map(
      (id: any) => String(id)
    );

  const roleIds = new Set<string>([
    ...textMentions.roles,
    ...discordRoleIds
  ]);

  const roles = [...roleIds].map((id) => {

    const role = directory?.roles.find(
      (item) => item.id === id
    );

    return {
      id,
      name: role?.name || "rol"
    };
  });

  // CANALES

  const embeddedChannels = message.mention_channels || [];

  const channelIds = new Set<string>([
    ...textMentions.channels,
    ...embeddedChannels
      .filter((channel: any) => channel?.id)
      .map((channel: any) => String(channel.id))
  ]);

  const channels = [...channelIds].map((id) => {

    const channel = directory?.channels.find(
      (item) => item.id === id
    );

    const embeddedChannel = embeddedChannels.find(
      (item: any) => String(item.id) === id
    );

    return {
      id,
      name:
        channel?.name ||
        embeddedChannel?.name ||
        "canal",
      url: guildId
        ? `https://discord.com/channels/${guildId}/${id}`
        : undefined
    };
  });

  return {
    id: message.id,
    content,
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
      users: [...userIds],
      roles: [...roleIds],
      channels: [...channelIds]
    },

    mentionData: {
      users: mentionedUsers,
      roles,
      channels
    }
  };
}

// ======================================
// OBTENER HISTORIAL
// ======================================

export async function getChatHistory(): Promise<ChatMessage[]> {

  const guildId = await getChatGuildId();

  const [messages, directory] = await Promise.all([
    discordRequest(
      `/channels/${CHAT_CHANNEL_ID}/messages?limit=${CHAT_HISTORY_LIMIT}`
    ),
    getGuildDirectory(guildId)
  ]);

  return messages
    .map((message: any) =>
      convertDiscordMessage(message, directory, guildId)
    )
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

  const validPath =
    /^\/api\/webhooks\/\d+\/[^/]+\/?$/.test(
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

  // IMPORTANTE:
  // Se conserva el envío original a Discord.

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

  const guildId = await getChatGuildId();
  const directory = await getGuildDirectory(guildId);

  return convertDiscordMessage(
    message,
    directory,
    guildId
  );
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
        id: String(user.id),
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
// OBTENER ROLES PARA AUTOCOMPLETADO
// ======================================

export async function getChatRoles(): Promise<any[]> {

  const guildId = await getChatGuildId();

  const discordRoles = await discordRequest(
    `/guilds/${guildId}/roles`
  );

  return discordRoles
    .filter((role: any) =>
      role.name !== "@everyone" &&
      role.mentionable === true
    )
    .map((role: any) => ({
      id: String(role.id),
      name: String(role.name),
      type: "role"
    }));
}

// ======================================
// OBTENER CANALES PARA AUTOCOMPLETADO
// ======================================

export async function getChatChannels(): Promise<any[]> {

  const guildId = await getChatGuildId();
  const directory = await getGuildDirectory(guildId);

  return directory.channels.map((channel) => ({
    id: channel.id,
    name: channel.name,
    type: "channel"
  }));
}

// ======================================
// BUSCAR USUARIOS, ROLES O CANALES
// ======================================

export async function searchChatMentions(
  query: string,
  type?: string
): Promise<any[]> {

  const cleanQuery = query.trim().toLowerCase();

  if (!cleanQuery) {
    return [];
  }

  let results: any[] = [];

  if (type === "channel") {

    results = await getChatChannels();

  } else if (type === "role") {

    results = await getChatRoles();

  } else {

    const [membersResult, rolesResult] =
      await Promise.allSettled([
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

    if (
      membersResult.status === "rejected" &&
      rolesResult.status === "rejected"
    ) {
      throw new Error(
        "Discord no ha permitido consultar usuarios ni roles."
      );
    }

    results = [...members, ...roles];
  }

  const filtered = results.filter((item: any) =>
    item.name.toLowerCase().includes(cleanQuery)
  );

  filtered.sort((a: any, b: any) => {

    const aStarts = a.name.toLowerCase().startsWith(cleanQuery);
    const bStarts = b.name.toLowerCase().startsWith(cleanQuery);

    if (aStarts !== bStarts) {
      return aStarts ? -1 : 1;
    }

    return a.name.localeCompare(b.name, "es");
  });

  return filtered.slice(0, 25);
}