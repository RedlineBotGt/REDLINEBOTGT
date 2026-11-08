
import {
  MongoClient,
  ObjectId,
  Collection,
  Db,
  GridFSBucket
} from "mongodb";

// ========================================
// TIPOS DE DATOS
// ========================================

export type TipoDeber = "enlace" | "ejercicio" | "ejercicio_imagen" | "escrito";

export type DestinatarioDeber = "leo" | "mama";

export type EstadoDeber = "pendiente" | "completado";

export interface PreguntaDeber {
  id: string;
  pregunta: string;
  respuestaCorrecta: string;
}

export interface ImagenDeber {
  fileId: string;
  nombre: string;
  contentType: string;
  tamano: number;
}

export interface Deber {
  _id?: ObjectId;
  titulo: string;
  asignatura: string;
  tipo: TipoDeber;
  contenido: string;
  destinatario: DestinatarioDeber;
  fechaLimite?: string | null;
  preguntas?: PreguntaDeber[];
  imagenes?: ImagenDeber[];
  estado: EstadoDeber;
  completadoEn?: Date | null;
  completadoPor?: string | null;
  creadoEn: Date;
  actualizadoEn: Date;
}

// ========================================
// CONEXIÓN CON MONGODB
// ========================================

let cliente: MongoClient | null = null;
let baseDatos: Db | null = null;
let coleccion: Collection<Deber> | null = null;

async function obtenerColeccion(): Promise<Collection<Deber>> {
  if (coleccion) {
    return coleccion;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Falta configurar la variable MONGODB_URI.");
  }

  if (!cliente) {
    cliente = new MongoClient(uri);
    await cliente.connect();
  }

  const nombreBaseDatos =
    process.env.MONGODB_DB || "academia_campos";

  baseDatos = cliente.db(nombreBaseDatos);
  coleccion = baseDatos.collection<Deber>("homework");

  return coleccion;
}


/* ========================================
   IMÁGENES DE DEBERES (MONGODB GRIDFS)
======================================== */

function obtenerBucketImagenes(): GridFSBucket {
  if (!baseDatos) throw new Error("La conexión de MongoDB no está preparada.");
  return new GridFSBucket(baseDatos, { bucketName: "homework_images" });
}

async function eliminarArchivosImagenes(imagenes: ImagenDeber[] = []) {
  if (!imagenes.length) return;
  const bucket = obtenerBucketImagenes();
  for (const imagen of imagenes) {
    if (!ObjectId.isValid(imagen.fileId)) continue;
    try { await bucket.delete(new ObjectId(imagen.fileId)); }
    catch (error) { console.warn("[HOMEWORK] No se pudo borrar una imagen:", error); }
  }
}

export async function guardarImagenDeber(
  id: string, buffer: Buffer, nombre: string, contentType: string
): Promise<ImagenDeber> {
  if (!ObjectId.isValid(id)) throw new Error("Identificador de deber no válido.");
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
    throw new Error("La imagen está vacía o supera los 5 MB.");
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
    throw new Error("Solo se admiten imágenes JPG, PNG o WebP.");
  }

  const db = await obtenerColeccion();
  const deber = await db.findOne({ _id: new ObjectId(id) });
  if (!deber || deber.tipo !== "ejercicio_imagen") {
    throw new Error("No se ha encontrado un ejercicio con imágenes.");
  }
  const actuales = Array.isArray(deber.imagenes) ? deber.imagenes : [];
  if (actuales.length >= 5) throw new Error("Un ejercicio puede tener como máximo 5 imágenes.");

  const bucket = obtenerBucketImagenes();
  const subida = bucket.openUploadStream(nombre, {
    contentType,
    metadata: { homeworkId: id }
  });
  await new Promise<void>((resolve, reject) => {
    subida.once("finish", resolve);
    subida.once("error", reject);
    subida.end(buffer);
  });

  const imagen: ImagenDeber = {
    fileId: String(subida.id), nombre, contentType, tamano: buffer.length
  };

  try {
    const actualizacion = await db.updateOne(
      {
        _id: new ObjectId(id),
        tipo: "ejercicio_imagen",
        $expr: { $lt: [{ $size: { $ifNull: ["$imagenes", []] } }, 5] }
      },
      { $push: { imagenes: imagen } as any }
    );
    if (actualizacion.matchedCount === 0) {
      await bucket.delete(subida.id);
      throw new Error("No se ha podido asociar la imagen al ejercicio.");
    }
  } catch (error) {
    try { await bucket.delete(subida.id); } catch {}
    throw error;
  }
  return imagen;
}

