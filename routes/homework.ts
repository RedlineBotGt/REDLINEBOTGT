import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";

import {
  listarDeberes,
  crearDeber,
  editarDeber,
  eliminarDeber,
  completarDeber
} from "../services/homeworkService.ts";

import type {
  TipoDeber,
  DestinatarioDeber,
  EstadoDeber
} from "../services/homeworkService.ts";

const router = Router();

const DURACION_SESION = 8 * 60 * 60 * 1000;

interface DatosToken {
  perfil: "papa";
  exp: number;
}

function obtenerSecreto(): string {
  const secreto = process.env.PAPA_SESSION_SECRET;

  if (!secreto) {
    throw new Error("Falta configurar PAPA_SESSION_SECRET");
  }

  return secreto;
}

function firmarToken(contenido: string): string {
  return crypto
    .createHmac("sha256", obtenerSecreto())
    .update(contenido)
    .digest("hex");
}

function compararFirmas(a: string, b: string): boolean {
  try {
    const firmaA = Buffer.from(a, "hex");
    const firmaB = Buffer.from(b, "hex");

    if (firmaA.length !== firmaB.length) return false;

    return crypto.timingSafeEqual(firmaA, firmaB);
  } catch {
    return false;
  }
}

function validarPin(pin: string): boolean {
  const pinConfigurado = process.env.PAPA_PIN;

  if (!pinConfigurado || !pin) return false;

  const hashRecibido = crypto
    .createHmac("sha256", "academia-pin")
    .update(pin)
    .digest("hex");

  const hashConfigurado = crypto
    .createHmac("sha256", "academia-pin")
    .update(pinConfigurado)
    .digest("hex");

  return compararFirmas(hashRecibido, hashConfigurado);
}

function crearTokenPapa(): string {
  const datos: DatosToken = {
    perfil: "papa",
    exp: Date.now() + DURACION_SESION
  };

  const contenido = Buffer
    .from(JSON.stringify(datos))
    .toString("base64url");

  return `${contenido}.${firmarToken(contenido)}`;
}

function comprobarToken(token: string): boolean {
  try {
    const partes = token.split(".");
    if (partes.length !== 2) return false;

    const [contenido, firma] = partes;
    if (!contenido || !firma) return false;

    const firmaEsperada = firmarToken(contenido);

    if (!compararFirmas(firma, firmaEsperada)) {
      return false;
    }

    const datos = JSON.parse(
      Buffer.from(contenido, "base64url").toString("utf8")
    ) as DatosToken;

    return (
      datos.perfil === "papa" &&
      typeof datos.exp === "number" &&
      datos.exp > Date.now()
    );
  } catch {
    return false;
  }
}

function requierePapa(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const autorizacion = req.headers.authorization || "";
  const token = autorizacion.startsWith("Bearer ")
    ? autorizacion.slice(7)
    : "";

  if (!token || !comprobarToken(token)) {
    return res.status(401).json({
      ok: false,
      error: "Necesitas iniciar sesión como Papá."
    });
  }

  next();
}

const ASIGNATURAS = [
  "ciencias",
  "matematicas",
  "lengua",
  "geografia",
  "historia",
  "ingles",
  "cultura",
  "otras"
];

const TIPOS: TipoDeber[] = [
  "enlace",
  "ejercicio",
  "escrito"
];

const DESTINATARIOS: DestinatarioDeber[] = [
  "leo",
  "mama"
];

function validarDatosDeber(datos: any): string | null {
  if (!datos || typeof datos !== "object") {
    return "Los datos del deber no son válidos.";
  }

  if (
    typeof datos.titulo !== "string" ||
    !datos.titulo.trim() ||
    datos.titulo.trim().length > 150
  ) {
    return "El título es obligatorio y no puede superar 150 caracteres.";
  }

  if (!ASIGNATURAS.includes(datos.asignatura)) {
    return "La asignatura no es válida.";
  }

  if (!TIPOS.includes(datos.tipo)) {
    return "El tipo de deber no es válido.";
  }

  if (!DESTINATARIOS.includes(datos.destinatario)) {
    return "El destinatario no es válido.";
  }

  if (
    typeof datos.contenido !== "string" ||
    !datos.contenido.trim() ||
    datos.contenido.length > 10000
  ) {
    return "El contenido es obligatorio y no puede superar 10.000 caracteres.";
  }

  if (datos.tipo === "enlace") {
    try {
      const url = new URL(datos.contenido);

      if (!["http:", "https:"].includes(url.protocol)) {
        return "El enlace debe comenzar por http:// o https://.";
      }
    } catch {
      return "El enlace no tiene un formato válido.";
    }
  }

  if (datos.fechaLimite) {
    const fecha = new Date(datos.fechaLimite);

    if (Number.isNaN(fecha.getTime())) {
      return "La fecha límite no es válida.";
    }
  }

  return null;
}

