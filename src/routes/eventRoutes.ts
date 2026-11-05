
import { Router, Request } from "express";

import { getDiscordUserRoles } from "../auth.js";

import {
  getCurrentEvent,
  getEventsCollection,
  ROLE_TITULAR,
  ROLE_RESERVA
} from "../eventos.js";

import {
  resolveEventPilotNames
} from "../discord/discordNames.js";

import {
  setAssistantRole
} from "../discord/discordApi.js";

import {
  updateDiscordEventEmbedOnly
} from "../eventos/eventMessage.js";

import {
  promoteFirstReserve,
  notifyPromotedReserve
} from "../eventos/eventRsvp.js";

import {
  withEventLock
} from "../eventos/eventLock.js";

const router = Router();

const MAX_PILOTOS = 15;

// ======================================
// COMPROBAR SESIÓN
// ======================================

function getSessionUser(req: Request): any {
  return (req.session as any)?.user || null;
}

// ======================================
// PERMISOS DEL USUARIO
// ======================================

async function getUserPermissions(
  req: Request,
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

router.get("/evento", async (req, res) => {
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

router.post("/evento/responder", async (req, res) => {
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

    const result: any = await withEventLock(
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

        await setAssistantRole(
          guildId,
          userId,
          respuesta !== "no"
        );

        let warning: string | null = null;

        try {
          await updateDiscordEventEmbedOnly(eventDoc);
        } catch (error) {
          console.error(
            "No se pudo actualizar el mensaje de Discord:",
            error
          );

          warning =
            "La respuesta se guardó, pero no se pudo actualizar el mensaje de Discord.";
        }

        if (promotedUserId) {
          await notifyPromotedReserve(
            eventDoc,
            promotedUserId
          );
        }

        return {
          success: true,
          promotedUserId,
          warning
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

export default router;
