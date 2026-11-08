import { MongoClient, Collection } from "mongodb";

export interface Aviso {
  autor: "papa";
  destinatario: "leo" | "mama" | "todos";
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
  const avisos = await obtenerColeccion();
  const db = avisos.db;
  const deberes = await db.collection("homework")
    .find({}, { projection: { destinatario: 1, asignatura: 1 } })
    .toArray();

  // Limpia avisos antiguos (anteriores a la vinculación por ID)
  // cuando ya no existe ningún deber con esa asignatura y destinatario.
  const activos = new Set(
    deberes.map((deber: any) => `${deber.destinatario}:${deber.asignatura}`)
  );
  const antiguos = await avisos.find({
    mensaje: { $regex: "^__DEBER__:" },
    deberId: { $exists: false }
  }).toArray();

  for (const aviso of antiguos) {
    const asignatura = aviso.mensaje.slice("__DEBER__:".length);
    if (!activos.has(`${aviso.destinatario}:${asignatura}`)) {
      await avisos.deleteOne({ _id: (aviso as any)._id });
    }
  }

  return avisos.find({})
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
