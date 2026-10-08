import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const client = new MongoClient(uri);

let dbCollection: any = null;

async function getCollection() {
    if (!dbCollection) {
        await client.connect();
        dbCollection = client.db('redline_bot').collection('forms');
        console.log('📦 [MongoDB] Conectado a la base de datos de formularios con éxito.');
    }
    return dbCollection;
}

export interface FormularioData {
    guildId: string;
    titulo: string;
    canalRespuestas: string | null;
    preguntas: string[];
}

export async function obtenerFormularios(guildId: string): Promise<Record<string, FormularioData>> {
    try {
        const col = await getCollection();
        const docs = await col.find({ guildId }).toArray();
        const formularios: Record<string, FormularioData> = {};

        docs.forEach((doc: any) => {
            formularios[doc.titulo] = {
                guildId: doc.guildId,
                titulo: doc.titulo,
                canalRespuestas: doc.canalRespuestas || null,
                preguntas: doc.preguntas
            };
        });
        return formularios;
    } catch (error) {
        console.error('❌ Error al leer formularios de MongoDB:', error);
        return {};
    }
}

export async function guardarFormulario(guildId: string, titulo: string, canalRespuestas: string | null = null, preguntas: string[]) {
    try {
        const col = await getCollection();
        await col.updateOne(
            { guildId, titulo },
            { $set: { guildId, titulo, canalRespuestas, preguntas } },
            { upsert: true }
        );
    } catch (error) {
        console.error('❌ Error al guardar formulario en MongoDB:', error);
        throw error;
    }
}

export async function obtenerFormularioPorTitulo(guildId: string, titulo: string): Promise<FormularioData | null> {
    try {
        const col = await getCollection();
        const doc = await col.findOne({ guildId, titulo });
        if (!doc) return null;
        return {
            guildId: doc.guildId,
            titulo: doc.titulo,
            canalRespuestas: doc.canalRespuestas || null,
            preguntas: doc.preguntas
        };
    } catch (error) {
        console.error('❌ Error al buscar formulario en MongoDB:', error);
        return null;
    }
}

export async function eliminarFormulario(guildId: string, titulo: string) {
    try {
        const col = await getCollection();
        await col.deleteOne({ guildId, titulo });
    } catch (error) {
        console.error('❌ Error al eliminar formulario en MongoDB:', error);
        throw error;
    }
}
