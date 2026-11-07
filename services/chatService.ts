import { MongoClient, Collection, Db } from "mongodb";

export interface MensajeChat {
  perfil: "leo" | "papa" | "mama";
  texto: string;
  creadoEn: Date;
}

let cliente: MongoClient | null = null;
let coleccion: Collection<MensajeChat> | null = null;

async function obtenerColeccion(): Promise<Collection<MensajeChat>> {
  if (coleccion) return coleccion;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Falta configurar MONGODB_URI.");

  if (!cliente) {
    cliente = new MongoClient(uri);
    await cliente.connect();
  }

  const nombreBaseDatos = process.env.MONGODB_DB || "academia_campos";
  const db: Db = cliente.db(nombreBaseDatos);
  coleccion = db.collection<MensajeChat>("family_chat_messages");

  return coleccion;
}

export async function listarMensajesChat() {
  const db = await obtenerColeccion();

  const mensajes = await db
    .find({})
    .sort({ creadoEn: -1 })
    .limit(100)
    .toArray();

  return mensajes.reverse().map((mensaje) => ({
    id: mensaje._id?.toString(),
    perfil: mensaje.perfil,
    texto: mensaje.texto,
    creadoEn: mensaje.creadoEn
  }));
}

export async function guardarMensajeChat(
  perfil: MensajeChat["perfil"],
  texto: string
) {
  const db = await obtenerColeccion();

  const mensaje: MensajeChat = {
    perfil,
    texto,
    creadoEn: new Date()
  };

  const resultado = await db.insertOne(mensaje);

  return {
    id: resultado.insertedId.toString(),
    ...mensaje
  };
}
