
import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";

import {
  listarDeberes,
  crearDeber,
  editarDeber,
  eliminarDeber,
  completarDeber,
  reabrirDeber
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

interface PreguntaEjercicio {
  id: string;
  pregunta: string;
  respuestaCorrecta: string;
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

const ESTADOS: EstadoDeber[] = [
  "pendiente",
  "completado"
];

/**
 * Valida las preguntas y respuestas de un ejercicio.
 */
function validarPreguntas(
  preguntas: any
): string | null {
  if (!Array.isArray(preguntas) || preguntas.length === 0) {
    return "El ejercicio necesita al menos una pregunta.";
  }

  if (preguntas.length > 50) {
    return "Un ejercicio no puede tener más de 50 preguntas.";
  }

  for (const pregunta of preguntas) {
    if (
      !pregunta ||
      typeof pregunta !== "object" ||
      typeof pregunta.pregunta !== "string" ||
      !pregunta.pregunta.trim() ||
      pregunta.pregunta.length > 2000 ||
      typeof pregunta.respuestaCorrecta !== "string" ||
      !pregunta.respuestaCorrecta.trim() ||
      pregunta.respuestaCorrecta.length > 1000
    ) {
      return "Cada pregunta necesita un enunciado y una respuesta correcta.";
    }

    if (
      pregunta.id !== undefined &&
      (
        typeof pregunta.id !== "string" ||
        pregunta.id.length > 100
      )
    ) {
      return "El identificador de una pregunta no es válido.";
    }
  }

  return null;
}

/**
 * Normaliza las respuestas para compararlas.
 */
function normalizarRespuesta(respuesta: string): string {
  return respuesta
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ");
}

/**
 * Elimina las respuestas correctas antes de enviar
 * los ejercicios a Leo o Mamá.
 */
function ocultarRespuestasCorrectas(deber: any) {
  if (!deber || deber.tipo !== "ejercicio") {
    return deber;
  }

  return {
    ...deber,
    preguntas: Array.isArray(deber.preguntas)
      ? deber.preguntas.map((pregunta: any) => ({
          id: pregunta.id,
          pregunta: pregunta.pregunta
        }))
      : []
  };
}

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

  if (datos.tipo === "ejercicio") {
    const errorPreguntas = validarPreguntas(datos.preguntas);

    if (errorPreguntas) {
      return errorPreguntas;
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

// ========================================
// ACCESO DE PAPÁ
// ========================================

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

// ========================================
// CONSULTAR DEBERES
// ========================================

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

        if (!ESTADOS.includes(estado as EstadoDeber)) {
          return res.status(400).json({
            ok: false,
            error: "Estado no válido."
          });
        }

        filtros.estado = estado as EstadoDeber;
      }

      if (perfil === "papa") {
        const [deberesLeo, deberesMama] = await Promise.all([
          listarDeberes({ ...filtros, perfil: "leo" }),
          listarDeberes({ ...filtros, perfil: "mama" })
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

        return res.json({ ok: true, deberes });
      }

      const deberes = await listarDeberes({
        ...filtros,
        perfil
      });

      return res.json({
        ok: true,
        deberes: deberes.map(ocultarRespuestasCorrectas)
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

// ===== FIN DE LA PARTE 1 =====

// ========================================
// CREAR DEBER
// ========================================

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
        fechaLimite: req.body.fechaLimite || null,
        ...(req.body.tipo === "ejercicio"
          ? { preguntas: req.body.preguntas }
          : {})
      });

      return res.status(201).json({ ok: true, deber });

    } catch (error) {
      console.error("[HOMEWORK] Error al crear:", error);

      return res.status(500).json({
        ok: false,
        error: "No se ha podido crear el deber."
      });
    }
  }
);

// ========================================
// EDITAR DEBER
// ========================================

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
        "fechaLimite",
        "estado",
        "preguntas"
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

      if (
        datos.estado !== undefined &&
        !ESTADOS.includes(datos.estado)
      ) {
        return res.status(400).json({
          ok: false,
          error: "El estado no es válido."
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

      if (datos.preguntas !== undefined) {
        const errorPreguntas = validarPreguntas(datos.preguntas);

        if (errorPreguntas) {
          return res.status(400).json({
            ok: false,
            error: errorPreguntas
          });
        }
      }

      if (
        datos.tipo === "ejercicio" &&
        datos.preguntas === undefined
      ) {
        return res.status(400).json({
          ok: false,
          error: "El ejercicio necesita sus preguntas y respuestas."
        });
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

      if (datos.tipo === "enlace" && datos.contenido !== undefined) {
        try {
          const url = new URL(datos.contenido);

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

      const deber = await editarDeber(req.params.id, datos);

      return res.json({ ok: true, deber });

    } catch (error) {
      console.error("[HOMEWORK] Error al editar:", error);

      return res.status(500).json({
        ok: false,
        error: "No se ha podido editar el deber."
      });
    }
  }
);

// ========================================
// ELIMINAR DEBER
// ========================================

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

// ========================================
// COMPROBAR RESPUESTAS DE UN EJERCICIO
// ========================================

router.post(
  "/homework/:id/answer",
  async (req: Request, res: Response) => {
    try {
      const perfil = String(req.body?.perfil || "");

      if (!DESTINATARIOS.includes(perfil as DestinatarioDeber)) {
        return res.status(400).json({
          ok: false,
          error: "Perfil no válido."
        });
      }

      const respuestas = req.body?.respuestas;

      if (!Array.isArray(respuestas) || respuestas.length === 0) {
        return res.status(400).json({
          ok: false,
          error: "Debes responder todas las preguntas."
        });
      }

      const deberes = await listarDeberes({
        perfil: perfil as DestinatarioDeber
      });

      const deber = deberes.find(
        (item: any) => String(item._id) === String(req.params.id)
      );

      if (!deber) {
        return res.status(404).json({
          ok: false,
          error: "No se ha encontrado este ejercicio."
        });
      }

      if (deber.tipo !== "ejercicio") {
        return res.status(400).json({
          ok: false,
          error: "Este deber no es un ejercicio."
        });
      }

      if (deber.estado === "completado") {
        return res.json({
          ok: true,
          completado: true,
          mensaje: "Este ejercicio ya está terminado."
        });
      }

      const preguntas = Array.isArray(deber.preguntas)
        ? deber.preguntas
        : [];

      if (
        preguntas.length === 0 ||
        respuestas.length !== preguntas.length
      ) {
        return res.status(400).json({
          ok: false,
          error: "Debes responder todas las preguntas."
        });
      }

      let todasCorrectas = true;

      for (const pregunta of preguntas) {
        const respuestaUsuario = respuestas.find(
          (item: any) =>
            String(item.preguntaId) === String(pregunta.id)
        );

        if (
          !respuestaUsuario ||
          typeof respuestaUsuario.respuesta !== "string" ||
          !respuestaUsuario.respuesta.trim()
        ) {
          todasCorrectas = false;
          break;
        }

        const respuestaCorrecta = normalizarRespuesta(
          pregunta.respuestaCorrecta
        );

        const respuestaRecibida = normalizarRespuesta(
          respuestaUsuario.respuesta
        );

        if (respuestaRecibida !== respuestaCorrecta) {
          todasCorrectas = false;
          break;
        }
      }

      if (!todasCorrectas) {
        return res.json({
          ok: true,
          completado: false,
          error: "Todavía hay respuestas incorrectas. ¡Inténtalo de nuevo!"
        });
      }

      const deberCompletado = await completarDeber(
        req.params.id,
        perfil as DestinatarioDeber
      );

      return res.json({
        ok: true,
        completado: true,
        mensaje: "¡Enhorabuena! Has acertado todas las respuestas.",
        deber: deberCompletado
      });

    } catch (error) {
      console.error("[HOMEWORK] Error al comprobar respuestas:", error);

      return res.status(500).json({
        ok: false,
        error: "No se han podido comprobar las respuestas."
      });
    }
  }
);

// ========================================
// COMPLETAR DEBER
// ========================================

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

      const deberes = await listarDeberes({
        perfil: perfil as DestinatarioDeber
      });

      const deber = deberes.find(
        (item: any) => String(item._id) === String(req.params.id)
      );

      if (!deber) {
        return res.status(404).json({
          ok: false,
          error: "No se ha encontrado el deber."
        });
      }

      if (deber.tipo === "ejercicio") {
        return res.status(400).json({
          ok: false,
          error: "Los ejercicios se completan al acertar todas las respuestas."
        });
      }

      const deberCompletado = await completarDeber(
        req.params.id,
        perfil as DestinatarioDeber
      );

      return res.json({
        ok: true,
        deber: deberCompletado
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

// ========================================
// REABRIR DEBER
// ========================================

router.patch(
  "/homework/:id/reopen",
  async (req: Request, res: Response) => {
    try {
      const perfil = String(req.body?.perfil || "");

      let deber;

      if (perfil === "papa") {
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

        deber = await reabrirDeber(req.params.id);

      } else if (
        DESTINATARIOS.includes(perfil as DestinatarioDeber)
      ) {
        deber = await reabrirDeber(
          req.params.id,
          perfil as DestinatarioDeber
        );

      } else {
        return res.status(400).json({
          ok: false,
          error: "Perfil no válido."
        });
      }

      return res.json({ ok: true, deber });

    } catch (error) {
      console.error("[HOMEWORK] Error al reabrir:", error);

      return res.status(404).json({
        ok: false,
        error: "No se ha encontrado un deber completado para este perfil."
      });
    }
  }
);

export default router;
