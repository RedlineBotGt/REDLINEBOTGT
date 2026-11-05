
import { Router, Request, Response } from "express";

import {
  getChatHistory,
  sendChatMessage,
  searchChatMentions
} from "../chat/chatService.js";

import {
  onChatMessage
} from "../chat/chatEvents.js";

// ======================================
// WEBLINE GT - RUTAS DEL CHAT
// ======================================

const router = Router();

// ======================================
// COMPROBAR SESIÓN
// ======================================

function isAuthenticated(req: Request): boolean {
  return Boolean((req.session as any)?.user);
}

// ======================================
// OBTENER HISTORIAL
// ======================================

router.get(
  "/chat/messages",
  async (req: Request, res: Response) => {

    if (!isAuthenticated(req)) {
      return res.status(401).json({
        success: false,
        message: "Debes iniciar sesión."
      });
    }

    try {
      const messages = await getChatHistory();

      return res.json({
        success: true,
        messages
      });

    } catch (error) {
      console.error("[CHAT] Error obteniendo mensajes:", error);

      return res.status(500).json({
        success: false,
        message: "No se pudo cargar el chat."
      });
    }
  }
);

// ======================================
// ENVIAR MENSAJE
// ======================================

router.post(
  "/chat/messages",
  async (req: Request, res: Response) => {

    if (!isAuthenticated(req)) {
      return res.status(401).json({
        success: false,
        message: "Debes iniciar sesión."
      });
    }

    try {
      const content = req.body?.content;

      if (
        typeof content !== "string" ||
        !content.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Escribe un mensaje."
        });
      }

      if (content.trim().length > 1997) {
        return res.status(400).json({
          success: false,
          message: "El mensaje supera el límite permitido."
        });
      }

      const user = (req.session as any).user;

      const message = await sendChatMessage(
        content,
        user
      );

      return res.json({
        success: true,
        message
      });

    } catch (error) {
      console.error("[CHAT] Error enviando mensaje:", error);

      return res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo enviar el mensaje."
      });
    }
  }
);

// ======================================
// BUSCAR USUARIOS Y ROLES
// ======================================

router.get(
  "/chat/mentions",
  async (req: Request, res: Response) => {

    if (!isAuthenticated(req)) {
      return res.status(401).json({
        success: false,
        message: "Debes iniciar sesión."
      });
    }

    try {
      const query =
        typeof req.query.q === "string"
          ? req.query.q
          : "";

      const results = await searchChatMentions(query);

      return res.json({
        success: true,
        results
      });

    } catch (error) {
      console.error("[CHAT] Error buscando menciones:", error);

      return res.status(500).json({
        success: false,
        message: "No se pudieron buscar usuarios y roles."
      });
    }
  }
);

// ======================================
// MENSAJES EN DIRECTO - SSE
// ======================================

router.get(
  "/chat/stream",
  (req: Request, res: Response) => {

    if (!isAuthenticated(req)) {
      return res.status(401).end();
    }

    res.setHeader(
      "Content-Type",
      "text/event-stream"
    );

    res.setHeader(
      "Cache-Control",
      "no-cache, no-transform"
    );

    res.setHeader(
      "Connection",
      "keep-alive"
    );

    res.flushHeaders?.();

    // Confirmar conexión
    res.write(
      `event: connected\ndata: ${JSON.stringify({
        success: true
      })}\n\n`
    );

    // Escuchar mensajes nuevos
    const unsubscribe = onChatMessage((message) => {

      if (res.writableEnded) {
        return;
      }

      res.write(
        `event: chatMessage\ndata: ${JSON.stringify(message)}\n\n`
      );

    });

    // Mantener viva la conexión
    const heartbeat = setInterval(() => {

      if (!res.writableEnded) {
        res.write(": keep-alive\n\n");
      }

    }, 25000);

    // Limpiar al cerrar navegador o conexión
    req.on("close", () => {

      clearInterval(heartbeat);

      unsubscribe();

    });

  }
);

export default router;