// ACCESO DE PAPÁ

router.post(
  "/homework/auth",
  (req: Request, res: Response) => {
    const pin = String(req.body?.pin || "");

    if (!validarPin(pin)) {
      return res.status(401).json({
        ok: false,
        error: "PIN incorrecto."
      });
    }

    return res.json({
      ok: true,
      token: crearTokenPapa(),
      duracion: DURACION_SESION
    });
  }
);

// CONSULTAR DEBERES

router.get(
  "/homework",
  async (req: Request, res: Response) => {
    try {
      const perfil = String(req.query.perfil || "");

      if (perfil === "papa") {
        const autorizacion = req.headers.authorization || "";
        const token = autorizacion.startsWith("Bearer ")
          ? autorizacion.slice(7)
          : "";

        if (!token || !comprobarToken(token)) {
          return res.status(401).json({
            ok: false,
            error: "Acceso reservado a Papá."
          });
        }
      } else if (
        !DESTINATARIOS.includes(perfil as DestinatarioDeber)
      ) {
        return res.status(400).json({
          ok: false,
          error: "Perfil no válido."
        });
      }

      const filtros: {
        asignatura?: string;
        estado?: EstadoDeber;
      } = {};

      if (req.query.asignatura) {
        filtros.asignatura = String(req.query.asignatura);
      }

      if (req.query.estado) {
        const estado = String(req.query.estado);

        if (!["pendiente", "completado"].includes(estado)) {
          return res.status(400).json({
            ok: false,
            error: "Estado no válido."
          });
        }

        filtros.estado = estado as EstadoDeber;
      }

      if (perfil === "papa") {
        const [deberesLeo, deberesMama] = await Promise.all([
          listarDeberes({
            ...filtros,
            perfil: "leo"
          }),
          listarDeberes({
            ...filtros,
            perfil: "mama"
          })
        ]);

        const deberes = [...deberesLeo, ...deberesMama]
          .sort((a, b) => {
            if (a.estado !== b.estado) {
              return a.estado === "pendiente" ? -1 : 1;
            }

            const fechaA = a.fechaLimite
              ? new Date(a.fechaLimite).getTime()
              : Number.MAX_SAFE_INTEGER;

            const fechaB = b.fechaLimite
              ? new Date(b.fechaLimite).getTime()
              : Number.MAX_SAFE_INTEGER;

            if (fechaA !== fechaB) {
              return fechaA - fechaB;
            }

            return (
              new Date(b.creadoEn).getTime() -
              new Date(a.creadoEn).getTime()
            );
          });

        return res.json({
          ok: true,
          deberes
        });
      }

      const deberes = await listarDeberes({
        ...filtros,
        perfil
      });

      return res.json({
        ok: true,
        deberes
      });
    } catch (error) {
      console.error("[HOMEWORK] Error al consultar:", error);

      return res.status(500).json({
        ok: false,
        error: "No se han podido consultar los deberes."
      });
    }
  }
);

// CREAR DEBER

router.post(
  "/homework",
  requierePapa,
  async (req: Request, res: Response) => {
    try {
      const errorValidacion = validarDatosDeber(req.body);

      if (errorValidacion) {
        return res.status(400).json({
          ok: false,
          error: errorValidacion
        });
      }

      const deber = await crearDeber({
        titulo: req.body.titulo.trim(),
        asignatura: req.body.asignatura,
        tipo: req.body.tipo,
        contenido: req.body.contenido.trim(),
        destinatario: req.body.destinatario,
        fechaLimite: req.body.fechaLimite || null
      });

      return res.status(201).json({
        ok: true,
        deber
      });
    } catch (error) {
      console.error("[HOMEWORK] Error al crear:", error);

      return res.status(500).json({
        ok: false,
        error: "No se ha podido crear el deber."
      });
    }
  }
);

