import { Client, TextChannel } from 'discord.js';
import { MongoClient, Collection as MongoCollection } from 'mongodb';

const LCS_GUILD_ID = '1564967606295732304';

/**
 * 📦 Estructura completa de la Alarma para MongoDB
 */
export interface AlarmaLCS {
    _id?: any;
    guildId: string;
    channelId: string;
    titulo: string;
    dia: string;
    hora: string; // Formato HH:mm
    texto: string;
    creadoPor: string;
    activa: boolean;
    esRecurrente?: boolean;
    horasIntervalo?: number;
    diasIntervalo?: number;
    totalAvisos?: number;
    avisosRestantes?: number;
    proximaEjecucion?: Date;
}

let cachedClient: MongoClient | null = null;
let alarmasCollection: MongoCollection<AlarmaLCS> | null = null;

export async function getAlarmasCollection(): Promise<MongoCollection<AlarmaLCS>> {
    if (alarmasCollection) return alarmasCollection;

    const uri = process.env.MONGODB_URI || 
                process.env.MONGO_URI || 
                process.env.DATABASE_URL || 
                process.env.MONGO_URL || 
                'mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true';

    try {
        if (!cachedClient) {
            cachedClient = new MongoClient(uri);
            await cachedClient.connect();
        }
        
        alarmasCollection = cachedClient.db().collection<AlarmaLCS>('lcs_alarmas');
        return alarmasCollection;
    } catch (error) {
        console.error('❌ Error al conectar a MongoDB en AlarmaWorker:', error);
        throw error;
    }
}

/**
 * ⏰ Worker que comprueba la hora cada minuto y gestiona repeticiones y contadores
 */
export function setupAlarmaWorker(client: Client) {
    console.log('⏰ [LCS AlarmaWorker] Sistema de alarmas de LCS activado.');

    setInterval(async () => {
        try {
            const ahoraFecha = new Date();
            // Obtener hora actual de Madrid/España (Formato 24h: HH:mm)
            const ahoraHoraStr = ahoraFecha.toLocaleTimeString('es-ES', {
                timeZone: 'Europe/Madrid',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });

            const collection = await getAlarmasCollection();
            
            // Buscar alarmas activas que coincidan con la hora actual
            const alarmasPendientes = await collection.find({ 
                guildId: LCS_GUILD_ID, 
                hora: ahoraHoraStr, 
                activa: true 
            }).toArray();

            for (const alarma of alarmasPendientes) {
                const guild = client.guilds.cache.get(alarma.guildId);
                if (!guild) continue;

                const channel = guild.channels.cache.get(alarma.channelId) as TextChannel;
                if (channel) {
                    // Enviar el mensaje añadiendo opcionalmente el título si lo deseas o solo el texto
                    await channel.send(alarma.texto);
                    console.log(`🔔 [LCS Alarma] "${alarma.titulo}" enviado al canal ${channel.name} a las ${ahoraHoraStr}`);
                }

                // 🔄 Lógica de Repetición y Contadores
                if (alarma.esRecurrente && alarma.avisosRestantes !== undefined && alarma.avisosRestantes > 1) {
                    const nuevosRestantes = alarma.avisosRestantes - 1;
                    
                    // Calcular próxima ejecución si tiene intervalos definidos
                    let nuevaHora = alarma.hora;
                    if (alarma.horasIntervalo || alarma.diasIntervalo) {
                        const proxima = new Date();
                        if (alarma.horasIntervalo) proxima.setHours(proxima.getHours() + alarma.horasIntervalo);
                        if (alarma.diasIntervalo) proxima.setDate(proxima.getDate() + alarma.diasIntervalo);
                        
                        nuevaHora = proxima.toLocaleTimeString('es-ES', {
                            timeZone: 'Europe/Madrid',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                        });
                    }

                    // Actualizar con el nuevo número de avisos restantes y nueva hora si aplica
                    await collection.updateOne(
                        { _id: alarma._id }, 
                        { $set: { avisosRestantes: nuevosRestantes, hora: nuevaHora } }
                    );
                } else {
                    // Si no es recurrente o ya no le quedan avisos, se desactiva
                    await collection.updateOne(
                        { _id: alarma._id }, 
                        { $set: { activa: false, avisosRestantes: 0 } }
                    );
                }
            }
        } catch (error) {
            console.error('❌ Error en ejecución de AlarmaWorker:', error);
        }
    }, 60000); // Se ejecuta cada 60 segundos
}