export async function obtenerImagenDeber(id: string, fileId: string, perfil: string) {
  if (!ObjectId.isValid(id) || !ObjectId.isValid(fileId)) return null;
  if (!["leo", "mama", "papa"].includes(perfil)) return null;

  const db = await obtenerColeccion();
  const filtro: Record<string, unknown> = { _id: new ObjectId(id) };
  if (perfil !== "papa") filtro.destinatario = perfil;
  const deber = await db.findOne(filtro);
  if (!deber || deber.tipo !== "ejercicio_imagen") return null;

  const imagenes = Array.isArray(deber.imagenes) ? deber.imagenes : [];
  const imagen = imagenes.find(item => item.fileId === fileId);
  if (!imagen) return null;

  const bucket = obtenerBucketImagenes();
  const archivo = await bucket.find({
    _id: new ObjectId(fileId),
    "metadata.homeworkId": id
  }).next();
  if (!archivo) return null;

  return {
    stream: bucket.openDownloadStream(new ObjectId(fileId)),
    contentType: imagen.contentType,
    tamano: imagen.tamano
  };
}

// ========================================
// LISTAR DEBERES
// ========================================

export async function listarDeberes(
  filtros: {
    perfil?: string;
    asignatura?: string;
    estado?: EstadoDeber;
  } = {}
) {
  const db = await obtenerColeccion();

  const consulta: Record<string, unknown> = {};

  if (filtros.perfil) {
    consulta.destinatario = filtros.perfil;
  }

  if (filtros.asignatura) {
    consulta.asignatura = filtros.asignatura;
  }

  if (filtros.estado) {
    consulta.estado = filtros.estado;
  }

  return db.find(consulta)
    .sort({
      estado: 1,
      fechaLimite: 1,
      creadoEn: -1
    })
    .toArray();
}

// ========================================
// CREAR DEBER
// ========================================

export async function crearDeber(
  datos: Omit<
    Deber,
    | "_id"
    | "estado"
    | "completadoEn"
    | "completadoPor"
    | "creadoEn"
    | "actualizadoEn"
  >
) {
  const db = await obtenerColeccion();
  const ahora = new Date();

  const nuevoDeber: Deber = {
    ...datos,
    estado: "pendiente",
    completadoEn: null,
    completadoPor: null,
    creadoEn: ahora,
    actualizadoEn: ahora
  };

  const resultado = await db.insertOne(nuevoDeber);

  return {
    ...nuevoDeber,
    _id: resultado.insertedId
  };
}

// ========================================
// EDITAR DEBER
// ========================================

