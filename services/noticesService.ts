import { MongoClient, Collection, ObjectId } from "mongodb";

export interface Aviso {
  autor: "papa" | "chat";
  destinatario: "leo" | "mama" | "todos";
  tipo?: "chat";
  chatMessageId?: string;
  mensaje: string;
  deberId?: string;
  creadoEn: Date;
}

let cliente: MongoClient | null = null;
let coleccion: Collection<Aviso> | null = null;

async function obtenerColeccion(): Promise<Collection<Aviso>> {
  if (coleccion) return coleccion;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Falta configurar MONGODB_URI.");
  if (!cliente) {
    cliente = new MongoClient(uri);
    await cliente.connect();
  }
  coleccion = cliente.db(process.env.MONGODB_DB || "academia_campos")
    .collection<Aviso>("family_notices");
  return coleccion;
}

export async function listarAvisos() {
  return (await obtenerColeccion()).find({})
    .sort({ creadoEn: -1 }).limit(200).toArray();
}

export async function crearAviso(
  destinatario: Aviso["destinatario"],
  mensaje: string,
  deberId?: string
) {
  const aviso: Aviso = {
    autor: "papa",
    destinatario,
    mensaje: mensaje.trim(),
    ...(deberId ? { deberId } : {}),
    creadoEn: new Date()
  };
  const resultado = await (await obtenerColeccion()).insertOne(aviso);
  return { ...aviso, _id: resultado.insertedId };
}

export async function crearAvisoChat(
  perfil: "leo" | "papa" | "mama",
  chatMessageId: string
) {
  const aviso = {
    autor: "chat" as const,
    destinatario: "todos" as const,
    tipo: "chat" as const,
    chatMessageId,
    mensaje: "__CHAT__:" + perfil,
    creadoEn: new Date()
  };

  await (await obtenerColeccion()).updateOne(
    { chatMessageId },
    { $setOnInsert: aviso },
    { upsert: true }
  );

  return aviso;
}

export async function sincronizarAvisoDeber(
  deberId: string,
  destinatario: "leo" | "mama",
  asignatura: string
) {
  const avisos = await obtenerColeccion();
  await avisos.updateOne(
    { deberId },
    {
      $set: {
        autor: "papa",
        destinatario,
        mensaje: "__DEBER__:" + asignatura,
        deberId
      },
      $setOnInsert: { creadoEn: new Date() }
    },
    { upsert: true }
  );
}

export async function eliminarAvisoDeber(deberId: string) {
  await (await obtenerColeccion()).deleteMany({ deberId });
}

export async function actualizarAviso(
  id: string,
  destinatario: Aviso["destinatario"],
  mensaje: string
) {
  if (!ObjectId.isValid(id)) return false;
  const resultado = await (await obtenerColeccion()).updateOne(
    { _id: new ObjectId(id) } as any,
    { $set: { destinatario, mensaje: mensaje.trim() } }
  );
  return resultado.matchedCount > 0;
}

export async function eliminarAviso(id: string) {
  if (!ObjectId.isValid(id)) return false;
  const resultado = await (await obtenerColeccion()).deleteOne(
    { _id: new ObjectId(id) } as any
  );
  return resultado.deletedCount > 0;
}
