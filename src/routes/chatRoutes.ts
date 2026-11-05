
import { Router, Request, Response } from "express";

import {
  getChatHistory,
  sendChatMessage,
  searchChatMentions
} from "../chat/chatService.js";

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
      console.error(
        "[CHAT] Error obteniendo mensajes:",
        error
      );

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

      if (content.length > 2000) {
        return res.status(400).json({
          success: false,
          message: "El mensaje supera los 2000 caracteres."
        });
      }

      const message = await sendChatMessage(content);

      return res.json({
        success: true,
        message
      });

    } catch (error) {
      console.error(
        "[CHAT] Error enviando mensaje:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "No se pudo enviar el mensaje."
      });
    }
  }
);

// ======================================
// BUSCAR USUARIOS Y ROLES
// PARA AUTOCOMPLETADO DE MENCIONES
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
      console.error(
        "[CHAT] Error buscando menciones:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "No se pudieron buscar usuarios y roles."
      });
    }
  }
);

export default router;
