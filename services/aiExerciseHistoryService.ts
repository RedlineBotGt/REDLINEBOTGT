import { MongoClient, Collection, Db } from "mongodb";
import type { AsignaturaReto } from "./aiService.js";

type Perfil = "leo";

interface EjercicioIADocumento {
  id: string;
  perfil: Perfil;
  asignatura: AsignaturaReto;
  pregunta: string;
  intentos: number;
  completado: boolean;
  creadoEn: Date;
  completadoEn?: Date;
}

let cliente: MongoClient | null = null;
let coleccion: Collection<EjercicioIADocumento> | null = null;

async function obtenerColeccion(): Promise<Collection<EjercicioIADocumento>> {
  if (coleccion) return coleccion;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Falta configurar MONGODB_URI.");
  if (!cliente) {
    cliente = new MongoClient(uri);
    await cliente.connect();
  }
  const db: Db = cliente.db(process.env.MONGODB_DB || "academia_campos");
  coleccion = db.collection<EjercicioIADocumento>("ai_exercise_history");
  return coleccion;
}

export async function registrarIntentoEjercicioIA(datos: {
  id: string;
  perfil: Perfil;
  asignatura: AsignaturaReto;
  pregunta: string;
}): Promise<number> {
  const db = await obtenerColeccion();
  await db.updateOne(
    { id: datos.id, perfil: "leo" },
    {
      $setOnInsert: {
        id: datos.id,
        perfil: "leo",
        asignatura: datos.asignatura,
        pregunta: datos.pregunta,
        completado: false,
        creadoEn: new Date()
      },
      $inc: { intentos: 1 }
    },
    { upsert: true }
  );
  const documento = await db.findOne(
    { id: datos.id, perfil: "leo" },
    { projection: { intentos: 1 } }
  );
  return documento?.intentos || 1;
}

export async function completarEjercicioIA(id: string, intentos: number): Promise<void> {
  const db = await obtenerColeccion();
  await db.updateOne(
    { id, perfil: "leo" },
    { $set: { completado: true, intentos, completadoEn: new Date() } }
  );
}

export async function obtenerHistorialEjerciciosIA(_perfil: Perfil): Promise<Array<{
  asignatura: string;
  pregunta: string;
  intentos: number;
  completadoEn: Date;
}>> {
  const db = await obtenerColeccion();
  const documentos = await db.find(
    { perfil: "leo", completado: true },
    { projection: { _id: 0, asignatura: 1, pregunta: 1, intentos: 1, completadoEn: 1 } }
  ).sort({ completadoEn: -1 }).limit(500).toArray();

  const nombres: Record<string, string> = {
    cultura_general: "Cultura general",
    pensamiento_lateral: "Retos Imposibles",
    matematicas: "Matemáticas",
    geografia: "Geografía",
    english: "English",
    lengua: "Lengua",
    lenguaje_musical: "Lenguaje Musical",
    science: "Science",
    lateral: "Cultura general"
  };
  return documentos.map(item => ({
    asignatura: nombres[item.asignatura] || item.asignatura,
    pregunta: item.pregunta,
    intentos: item.intentos || 1,
    completadoEn: item.completadoEn || new Date()
  }));
}
