
import {
  discordBotRequest,
  setAssistantRole
} from "../discord/discordApi.js";

const MAX_PILOTOS = 15;

// ======================================
// PROMOCIONAR PRIMERA RESERVA
// ======================================

export async function promoteFirstReserve(
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

export async function notifyPromotedReserve(
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
