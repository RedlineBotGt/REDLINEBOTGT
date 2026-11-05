
const DISCORD_API = "https://discord.com/api/v10";

// ======================================
// PETICIONES DEL BOT A DISCORD
// ======================================

export async function discordBotRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

  if (!DISCORD_TOKEN) {
    throw new Error("Falta la variable DISCORD_TOKEN.");
  }

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

export async function setAssistantRole(
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
