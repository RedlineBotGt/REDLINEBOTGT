// academia/models.ts
import { MongoClient, Db, Collection } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDB(): Promise<Db> {
    if (db) return db;
    
    // Comprobamos todas las variantes posibles de variables de entorno de MongoDB
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URL || '';
    if (!uri) {
        throw new Error("No se ha encontrado ninguna variable de entorno válida para MongoDB (MONGODB_URI, MONGO_URI, MONGO_URL, etc.)");
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
