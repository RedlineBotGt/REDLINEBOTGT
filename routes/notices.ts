import { Router, Request, Response } from "express";
import { requierePapa } from "./homework.ts";
import { listarAvisos, crearAviso, actualizarAviso, eliminarAviso } from "../services/noticesService.ts";

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

router.patch("/notices/:id", requierePapa, async (req: Request, res: Response) => {
  try {
    const { destinatario, mensaje } = req.body || {};
    if (!["leo", "mama", "todos"].includes(destinatario)) {
      return res.status(400).json({ ok: false, error: "Selecciona un destinatario válido." });
    }
    if (typeof mensaje !== "string" || !mensaje.trim() || mensaje.trim().length > 240) {
      return res.status(400).json({ ok: false, error: "El aviso debe tener entre 1 y 240 caracteres." });
    }
    const actualizado = await actualizarAviso(req.params.id, destinatario, mensaje);
    if (!actualizado) return res.status(404).json({ ok: false, error: "El aviso ya no existe." });
    res.json({ ok: true });
  } catch (error) {
    console.error("[AVISOS] Error al editar:", error);
    res.status(500).json({ ok: false, error: "No se ha podido actualizar el aviso." });
  }
});

router.delete("/notices/:id", requierePapa, async (req: Request, res: Response) => {
  try {
    const eliminado = await eliminarAviso(req.params.id);
    if (!eliminado) return res.status(404).json({ ok: false, error: "El aviso ya no existe." });
    res.json({ ok: true });
  } catch (error) {
    console.error("[AVISOS] Error al borrar:", error);
    res.status(500).json({ ok: false, error: "No se ha podido borrar el aviso." });
  }
});

