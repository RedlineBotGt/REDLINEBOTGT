import { Client, TextChannel } from 'discord.js';
import { MongoClient, Collection as MongoCollection } from 'mongodb';

const LCS_GUILD_ID = '1564967606295732304';

interface IAlarma {
    guildId: string;
    channelId: string;
    hora: string; // Formato HH:mm
    texto: string;
    creadoPor: string;
    activa: boolean;
}

let alarmasCollection: MongoCollection<IAlarma> | null = null;

export async function getAlarmasCollection(): Promise<MongoCollection<IAlarma>> {
    if (alarmasCollection) return alarmasCollection;
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || process.env.MONGO_URL;
    if (!uri) throw new Error('❌ No se encontró URI de MongoDB para las alarmas.');

    const client = new MongoClient(uri);
    await client.connect();
    alarmasCollection = client.db().collection<IAlarma>('lcs_alarmas');
    return alarmasCollection;
}

/**
 * ⏰ Worker que comprueba la hora cada minuto
 */
export function setupAlarmaWorker(client: Client) {
    console.log('⏰ [LCS AlarmaWorker] Sistema de alarmas de LCS activado.');

    setInterval(async () => {
        try {
            // Obtener hora actual de Madrid/España (Formato 24h: HH:mm)
            const ahora = new Date().toLocaleTimeString('es-ES', {
                timeZone: 'Europe/Madrid',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });

            const collection = await getAlarmasCollection();
            const alarmasPendientes = await collection.find({ 
                guildId: LCS_GUILD_ID, 
                hora: ahora, 
                activa: true 
            }).toArray();

            for (const alarma of alarmasPendientes) {
                const guild = client.guilds.cache.get(alarma.guildId);
                if (!guild) continue;

                const channel = guild.channels.cache.get(alarma.channelId) as TextChannel;
                if (channel) {
                    await channel.send(alarma.texto);
                    console.log(`🔔 [LCS Alarma] Mensaje enviado al canal ${channel.name} a las ${ahora}`);
                }

                // Desactivar la alarma tras enviarla (o eliminarla)
                await collection.updateOne({ _id: alarma._id }, { $set: { activa: false } });
            }
        } catch (error) {
            console.error('❌ Error en AlarmaWorker:', error);
        }
    }, 60000); // Se ejecuta cada 60 segundos
}
