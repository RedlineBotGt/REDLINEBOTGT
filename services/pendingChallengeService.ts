import { MongoClient, Collection, Db } from "mongodb";
import type { AsignaturaReto, RetoGenerado } from "./aiService.js";

export interface RetoPendiente {
  id: string;
  perfil: "leo" | "papa" | "mama";
  asignatura: AsignaturaReto;
  reto: RetoGenerado;
  creadoEn: number;
}

interface RetoPendienteDocumento extends Omit<RetoPendiente, "creadoEn"> {
  creadoEn: Date;
}

const DURACION_RETO_MS = 2 * 60 * 60 * 1000;

let cliente: MongoClient | null = null;
let coleccion: Collection<RetoPendienteDocumento> | null = null;

async function obtenerColeccion(): Promise<Collection<RetoPendienteDocumento>> {
  if (coleccion) return coleccion;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Falta configurar MONGODB_URI.");

  if (!cliente) {
    cliente = new MongoClient(uri);
    await cliente.connect();
  }

  const nombreBaseDatos = process.env.MONGODB_DB || "academia_campos";
  const db: Db = cliente.db(nombreBaseDatos);
  coleccion = db.collection<RetoPendienteDocumento>("pending_challenges");

  return coleccion;
}

export async function guardarRetoPendiente(reto: RetoPendiente): Promise<void> {
  const db = await obtenerColeccion();

  await db.insertOne({
    ...reto,
    creadoEn: new Date(reto.creadoEn)
  });
}

export async function obtenerRetoPendiente(id: string): Promise<RetoPendiente | null> {
  const db = await obtenerColeccion();
  const documento = await db.findOne({ id });

  if (!documento) return null;

  const creadoEn = documento.creadoEn.getTime();

  if (Date.now() - creadoEn > DURACION_RETO_MS) {
    await db.deleteOne({ id });
    return null;
  }

  return {
    ...documento,
    creadoEn
  };
}

export async function eliminarRetoPendiente(id: string): Promise<void> {
  const db = await obtenerColeccion();
  await db.deleteOne({ id });
}

export async function limpiarRetosCaducados(): Promise<void> {
  const db = await obtenerColeccion();
  const limite = new Date(Date.now() - DURACION_RETO_MS);
  await db.deleteMany({ creadoEn: { $lt: limite } });
}
