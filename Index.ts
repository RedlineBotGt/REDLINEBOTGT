
import {
    Client,
    GatewayIntentBits,
    Collection,
    Interaction,
    EmbedBuilder
} from 'discord.js';

import {
    MongoClient,
    Collection as MongoCollection
} from 'mongodb';

import { handleGlobalInteraction } from './generalinteraction';
import { setupNicknameSystem } from './dashadmin/nickname/nicknamemanager';
import { setupWelcomeSystem } from './dashadmin/welcome/welcomemanager';
import { setupAvisosSystem } from './dashadmin/avisos/avisosmanager';

import {
    setupPollSystem,
    handleEncuestaReactionAdd
} from './dashadmin/encuestas/encuestasmanager';

import { setupEventWorker } from './dashadmin/eventos/eventosworker';
import { startScheduledWorker } from './dashadmin/scheduled/scheduledworker';

import express from 'express';

// =====================================================
// REDES DE SEGURIDAD GLOBAL
// =====================================================

process.on('unhandledRejection', (reason, promise) => {
    console.error(
        '⚠️ [Anti-Crash] Promesa rechazada no capturada:',
        reason
    );
});

process.on('uncaughtException', (error) => {
    console.error(
        '💥 [Anti-Crash] Excepción no capturada:',
        error
    );
});

// =====================================================
// SERVIDOR WEB EXPRESS
// Solo comprobación de salud para Render.
// Academia ya no se sirve desde REDLINE.
// =====================================================

const app = express();

const PORT = Number(process.env.PORT) || 10000;

// Ruta principal para comprobar que REDLINE está activo.
app.get('/', (req, res) => {
    res.status(200).send('REDLINE Bot GT activo');
});

// Ruta de comprobación de salud.
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        service: 'REDLINE Bot GT'
    });
});

const server = app.listen(PORT, () => {
    console.log(
        `🌐 Servidor de salud HTTP activo en el puerto ${PORT}`
    );
});

server.on('error', (error) => {
    console.error(
        '❌ Error en el servidor HTTP:',
        error
    );
});

// =====================================================
// DESPERTADOR DE WEBLINEGT (HTTP, SIN DISCORD)
// =====================================================

const WEBLINE_HEALTH_URL =
    process.env.WEBLINE_HEALTH_URL ||
    'https://weblinegt.onrender.com/health';

const WEBLINE_CHECK_INTERVAL_MS = 10 * 60 * 1000;
const WEBLINE_REQUEST_TIMEOUT_MS = 60 * 1000;
const WEBLINE_RETRY_DELAY_MS = 15 * 1000;

let weblineCheckInProgress = false;

async function checkWeblineStatus(): Promise<void> {
    if (weblineCheckInProgress) return;

    weblineCheckInProgress = true;

    try {
        for (let attempt = 1; attempt <= 2; attempt++) {
            const controller = new AbortController();
            const timeout = setTimeout(
                () => controller.abort(),
                WEBLINE_REQUEST_TIMEOUT_MS
            );

            try {
                const response = await fetch(WEBLINE_HEALTH_URL, {
                    method: 'GET',
                    headers: { Accept: 'text/plain' },
                    signal: controller.signal
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const statusText = (await response.text()).trim();

                console.log(
                    `🟢 [WEBLINEGT] Comprobación correcta: ${statusText || 'activa'}.`
                );
                return;
            } catch (error) {
                console.warn(
                    `⚠️ [WEBLINEGT] Falló la comprobación ${attempt}/2:`,
                    error instanceof Error ? error.message : error
                );

                if (attempt === 1) {
                    await new Promise(resolve =>
                        setTimeout(resolve, WEBLINE_RETRY_DELAY_MS)
                    );
                }
            } finally {
                clearTimeout(timeout);
            }
        }

        console.error(
            '❌ [WEBLINEGT] No respondió tras dos intentos. Se volverá a comprobar en el siguiente ciclo.'
        );
    } finally {
        weblineCheckInProgress = false;
    }
}

// Primera petición al arrancar y después una comprobación cada 10 minutos.
void checkWeblineStatus();
setInterval(() => {
    void checkWeblineStatus();
}, WEBLINE_CHECK_INTERVAL_MS);

// =====================================================
// COMANDOS SLASH
// =====================================================

import * as dashCommand from './commands/dash';
import * as dashStaffCommand from './commands/dashstaff';
import * as dadoCommand from './commands/dado';
import * as borrarCommand from './commands/borrar';
import * as msnCommand from './commands/msn';
import * as draftCommand from './commands/draft';
import * as listaCommand from './commands/lista';
import * as transCommand from './commands/trans';
import * as titularesCommand from './commands/titulares';
import * as reservasCommand from './commands/reservas';
import * as eloCommand from './commands/elo';
import * as dashSheetsCommand from './dashsheet/dashsheet';
import * as dashAdminCommand from './dashadmin/dashadmin';

// =====================================================
// CONEXIÓN CENTRALIZADA A MONGODB
// =====================================================

let cachedCollection: MongoCollection | null = null;

let mongoConnectionPromise: Promise<MongoCollection> | null = null;

export async function getEventsCollection(): Promise<MongoCollection> {
    if (cachedCollection) {
        return cachedCollection;
    }

    if (mongoConnectionPromise) {
        return mongoConnectionPromise;
    }

    mongoConnectionPromise = (async () => {
        const uri =
            process.env.MONGODB_URI ||
            process.env.MONGO_URI ||
            process.env.DATABASE_URL ||
            process.env.MONGO_URL;

        if (!uri) {
            throw new Error(
                'No se encontró ninguna variable de entorno para MongoDB.'
            );
        }

        const mongoClient = new MongoClient(uri, {
            serverSelectionTimeoutMS: 10000
        });

        await mongoClient.connect();

        cachedCollection = mongoClient
            .db()
            .collection('events');

        console.log('✅ Conexión con MongoDB establecida.');

        return cachedCollection;
    })();

    try {
        return await mongoConnectionPromise;
    } catch (error) {
        mongoConnectionPromise = null;
        cachedCollection = null;
        throw error;
    }
}

// =====================================================
// CLIENTE DISCORD
// =====================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
}) as Client & {
    commands: Collection<string, any>;
};