export async function editarDeber(
  id: string,
  cambios: Partial<Deber>
) {
  if (!ObjectId.isValid(id)) {
    throw new Error("Identificador de deber no válido.");
  }

  const permitidos = [
    "titulo",
    "asignatura",
    "tipo",
    "contenido",
    "destinatario",
    "fechaLimite",
    "preguntas"
  ];

  const actualizaciones: Record<string, unknown> = {};

  for (const campo of permitidos) {
    if (campo in cambios) {
      actualizaciones[campo] = cambios[campo as keyof Deber];
    }
  }

  // Permitir cambiar el estado desde la edición de Papá.
  if ("estado" in cambios) {
    if (
      cambios.estado !== "pendiente" &&
      cambios.estado !== "completado"
    ) {
      throw new Error("Estado de deber no válido.");
    }

    actualizaciones.estado = cambios.estado;

    if (cambios.estado === "pendiente") {
      actualizaciones.completadoEn = null;
      actualizaciones.completadoPor = null;
    } else {
      actualizaciones.completadoEn = new Date();
      actualizaciones.completadoPor = "papa";
    }
  }

  if (Object.keys(actualizaciones).length === 0) {
    throw new Error("No hay cambios válidos.");
  }

  actualizaciones.actualizadoEn = new Date();

  const db = await obtenerColeccion();
  const deberAnterior = await db.findOne({ _id: new ObjectId(id) });

  const actualizacionMongo: any = { $set: actualizaciones };

  if (
    cambios.tipo !== undefined &&
    cambios.tipo !== "ejercicio" &&
    cambios.tipo !== "ejercicio_imagen"
  ) {
    actualizacionMongo.$unset = { preguntas: "" };
  }

  if (cambios.tipo !== undefined && cambios.tipo !== "ejercicio_imagen") {
    actualizacionMongo.$unset = {
      ...(actualizacionMongo.$unset || {}),
      imagenes: ""
    };
  }

  const resultado = await db.updateOne(
    { _id: new ObjectId(id) },
    actualizacionMongo
  );

  if (resultado.matchedCount === 0) {
    throw new Error("No se ha encontrado el deber.");
  }

  if (
    deberAnterior?.tipo === "ejercicio_imagen" &&
    cambios.tipo !== undefined &&
    cambios.tipo !== "ejercicio_imagen"
  ) {
    await eliminarArchivosImagenes(deberAnterior.imagenes || []);
  }

  return db.findOne({ _id: new ObjectId(id) });
}

// ========================================
// ELIMINAR DEBER
// ========================================

export async function eliminarDeber(id: string) {
  if (!ObjectId.isValid(id)) {
    throw new Error("Identificador de deber no válido.");
  }

  const db = await obtenerColeccion();
  const deber = await db.findOne({ _id: new ObjectId(id) });

  const resultado = await db.deleteOne({
    _id: new ObjectId(id)
  });

  if (resultado.deletedCount === 0) {
    throw new Error("No se ha encontrado el deber.");
  }

  if (deber?.imagenes?.length) {
    await eliminarArchivosImagenes(deber.imagenes);
  }

  return { eliminado: true };
}

// ========================================
// COMPLETAR DEBER
// ========================================

export async function completarDeber(
  id: string,
  perfil: DestinatarioDeber
) {
  if (!ObjectId.isValid(id)) {
    throw new Error("Identificador de deber no válido.");
  }

  if (!["leo", "mama"].includes(perfil)) {
    throw new Error("Perfil no autorizado.");
  }

  const db = await obtenerColeccion();

  const resultado = await db.updateOne(
    {
      _id: new ObjectId(id),
      destinatario: perfil,
      estado: "pendiente"
    },
    {
      $set: {
        estado: "completado",
        completadoEn: new Date(),
        completadoPor: perfil,
        actualizadoEn: new Date()
      }
    }
  );

  if (resultado.matchedCount === 0) {
    throw new Error(
      "No se ha encontrado el deber pendiente para este perfil."
    );
  }

  return db.findOne({ _id: new ObjectId(id) });
}

// ========================================
// REABRIR DEBER
// ========================================

export async function reabrirDeber(
  id: string,
  perfil?: DestinatarioDeber
) {
  if (!ObjectId.isValid(id)) {
    throw new Error("Identificador de deber no válido.");
  }

  const db = await obtenerColeccion();

  const filtro = {
    _id: new ObjectId(id),
    estado: "completado" as EstadoDeber,
    ...(perfil ? { destinatario: perfil } : {})
  };

  const resultado = await db.updateOne(
    filtro,
    {
      $set: {
        estado: "pendiente",
        completadoEn: null,
        completadoPor: null,
        actualizadoEn: new Date()
      }
    }
  );

  if (resultado.matchedCount === 0) {
    throw new Error(
      "No se ha encontrado un deber completado para este perfil."
    );
  }

  return db.findOne({ _id: new ObjectId(id) });
}
