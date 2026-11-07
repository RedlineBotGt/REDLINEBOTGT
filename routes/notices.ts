import { Router, Request, Response } from "express";
import { requierePapa } from "./homework.ts";
import { listarAvisos, crearAviso } from "../services/noticesService.ts";

const router = Router();

router.get("/notices", async (_req: Request, res: Response) => {
  try {
    res.json({ ok: true, avisos: await listarAvisos() });
  } catch (error) {
    console.error("[AVISOS] Error al listar:", error);
    res.status(500).json({ ok: false, error: "No se han podido cargar los avisos." });
  }
});

router.post("/notices", requierePapa, async (req: Request, res: Response) => {
  try {
    const { destinatario, mensaje } = req.body || {};
    if (!["leo", "mama", "todos"].includes(destinatario)) {
      return res.status(400).json({ ok: false, error: "Selecciona un destinatario válido." });
    }
    if (typeof mensaje !== "string" || !mensaje.trim() || mensaje.trim().length > 240) {
      return res.status(400).json({ ok: false, error: "El aviso debe tener entre 1 y 240 caracteres." });
    }
    res.status(201).json({ ok: true, aviso: await crearAviso(destinatario, mensaje) });
  } catch (error) {
    console.error("[AVISOS] Error al crear:", error);
    res.status(500).json({ ok: false, error: "No se ha podido guardar el aviso." });
  }
});

export default router;
