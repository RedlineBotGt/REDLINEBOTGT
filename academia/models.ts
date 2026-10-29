// academia/models.ts
import { MongoClient, Db, Collection } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDB(): Promise<Db> {
    if (db) return db;
    
    // Utiliza la misma URI de MongoDB que ya usa tu bot en las variables de entorno
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
    if (!uri) {
        throw new Error("No se ha encontrado la variable de entorno MONGODB_URI o MONGO_URI");
    }

    client = new MongoClient(uri);
    await client.connect();
    db = client.db('academia_campos');
    return db;
}

export async function getUserProgressCollection(): Promise<Collection> {
    const database = await connectDB();
    return database.collection('user_progress');
}
