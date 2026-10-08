import { Client, TextChannel } from 'discord.js';
import { MongoClient as MongoDriver } from 'mongodb';

const uri = process.env.MONGODB_URI || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const clientMongo = new MongoDriver(uri);

let reactionCollection: any = null;

export async function getReactionCollection() {
    if (!reactionCollection) {
        await clientMongo.connect();
        reactionCollection = clientMongo.db('redline_bot').collection('reaction_roles');
    }
    return reactionCollection;
}

// Inicializador con limpieza automática (Purga el error 10008 de MongoDB si el mensaje ya no existe)
export async function initReactionRoles(client: Client) {
    try {
        const col = await getReactionCollection();
        const configs = await col.find({}).toArray();

        let synchronizedCount = 0;
        for (const config of configs) {
            try {
                const channel = await client.channels.fetch(config.channelId) as TextChannel;
                if (channel) {
                    await channel.messages.fetch(config.messageId);
                    synchronizedCount++;
                }
            } catch (error: any) {
                if (error.code === 10008) {
                    console.warn(`⚠️ [ReactionRoles] El mensaje ${config.messageId} ya no existe en Discord. Limpiando de la base de datos...`);
                    await col.deleteOne({ messageId: config.messageId });
                } else {
                    console.error(`❌ [ReactionRoles] Error al verificar mensaje ${config.messageId}:`, error.message);
                }
            }
        }
        console.log(`🎭 [ReactionRoles] Sincronizados ${synchronizedCount} mensajes de roles por reacción con éxito.`);
    } catch (error) {
        console.error('❌ Error al inicializar Reaction Roles:', error);
    }
}
