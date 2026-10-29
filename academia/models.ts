// academia/models.ts
import { Collection, MongoClient } from 'mongodb';

let cachedClient: MongoClient | null = null;

export async function getUserProgressCollection(): Promise<Collection> {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || process.env.MONGO_URL;

    if (!uri) {
        throw new Error('❌ No se encontró ninguna variable de entorno para MongoDB (revisa Render).');
    }

    if (!cachedClient) {
        cachedClient = new MongoClient(uri);
        await cachedClient.connect();
    }

    // Se conecta a la misma base de datos y crea/usa la colección 'user_progress'
    return cachedClient.db().collection('user_progress');
}
