
import {
  Client,
  GatewayIntentBits
} from "discord.js";

import {
  CHAT_CHANNEL_ID,
  type ChatMessage
} from "./chatTypes.js";

import {
  publishChatMessage
} from "./chatEvents.js";

// ======================================
// WEBLINE GT - DISCORD GATEWAY
// ======================================

let discordClient: Client | null = null;
let gatewayStarting = false;

// ======================================
// CONVERTIR MENSAJE DE DISCORD
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
// INICIAR GATEWAY
// ======================================

export async function startDiscordGateway(): Promise<void> {

  if (discordClient || gatewayStarting) {
    return;
  }

  const token = process.env.DISCORD_TOKEN;

  if (!token) {
    throw new Error(
      "[CHAT] Falta DISCORD_TOKEN."
    );
  }

  gatewayStarting = true;

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  discordClient = client;

  // ======================================
  // CONEXIÓN
  // ======================================

  client.once("ready", () => {

    console.log(
      `[CHAT] Discord conectado como ${client.user?.tag}`
    );

  });

  // ======================================
  // RECIBIR MENSAJES
  // ======================================

  client.on("messageCreate", (message) => {

    if (message.channelId !== CHAT_CHANNEL_ID) {
      return;
    }

    // Ignorar mensajes de otros bots.
    // Los mensajes del propio bot sí se reciben.
    if (
      message.author.bot &&
      message.author.id !== client.user?.id &&
      !message.webhookId
    ) {
      return;
    }

    try {

      const chatMessage = convertMessage(message);

      publishChatMessage(chatMessage);

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

    client.destroy();

    discordClient = null;
    gatewayStarting = false;

    console.error(
      "[CHAT] No se pudo conectar con Discord:",
      error
    );

    throw error;

  }

  gatewayStarting = false;
}

// ======================================
// CERRAR GATEWAY
// ======================================

export async function stopDiscordGateway(): Promise<void> {

  if (!discordClient) {
    return;
  }

  discordClient.destroy();

  discordClient = null;
  gatewayStarting = false;

  console.log(
    "[CHAT] Gateway desconectado."
  );

}
