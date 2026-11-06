
import { Router, Request } from "express";

import {
  getClasificacionData
} from "../googleSheets.js";

const router = Router();

// ======================================
// OBTENER CLASIFICACIÓN
// ======================================

router.get("/clasificacion", async (req: Request, res) => {
  try {
    const user = (req.session as any)?.user || null;

    if (!user?.id) {
      return res.status(401).json({
        success: false,
        error: "Debes iniciar sesión."
      });
    }

    const values = await getClasificacionData();

    return res.json({
      success: true,
      values
    });

  } catch (error) {
    console.error(
      "[WEBLINEGT] Error obteniendo clasificación:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "No se pudo cargar la clasificación."
    });
  }
});

export default router;
