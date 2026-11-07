import { MongoClient, Collection } from "mongodb";

export interface Aviso {
  autor: "papa";
  destinatario: "leo" | "mama" | "todos";
  mensaje: string;
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

export async function crearAviso(destinatario: Aviso["destinatario"], mensaje: string) {
  const aviso: Aviso = { autor: "papa", destinatario, mensaje: mensaje.trim(), creadoEn: new Date() };
  const resultado = await (await obtenerColeccion()).insertOne(aviso);
  return { ...aviso, _id: resultado.insertedId };
}
