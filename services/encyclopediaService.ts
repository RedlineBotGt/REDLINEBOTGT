import { MongoClient, Collection, Db, ObjectId } from "mongodb";
import { GoogleGenAI } from "@google/genai";
export type PerfilEnciclopedia = "leo" | "papa" | "mama";
type Fuente = { title: string; url: string };
type Mensaje = { role: "user" | "assistant"; content: string; createdAt: Date; sources?: Fuente[] };
type Conversacion = { _id?: ObjectId; perfil: PerfilEnciclopedia; title: string; messages: Mensaje[]; createdAt: Date; updatedAt: Date };
type Uso = { _id: string; count: number };
let cliente: MongoClient | null = null;
let chats: Collection<Conversacion> | null = null;
let uso: Collection<Uso> | null = null;
async function obtenerColecciones() {
  if (chats && uso) return { chats, uso };
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Falta MONGODB_URI.");
  if (!cliente) { cliente = new MongoClient(uri); await cliente.connect(); }
  const db: Db = cliente.db(process.env.MONGODB_DB || "academia_campos");
  chats = db.collection<Conversacion>("encyclopedia_conversations");
  uso = db.collection<Uso>("encyclopedia_search_usage");
  return { chats, uso };
}
async function reservarBusqueda() {
  const { uso } = await obtenerColecciones();
  const dia = new Date().toISOString().slice(0, 10), mes = dia.slice(0, 7);
  const [d, m] = await Promise.all([uso.findOne({ _id: "d:" + dia }), uso.findOne({ _id: "m:" + mes })]);
  if ((d?.count || 0) >= 4 || (m?.count || 0) >= 80) return false;
  await Promise.all([
    uso.updateOne({ _id: "d:" + dia }, { $inc: { count: 1 } }, { upsert: true }),
    uso.updateOne({ _id: "m:" + mes }, { $inc: { count: 1 } }, { upsert: true })
  ]);
  return true;
}
function extraerFuentes(response: any): Fuente[] {
  const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const vistas = new Set<string>(), salida: Fuente[] = [];
  for (const chunk of chunks) {
    const url = String(chunk?.web?.uri || "");
    if (!url.startsWith("https://") || vistas.has(url)) continue;
    vistas.add(url);
    salida.push({ title: String(chunk.web.title || new URL(url).hostname), url });
    if (salida.length >= 8) break;
  }
  return salida;
}
export async function responderEnciclopedia(input: { perfil: PerfilEnciclopedia; conversacionId?: string; mensaje: string }) {
  const { chats } = await obtenerColecciones();
  const ahora = new Date();
  let chat: Conversacion | null = null;
  if (input.conversacionId) {
    if (!ObjectId.isValid(input.conversacionId)) throw new Error("Conversación no válida.");
    chat = await chats.findOne({ _id: new ObjectId(input.conversacionId), perfil: input.perfil });
    if (!chat) throw new Error("No se ha encontrado esta conversación.");
  } else {
    const nueva: Conversacion = { perfil: input.perfil, title: input.mensaje.slice(0, 90), messages: [], createdAt: ahora, updatedAt: ahora };
    const insertada = await chats.insertOne(nueva);
    chat = { ...nueva, _id: insertada.insertedId };
  }
  const contexto = chat.messages.slice(-12).map(m => (m.role === "user" ? "Usuario: " : "Enciclopedia: ") + m.content).join("\n\n");
  const perfilPrompt = input.perfil === "leo"
    ? "Explica en español claro, con ejemplos y frases breves. Leo puede preguntar cualquier tema, incluso avanzado: adapta la explicación sin limitar los temas."
    : "Responde en español con rigor y profundidad adulta.";
  const buscar = await reservarBusqueda();
  const prompt = ["Eres Enciclopedia de Academia Campos.", perfilPrompt, "Responde y conserva el hilo de la conversación. Si la búsqueda web está activa, contrasta la información y no inventes fuentes.", contexto ? "CONTEXTO:\n" + contexto : "", "PREGUNTA:\n" + input.mensaje].filter(Boolean).join("\n\n");
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY.");
  const ai = new GoogleGenAI({ apiKey });
  const config: any = { maxOutputTokens: 1800 };
  if (buscar) config.tools = [{ googleSearch: {} }];
  const respuesta: any = await ai.models.generateContent({ model: "gemini-3.8-flash", contents: prompt, config });
  const texto = String(respuesta?.text || "").trim();
  if (!texto) throw new Error("La Enciclopedia no ha devuelto una respuesta.");
  const fuentes = buscar ? extraerFuentes(respuesta) : [];
  const mensajes: Mensaje[] = [...chat.messages,
    { role: "user" as const, content: input.mensaje, createdAt: ahora },
    { role: "assistant" as const, content: texto, createdAt: new Date(), sources: fuentes }
  ].slice(-30);
  await chats.updateOne({ _id: chat._id, perfil: input.perfil }, { $set: { messages: mensajes, updatedAt: new Date() } });
  return { conversacionId: String(chat._id), title: chat.title, respuesta: texto, fuentes };
}
export async function listarConversacionesEnciclopedia(perfil: PerfilEnciclopedia) {
  const { chats } = await obtenerColecciones();
  const filas = await chats.find({ perfil }).sort({ updatedAt: -1 }).limit(100).toArray();
  return filas.map(x => ({ id: String(x._id), perfil: x.perfil, title: x.title, messages: x.messages, createdAt: x.createdAt, updatedAt: x.updatedAt }));
}
export async function obtenerConversacionesHistorialIA() {
  const { chats } = await obtenerColecciones();
  const filas = await chats.find({}).sort({ updatedAt: -1 }).limit(300).toArray();
  return filas.map(x => ({ id: String(x._id), perfil: x.perfil, title: x.title, messages: x.messages, createdAt: x.createdAt, updatedAt: x.updatedAt }));
}