// =====================================================
// REGISTRO DE COMANDOS
// =====================================================

client.commands = new Collection();

const commandsList = [
    dashCommand,
    dashStaffCommand,
    dadoCommand,
    borrarCommand,
    msnCommand,
    draftCommand,
    listaCommand,
    transCommand,
    titularesCommand,
    reservasCommand,
    eloCommand,
    dashSheetsCommand,
    dashAdminCommand
];

for (const cmd of commandsList) {
    if ('data' in cmd && 'execute' in cmd) {
        client.commands.set(
            (cmd.data as any).name,
            cmd
        );
    }
}

// =====================================================
// DIAGNÓSTICO DEL WEBSOCKET
// =====================================================

client.on('debug', (info) => {
    console.log(`[Discord Debug] ${info}`);
});

client.on('shardDisconnect', (event, id) => {
    console.warn(
        `[Gateway] Shard ${id} desconectado.`
    );
});

client.on('shardError', (error, shardId) => {
    console.error(
        `[Gateway] Error en Shard ${shardId}:`,
        error
    );
});

// =====================================================
// ARRANQUE DE SISTEMAS AL CONECTAR DISCORD
// =====================================================

client.once('ready', () => {
    console.log(
        `🤖 [DISCORDBOT] Bot conectado como ${client.user?.tag}`
    );

    // Actualización puntual del pie del panel de reportes ya publicado.
    // Se conserva el contenido y los botones originales del mensaje.
    void (async () => {
        try {
            const channel = await client.channels.fetch('1463095951492386888');
            if (!channel || !channel.isTextBased() || !('messages' in channel)) {
                console.warn('⚠️ [Reportes] No se pudo acceder al canal del panel antiguo.');
                return;
            }

            const message = await channel.messages.fetch('1555166534576382016');
            const embeds = message.embeds.map(embed => {
                const footerText = embed.footer?.text?.trim().toLowerCase();
                if (footerText !== 'discord bot' && footerText !== 'discordbot') {
                    return EmbedBuilder.from(embed);
                }

                const updated = EmbedBuilder.from(embed);
                updated.setFooter({
                    text: 'REDLINE BOT GT',
                    ...(embed.footer?.iconURL ? { iconURL: embed.footer.iconURL } : {})
                });
                return updated;
            });

            if (embeds.every((embed, index) =>
                JSON.stringify(embed.toJSON()) === JSON.stringify(message.embeds[index].toJSON())
            )) {
                console.log('ℹ️ [Reportes] El panel existente no tiene un pie Discord bot que actualizar.');
                return;
            }

            await message.edit({ embeds });
            console.log('✅ [Reportes] Pie del panel existente actualizado a REDLINE BOT GT; botones conservados.');
        } catch (error) {
            console.error('❌ [Reportes] No se pudo actualizar el pie del panel existente:', error);
        }
    })();

    setupNicknameSystem(client);
    setupWelcomeSystem(client);
    setupAvisosSystem(client);
    setupPollSystem(client);
    setupEventWorker(client);
    startScheduledWorker(client);
});

// =====================================================
// ENRUTADOR MAESTRO DE INTERACCIONES
// =====================================================

client.on(
    'interactionCreate',
    async (interaction: Interaction) => {
        const user = interaction.user.tag;

        const type = interaction.isChatInputCommand()
            ? `Slash Command: /${interaction.commandName}`
            : interaction.isButton()
                ? `Botón: ${interaction.customId}`
                : interaction.isStringSelectMenu()
                    ? `Menú desplegable: ${interaction.customId}`
                    : 'Otra interacción';

        console.log(
            `[Interacción recibida] Usuario: ${user} | Tipo: ${type}`
        );

        try {
            await handleGlobalInteraction(
                interaction,
                client
            );
        } catch (error) {
            console.error(
                'Error dentro de handleGlobalInteraction:',
                error
            );
        }
    }
);

// =====================================================
// REACCIONES DE ENCUESTAS
// =====================================================

client.on('messageReactionAdd', async (reaction, user) => {
    try {
        await handleEncuestaReactionAdd(reaction, user);
    } catch (error) {
        console.error(
            'Error procesando reacción de encuesta:',
            error
        );
    }
});

// =====================================================
// INICIO DE SESIÓN DE DISCORD
// =====================================================

console.log(
    '🔄 [Discord] Intentando conectar el cliente...'
);

if (!process.env.DISCORD_TOKEN) {
    console.error(
        '❌ No se ha encontrado la variable DISCORD_TOKEN.'
    );
} else {
    client.login(process.env.DISCORD_TOKEN)
        .then(() => {
            console.log(
                '✅ [Discord] Inicio de sesión completado.'
            );
        })
        .catch((error) => {
            console.error(
                '❌ Error al iniciar sesión en Discord:',
                error
            );
        });
}
