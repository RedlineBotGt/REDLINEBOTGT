import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0";
const client = new MongoClient(uri);

let dbCollection: any = null;

async function getCollection() {
    if (!dbCollection) {
        await client.connect();
        // Conecta a la base de datos 'redline_bot' y a la colección 'forms'
        dbCollection = client.db('redline_bot').collection('forms');
    }
    return dbCollection;
}

// Estructura de un formulario
export interface FormularioData {
    titulo: string;
    canalRespuestas: string;
    preguntas: string[];
}

// 1. Obtener todos los formularios guardados
export async function obtenerFormularios(): Promise<Record<string, FormularioData>> {
    try {
        const col = await getCollection();
        const docs = await col.find({}).toArray();
        const formularios: Record<string, FormularioData> = {};
        
        docs.forEach((doc: any) => {
            formularios[doc.titulo] = {
                titulo: doc.titulo,
                canalRespuestas: doc.canalRespuestas,
                preguntas: doc.preguntas
            };
        });
        return formularios;
    } catch (error) {
        console.error('❌ Error al leer formularios de MongoDB:', error);
        return {};
    }
}

// 2. Guardar o actualizar un formulario (usando el Título como clave única)
export async function guardarFormulario(titulo: string, canalRespuestas: string, preguntas: string[]) {
    try {
        const col = await getCollection();
        await col.updateOne(
            { titulo },
            { $set: { titulo, canalRespuestas, preguntas } },
            { upsert: true }
        );
    } catch (error) {
        console.error('❌ Error al guardar formulario en MongoDB:', error);
    }
}

// 3. Buscar un formulario específico por su título
export async function obtenerFormularioPorTitulo(titulo: string): Promise<FormularioData | null> {
    try {
        const col = await getCollection();
        const doc = await col.findOne({ titulo });
        if (!doc) return null;
        return {
            titulo: doc.titulo,
            canalRespuestas: doc.canalRespuestas,
            preguntas: doc.preguntas
        };
    } catch (error) {
        console.error('❌ Error al buscar formulario en MongoDB:', error);
        return null;
    }
}
