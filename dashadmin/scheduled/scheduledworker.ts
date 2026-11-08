import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { MongoClient as MongoDriver } from 'mongodb';

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || process.env.MONGO_URL;
if (!uri) throw new Error('No se encontró una variable de entorno para MongoDB en el worker de mensajes programados.');

const clientMongo = new MongoDriver(uri);
let collection: any = null;
let workerStarted = false;
let cycleRunning = false;

async function getCollection() {
    if (!collection) {
        await clientMongo.connect();
        collection = clientMongo.db('redline_bot').collection('scheduled_messages');
        console.log('⏰ [Worker] Conexión MongoDB lista para mensajes programados.');
    }
    return collection;
}

function formatMadridDateTime(date: Date): { date: string; time: string } {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Madrid',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '';
    return {
        date: `${get('day')}/${get('month')}/${get('year')}`,
        time: `${get('hour')}:${get('minute')}`
    };
}

async function processDueMessages(client: Client): Promise<void> {
    if (cycleRunning) return;
    cycleRunning = true;

    try {
        const col = await getCollection();

        // Recupera trabajos cuyo proceso quedó interrumpido hace más de 10 minutos.
        // El estado processing evita que dos ciclos/instancias reclamen el mismo trabajo a la vez.
        await col.updateMany(
            { status: 'processing', processingAt: { $lte: new Date(Date.now() - 10 * 60 * 1000) } },
            { $set: { status: 'pending' }, $unset: { processingAt: '' } }
        );

        for (let i = 0; i < 25; i++) {
            const claimResult = await col.findOneAndUpdate(
                { status: 'pending', scheduledAt: { $lte: new Date() } },
                { $set: { status: 'processing', processingAt: new Date() } },
                { sort: { scheduledAt: 1 }, returnDocument: 'after' }
            );
            const msg: any = (claimResult as any)?.value ?? claimResult;
            if (!msg) break;

            try {
                const guild = await client.guilds.fetch(msg.guildId).catch(() => null);
                if (!guild) {
                    await col.updateOne({ _id: msg._id, status: 'processing' }, { $set: { status: 'guild_not_found' }, $unset: { processingAt: '' } });
                    continue;
                }

                const fetchedChannel = await guild.channels.fetch(msg.channelId).catch(() => null);
                if (!fetchedChannel || !fetchedChannel.isTextBased() || !('send' in fetchedChannel)) {
                    await col.updateOne({ _id: msg._id, status: 'processing' }, { $set: { status: 'channel_not_found' }, $unset: { processingAt: '' } });
                    continue;
                }

                const channel = fetchedChannel as TextChannel;
                const mention = msg.roleId ? `<@&${msg.roleId}>` : '';
                const text = String(msg.text || '');
                const content = [mention, text].filter(Boolean).join('\n\n');
                const options: any = { content: content || undefined, allowedMentions: { roles: msg.roleId ? [msg.roleId] : [] } };

                if (msg.image) {
                    const embed = new EmbedBuilder().setColor(0xED4245).setImage(msg.image);
                    if (text) embed.setDescription(text.slice(0, 4096));
                    options.content = mention || undefined;
                    options.embeds = [embed];
                }

                await channel.send(options);

                const remaining = Number(msg.remainingTimes ?? msg.totalRepetitions ?? 1);
                if (msg.repeats && remaining > 1) {
                    const days = Number(msg.repeatIntervalDays ?? msg.repeatDays ?? 0);
                    const hours = Number(msg.repeatIntervalHours ?? msg.repeatHours ?? 0);
                    const intervalMs = (days * 24 + hours) * 60 * 60 * 1000;
                    if (intervalMs <= 0) {
                        await col.updateOne({ _id: msg._id, status: 'processing' }, {
                            $set: { status: 'sent', sentAt: new Date(), lastError: 'Intervalo de repetición no válido.' },
                            $unset: { processingAt: '' }
                        });
                        continue;
                    }

                    const nextDate = new Date(new Date(msg.scheduledAt).getTime() + intervalMs);
                    const madrid = formatMadridDateTime(nextDate);
                    await col.updateOne({ _id: msg._id, status: 'processing' }, {
                        $set: { scheduledAt: nextDate, date: madrid.date, time: madrid.time, status: 'pending' },
                        $set: { remainingTimes: remaining - 1 },
                        $inc: { repetitionsDone: 1 },
                        $unset: { processingAt: '' }
                    });
                    console.log(`🔄 [Worker] Mensaje ${msg._id} enviado; siguiente envío: ${madrid.date} ${madrid.time} (Madrid).`);
                } else {
                    await col.updateOne({ _id: msg._id, status: 'processing' }, {
                        $set: { status: 'sent', sentAt: new Date() },
                        $unset: { processingAt: '' }
                    });
                    console.log(`✅ [Worker] Mensaje ${msg._id} enviado correctamente a ${guild.name}.`);
                }
            } catch (error) {
                console.error(`❌ [Worker] Error enviando el mensaje ${msg._id}:`, error);
                await col.updateOne({ _id: msg._id, status: 'processing' }, {
                    $set: { status: 'pending', lastError: error instanceof Error ? error.message : String(error) },
                    $unset: { processingAt: '' }
                }).catch(updateError => console.error('[Worker] No se pudo liberar el trabajo:', updateError));
            }
        }
    } catch (error) {
        console.error('❌ [Worker] Error general del ciclo:', error);
    } finally {
        cycleRunning = false;
    }
}

export function startScheduledWorker(client: Client): void {
    if (workerStarted) return;
    workerStarted = true;
    console.log('⏰ [Worker] Sistema de mensajes programados iniciado (intervalo de 60 segundos).');
    void processDueMessages(client);
    setInterval(() => { void processDueMessages(client); }, 60_000);
}
