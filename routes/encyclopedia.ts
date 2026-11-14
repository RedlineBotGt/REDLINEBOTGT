import { Router, Request, Response, NextFunction } from "express";
import { requierePapa } from "./homework.ts";
import { responderEnciclopedia, listarConversacionesEnciclopedia, type PerfilEnciclopedia } from "../services/encyclopediaService.ts";
const router = Router();
const perfiles = ["leo", "papa", "mama"] as const;
function protegerPapa(req: Request, res: Response, next: NextFunction) {
  const perfil = String(req.body?.perfil || req.query.perfil || "");
  if (perfil === "papa") return requierePapa(req, res, next);
  return next();
}
router.get("/encyclopedia/conversations", protegerPapa, async (req: Request, res: Response) => {
  try {
    const perfil = String(req.query.perfil || "");
    if (!perfiles.includes(perfil as any)) return res.status(400).json({ ok: false, error: "Perfil no válido." });
    return res.json({ ok: true, conversaciones: await listarConversacionesEnciclopedia(perfil as PerfilEnciclopedia) });
  } catch (error) {
    console.error("[ENCICLOPEDIA]", error);
    return res.status(500).json({ ok: false, error: "No se pudieron cargar las conversaciones." });
  }
});
router.post("/encyclopedia/message", protegerPapa, async (req: Request, res: Response) => {
  try {
    const perfil = String(req.body?.perfil || "");
    const mensaje = typeof req.body?.mensaje === "string" ? req.body.mensaje.trim() : "";
    const conversacionId = typeof req.body?.conversacionId === "string" ? req.body.conversacionId : undefined;
    if (!perfiles.includes(perfil as any)) return res.status(400).json({ ok: false, error: "Perfil no válido." });
    if (!mensaje || mensaje.length > 2000) return res.status(400).json({ ok: false, error: "La pregunta debe tener entre 1 y 2.000 caracteres." });
    return res.json({ ok: true, ...await responderEnciclopedia({ perfil: perfil as PerfilEnciclopedia, conversacionId, mensaje }) });
  } catch (error) {
    console.error("[ENCICLOPEDIA]", error);
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "No se pudo responder." });
  }
});
export default router;