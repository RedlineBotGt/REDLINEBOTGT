import { ButtonStyle } from 'discord.js';
import { MongoClient as MongoDriver } from 'mongodb';

const uri = process.env.MONGODB_URI || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const client = new MongoDriver(uri);

let ticketCollection: any = null;

async function getTicketCollection() {
    if (!ticketCollection) {
        await client.connect();
        ticketCollection = client.db('redline_bot').collection('tickets');
        console.log('🎟️ [MongoDB] Conectado a la colección de tickets con éxito.');
    }
    return ticketCollection;
}

export interface TicketConfig {
    label: string;
    style: ButtonStyle;
    roleQuery: string;
    publicMsg: string;
    privateMsg: string;
}

// Obtener todos los tickets guardados (para cargarlos en memoria o consultarlos)
export async function obtenerTickets(): Promise<Record<string, TicketConfig>> {
    try {
        const col = await getTicketCollection();
        const docs = await col.find({}).toArray();
        const tickets: Record<string, TicketConfig> = {};

        docs.forEach((doc: any) => {
            tickets[doc.uniqueId] = {
                label: doc.label,
                style: doc.style,
                roleQuery: doc.roleQuery,
                publicMsg: doc.publicMsg,
                privateMsg: doc.privateMsg
            };
        });
        return tickets;
    } catch (error) {
        console.error('❌ Error al leer tickets de MongoDB:', error);
        return {};
    }
}

// Guardar o actualizar un ticket en MongoDB
export async function guardarTicket(uniqueId: string, config: TicketConfig) {
    try {
        const col = await getTicketCollection();
        await col.updateOne(
            { uniqueId },
            { 
                $set: { 
                    uniqueId, 
                    label: config.label,
                    style: config.style,
                    roleQuery: config.roleQuery,
                    publicMsg: config.publicMsg,
                    privateMsg: config.privateMsg
                } 
            },
            { upsert: true }
        );
    } catch (error) {
        console.error('❌ Error al guardar ticket en MongoDB:', error);
        throw error;
    }
}
