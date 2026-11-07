import { Router, Request, Response } from "express";
import {
  listarMensajesChat,
  guardarMensajeChat
} from "../services/chatService.ts";

const router = Router();

const PERFILES = ["leo", "papa", "mama"] as const;
const MAX_LONGITUD_MENSAJE = 1000;

router.get("/chat/messages", async (_req: Request, res: Response) => {
  try {
    const mensajes = await listarMensajesChat();
    return res.json({ ok: true, mensajes });
  } catch (error) {
    console.error("[CHAT] Error al consultar mensajes:", error);
    return res.status(500).json({
      ok: false,
      error: "No se han podido cargar los mensajes."
    });
  }
});

router.post("/chat/messages", async (req: Request, res: Response) => {
  try {
    const perfil = String(req.body?.perfil || "");
    const texto = typeof req.body?.texto === "string"
      ? req.body.texto.trim()
      : "";

    if (!PERFILES.includes(perfil as typeof PERFILES[number])) {
      return res.status(400).json({
        ok: false,
        error: "El perfil no es válido."
      });
    }

    if (!texto) {
      return res.status(400).json({
        ok: false,
        error: "Escribe un mensaje antes de enviarlo."
      });
    }

    if (texto.length > MAX_LONGITUD_MENSAJE) {
      return res.status(400).json({
        ok: false,
        error: "El mensaje no puede superar los 1.000 caracteres."
      });
    }

    const mensaje = await guardarMensajeChat(
      perfil as typeof PERFILES[number],
      texto
    );

    return res.status(201).json({ ok: true, mensaje });
  } catch (error) {
    console.error("[CHAT] Error al guardar mensaje:", error);
    return res.status(500).json({
      ok: false,
      error: "No se ha podido enviar el mensaje."
    });
  }
});

export default router;
