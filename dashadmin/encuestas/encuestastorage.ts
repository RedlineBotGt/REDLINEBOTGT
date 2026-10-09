import { MongoClient as MongoDriver, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || process.env.MONGO_URL || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const client = new MongoDriver(uri);

let encuestasCollection: any = null;

export async function getEncuestasCollection() {
    if (!encuestasCollection) {
        await client.connect();
        const db = client.db('redline_bot');
        encuestasCollection = db.collection('encuestas');
        console.log('📊 [MongoDB] Conectado al sistema de encuestas.');
    }
    return encuestasCollection;
}
