import {
  MongoClient,
  ObjectId,
  Collection,
  Db
} from "mongodb";

// ========================================
// TIPOS DE DATOS
// ========================================

export type TipoDeber = "enlace" | "ejercicio" | "escrito";

export type DestinatarioDeber = "leo" | "mama";

export type EstadoDeber = "pendiente" | "completado";

export interface Deber {
  _id?: ObjectId;
  titulo: string;
  asignatura: string;
  tipo: TipoDeber;
  contenido: string;
  destinatario: DestinatarioDeber;
  fechaLimite?: string | null;
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
    "fechaLimite"
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

  const resultado = await db.updateOne(
    { _id: new ObjectId(id) },
    { $set: actualizaciones }
  );

  if (resultado.matchedCount === 0) {
    throw new Error("No se ha encontrado el deber.");
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

  const resultado = await db.deleteOne({
    _id: new ObjectId(id)
  });

  if (resultado.deletedCount === 0) {
    throw new Error("No se ha encontrado el deber.");
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