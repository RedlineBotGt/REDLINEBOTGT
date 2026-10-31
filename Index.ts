
import {
    Client,
    GatewayIntentBits,
    Collection,
    Interaction,
    Message
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
import { handleClubMessage } from './dashadmin/club/clubactions';
import { setupAlarmaWorker } from './LCS/alarma/alarmaworker';
import academiaRouter from './academia/router';

import express from 'express';
import path from 'path';

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
// =====================================================

const app = express();

const PORT = Number(process.env.PORT) || 10000;

// Permite recibir JSON en las peticiones POST de la Academia.
app.use(express.json({ limit: '1mb' }));

// Archivos públicos: index.html, styles.css y app.js.
app.use(
    express.static(
        path.join(__dirname, 'academia', 'public')
    )
);

// API de Academia Campos.
app.use(academiaRouter);

// Comprobación de salud para Render.
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        service: 'REDLINE Bot GT',
        academy: 'Academia Campos'
    });
});

app.listen(PORT, () => {
    console.log(
        `🌐 Servidor web HTTP activo en el puerto ${PORT}`
    );
    console.log('🎓 Academia Campos preparada.');
});

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
import * as clubCommand from './commands/club';
import * as clubclasCommand from './commands/clubclas';
import * as transCommand from './commands/trans';
import * as titularesCommand from './commands/titulares';
import * as reservasCommand from './commands/reservas';
import * as eloCommand from './commands/elo';
import * as dashSheetsCommand from './dashsheet/dashsheet';
import * as dashAdminCommand from './dashadmin/dashadmin';

// Comandos exclusivos de LCS.
import * as alarmaCommand from './LCS/alarma/alarma';
import * as menuCommand from './LCS/menu/menu';

// =====================================================
// CONEXIÓN CENTRALIZADA A MONGODB
// =====================================================

let cachedCollection: MongoCollection | null = null;

let mongoConnectionPromise:
    Promise<MongoCollection> | null = null;

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
    clubCommand,
    clubclasCommand,
    transCommand,
    titularesCommand,
    reservasCommand,
    eloCommand,
    dashSheetsCommand,
    dashAdminCommand,
    alarmaCommand,
    menuCommand
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

    setupNicknameSystem(client);
    setupWelcomeSystem(client);
    setupAvisosSystem(client);
    setupPollSystem(client);
    setupEventWorker(client);
    setupAlarmaWorker(client);
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
// MENSAJES DE GT CLUB
// =====================================================

client.on('messageCreate', async (message: Message) => {
    try {
        await handleClubMessage(message);
    } catch (error) {
        console.error(
            'Error procesando mensaje de GT Club:',
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