// EDITAR DEBER
router.patch(
  "/homework/:id",
  requierePapa,
  async (req: Request, res: Response) => {
    try {
      const campos = [
        "titulo",
        "asignatura",
        "tipo",
        "contenido",
        "destinatario",
        "fechaLimite"
      ];

      const datos: any = {};

      for (const campo of campos) {
        if (req.body[campo] !== undefined) {
          datos[campo] = req.body[campo];
        }
      }

      if (Object.keys(datos).length === 0) {
        return res.status(400).json({
          ok: false,
          error: "No hay cambios para guardar."
        });
      }

      if (
        datos.titulo !== undefined &&
        (
          typeof datos.titulo !== "string" ||
          !datos.titulo.trim() ||
          datos.titulo.trim().length > 150
        )
      ) {
        return res.status(400).json({
          ok: false,
          error: "El título no es válido."
        });
      }

      if (
        datos.asignatura !== undefined &&
        !ASIGNATURAS.includes(datos.asignatura)
      ) {
        return res.status(400).json({
          ok: false,
          error: "La asignatura no es válida."
        });
      }

      if (
        datos.tipo !== undefined &&
        !TIPOS.includes(datos.tipo)
      ) {
        return res.status(400).json({
          ok: false,
          error: "El tipo de deber no es válido."
        });
      }

      if (
        datos.destinatario !== undefined &&
        !DESTINATARIOS.includes(datos.destinatario)
      ) {
        return res.status(400).json({
          ok: false,
          error: "El destinatario no es válido."
        });
      }

      if (datos.contenido !== undefined) {
        if (
          typeof datos.contenido !== "string" ||
          !datos.contenido.trim() ||
          datos.contenido.length > 10000
        ) {
          return res.status(400).json({
            ok: false,
            error: "El contenido no es válido."
          });
        }

        datos.contenido = datos.contenido.trim();
      }

      if (datos.titulo !== undefined) {
        datos.titulo = datos.titulo.trim();
      }

      if (datos.fechaLimite !== undefined && datos.fechaLimite) {
        const fecha = new Date(datos.fechaLimite);

        if (Number.isNaN(fecha.getTime())) {
          return res.status(400).json({
            ok: false,
            error: "La fecha límite no es válida."
          });
        }
      }

      if (datos.tipo === "enlace" || datos.contenido !== undefined) {
        const tipoFinal = datos.tipo;
        const contenidoFinal = datos.contenido;

        if (tipoFinal === "enlace" && contenidoFinal !== undefined) {
          try {
            const url = new URL(contenidoFinal);

            if (!["http:", "https:"].includes(url.protocol)) {
              throw new Error("Protocolo no permitido");
            }
          } catch {
            return res.status(400).json({
              ok: false,
              error: "El enlace no tiene un formato válido."
            });
          }
        }
      }

      const deber = await editarDeber(req.params.id, datos);

      return res.json({
        ok: true,
        deber
      });
    } catch (error) {
      console.error("[HOMEWORK] Error al editar:", error);

      return res.status(500).json({
        ok: false,
        error: "No se ha podido editar el deber."
      });
    }
  }
);

// ELIMINAR DEBER

router.delete(
  "/homework/:id",
  requierePapa,
  async (req: Request, res: Response) => {
    try {
      const eliminado = await eliminarDeber(req.params.id);

      if (!eliminado) {
        return res.status(404).json({
          ok: false,
          error: "No se ha encontrado el deber."
        });
      }

      return res.json({
        ok: true,
        eliminado: true
      });
    } catch (error) {
      console.error("[HOMEWORK] Error al eliminar:", error);

      return res.status(500).json({
        ok: false,
        error: "No se ha podido eliminar el deber."
      });
    }
  }
);

// COMPLETAR DEBER

router.patch(
  "/homework/:id/complete",
  async (req: Request, res: Response) => {
    try {
      const perfil = String(req.body?.perfil || "");

      if (!DESTINATARIOS.includes(perfil as DestinatarioDeber)) {
        return res.status(400).json({
          ok: false,
          error: "Perfil no válido."
        });
      }

      const deber = await completarDeber(
        req.params.id,
        perfil as DestinatarioDeber
      );

      return res.json({
        ok: true,
        deber
      });
    } catch (error) {
      console.error("[HOMEWORK] Error al completar:", error);

      return res.status(500).json({
        ok: false,
        error: "No se ha podido completar el deber."
      });
    }
  }
);

export default router;