
import {
  Client,
  GatewayIntentBits
} from "discord.js";

import {
  CHAT_CHANNEL_ID,
  type ChatMessage
} from "./chatTypes.js";

// ======================================
// WEBLINE GT - CONEXIÓN GATEWAY
// ======================================

let discordClient: Client | null = null;

let gatewayStarted = false;

// ======================================
// CONVERTIR MENSAJE
// ======================================

function convertMessage(message: any): ChatMessage {
  const author = message.author;

  return {
    id: message.id,
    content: message.content || "",
    authorId: author.id,
    authorName:
      message.member?.displayName ||
      author.globalName ||
      author.username,

    authorAvatar: author.displayAvatarURL({
      extension: "png",
      size: 128
    }),

    createdAt: message.createdAt.toISOString(),

    source: message.webhookId
      ? "webline"
      : "discord",

    replyTo: null,

    mentions: {
      users: message.mentions.users.map(
        (user: any) => user.id
      ),

      roles: message.mentions.roles.map(
        (role: any) => role.id
      )
    }
  };
}

// ======================================
// INICIAR CONEXIÓN
// ======================================

export async function startDiscordGateway(
  onMessage: (message: ChatMessage) => void
): Promise<void> {

  if (gatewayStarted) {
    console.log(
      "[CHAT] Gateway ya está iniciado."
    );
    return;
  }

  const token = process.env.DISCORD_TOKEN;

  if (!token) {
    throw new Error(
      "[CHAT] Falta DISCORD_TOKEN."
    );
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  discordClient = client;

  // ======================================
  // CONEXIÓN ESTABLECIDA
  // ======================================

  client.once("ready", () => {
    gatewayStarted = true;

    console.log(
      `[CHAT] Gateway conectado como ${client.user?.tag}`
    );
  });

  // ======================================
  // RECIBIR MENSAJES
  // ======================================

  client.on("messageCreate", (message) => {

    if (message.channelId !== CHAT_CHANNEL_ID) {
      return;
    }

    if (message.author.bot && !message.webhookId) {
      return;
    }

    try {
      const chatMessage = convertMessage(message);

      onMessage(chatMessage);

    } catch (error) {
      console.error(
        "[CHAT] Error procesando mensaje:",
        error
      );
    }
  });

  // ======================================
  // ERRORES
  // ======================================

  client.on("error", (error) => {
    console.error(
      "[CHAT] Error de Gateway:",
      error
    );
  });

  // ======================================
  // INICIAR SESIÓN
  // ======================================

  try {
    await client.login(token);

  } catch (error) {
    discordClient = null;

    console.error(
      "[CHAT] No se pudo conectar con Discord:",
      error
    );

    throw error;
  }
}

// ======================================
// CERRAR CONEXIÓN
// ======================================

export async function stopDiscordGateway(): Promise<void> {

  if (!discordClient) {
    return;
  }

  discordClient.destroy();

  discordClient = null;
  gatewayStarted = false;

  console.log(
    "[CHAT] Gateway desconectado."
  );
}
