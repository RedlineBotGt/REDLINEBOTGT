
import { discordBotRequest } from "../discord/discordApi.js";

// ======================================
// RECONSTRUIR EL MENSAJE DEL EVENTO
// ======================================

export function buildDiscordEventMessage(eventDoc: any) {
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

export async function updateDiscordEventMessage(
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
// ACTUALIZAR SOLO EL EMBED
// CONSERVANDO LOS BOTONES ORIGINALES
// ======================================

export async function updateDiscordEventEmbedOnly(
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
