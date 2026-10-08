import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { MongoClient as MongoDriver } from 'mongodb';

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || process.env.MONGO_URL || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const clientMongo = new MongoDriver(uri);

let collection: any = null;

async function getCollection() {
    if (!collection) {
        await clientMongo.connect();
        collection = clientMongo.db('redline_bot').collection('scheduled_messages');
    }
    return collection;
}

export function startScheduledWorker(client: Client) {
    console.log('⏰ [Worker] Sistema de mensajes programados iniciado en segundo plano.');

    // Se ejecuta cada 60 segundos
    setInterval(async () => {
        try {
            const col = await getCollection();
            const now = new Date();

            // Buscamos mensajes pendientes cuya fecha de envío ya haya llegado o pasado
            const pendingMessages = await col.find({
                status: 'pending',
                scheduledAt: { $lte: now }
            }).toArray();

            if (pendingMessages.length === 0) return;

            for (const msg of pendingMessages) {
                try {
                    const guild = await client.guilds.fetch(msg.guildId).catch(() => null);
                    if (!guild) {
                        await col.updateOne({ _id: msg._id }, { $set: { status: 'guild_not_found' } });
                        continue;
                    }

                    const channel = await guild.channels.fetch(msg.channelId).catch(() => null) as TextChannel;
                    if (!channel || !channel.isTextBased()) {
                        await col.updateOne({ _id: msg._id }, { $set: { status: 'channel_not_found' } });
                        continue;
                    }

                    // Construimos la mención del rol si existe
                    let finalContent = msg.text;
                    if (msg.roleId) {
                        finalContent = `<@&${msg.roleId}>\n\n${finalContent}`;
                    }

                    // Si hay imagen, construimos el embed
                    let messageOptions: any = { content: finalContent };
                    if (msg.image) {
                        const embed = new EmbedBuilder()
                            .setDescription(finalContent)
                            .setImage(msg.image)
                            .setColor(0xED4245);

                        messageOptions = { content: msg.roleId ? `<@&${msg.roleId}>` : undefined, embeds: [embed] };
                    }

                    // Enviamos el mensaje al canal de Discord
                    await channel.send(messageOptions);

                    // Actualizamos el estado en MongoDB según si es repetitivo y quedan envíos
                    const remainingTimes = msg.remainingTimes !== undefined ? msg.remainingTimes : msg.totalRepetitions;
                    if (msg.repeats && remainingTimes > 1) {
                        const currentScheduled = new Date(msg.scheduledAt);
                        const addDays = (msg.repeatIntervalDays || msg.repeatDays || 0) * 24 * 60 * 60 * 1000;
                        const addHours = (msg.repeatIntervalHours || msg.repeatHours || 0) * 60 * 60 * 1000;
                        const nextDate = new Date(currentScheduled.getTime() + addDays + addHours);

                        await col.updateOne(
                            { _id: msg._id },
                            { 
                                $set: { scheduledAt: nextDate },
                                $inc: { remainingTimes: -1, repetitionsDone: 1 } 
                            }
                        );
                        console.log(`🔄 [Worker] Mensaje repetitivo reprogramado para: ${nextDate}. Quedan envíos.`);
                    } else {
                        // Marcamos como enviado definitivo si ya no se repite o se agotaron las repeticiones
                        await col.updateOne(
                            { _id: msg._id },
                            { $set: { status: 'sent', sentAt: new Date() } }
                        );
                        console.log(`✅ [Worker] Mensaje programado finalizado con éxito en el servidor ${guild.name}`);
                    }

                } catch (err) {
                    console.error(`❌ [Worker] Error enviando mensaje programado ID ${msg._id}:`, err);
                }
            }

        } catch (error) {
            console.error('❌ [Worker] Error general en el bucle de mensajes programados:', error);
        }
    }, 60000); // 60.000 ms = 1 minuto
}
