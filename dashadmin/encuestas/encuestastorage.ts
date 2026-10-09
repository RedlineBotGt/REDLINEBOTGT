import { MongoClient as MongoDriver } from 'mongodb';

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || process.env.MONGO_URL || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const client = new MongoDriver(uri);

let pendingPollsCol: any = null;
let activePollsCol: any = null;

export async function getCollections() {
    if (!pendingPollsCol || !activePollsCol) {
        await client.connect();
        const db = client.db('redline_bot');
        pendingPollsCol = db.collection('encuestas_pending');
        activePollsCol = db.collection('encuestas_active');
        console.log('📊 [MongoDB] Conectado a las colecciones de encuestas.');
    }
    return { pendingPollsCol, activePollsCol };
}
