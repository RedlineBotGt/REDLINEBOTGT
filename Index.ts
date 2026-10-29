import { Client, GatewayIntentBits, Collection, Interaction, Message } from 'discord.js';
import { MongoClient, Collection as MongoCollection } from 'mongodb';
import { handleGlobalInteraction } from './generalinteraction';
import { setupNicknameSystem } from './dashadmin/nickname/nicknamemanager';
import { setupWelcomeSystem } from './dashadmin/welcome/welcomemanager'; // ➔ Sistema de bienvenidas y despedidas
import { setupAvisosSystem } from './dashadmin/avisos/avisosmanager'; // ➔ Sistema de avisos y logs
import { setupPollSystem, handleEncuestaReactionAdd } from './dashadmin/encuestas/encuestasmanager'; // ➔ Sistema de Encuestas
import { setupEventWorker } from './dashadmin/eventos/eventosworker'; // ➔ Worker de Eventos y Campeonatos
import { handleClubMessage } from './dashadmin/club/clubactions'; // ➔ Importación del escuchador de mensajes GT Club
import { setupAlarmaWorker } from './LCS/alarma/alarmaworker'; // ➔ Worker de Alarma para LCS
import { academiaRouter } from './academia/router'; // 👈 🎓 Importamos el enrutador independiente de la Academia
import express from 'express';

// 🛡️ REDES DE SEGURIDAD GLOBAL: Evitan que el proceso muera silenciosamente por excepciones de red o promesas rechazadas
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ [Anti-Crash] Promesa rechazada no capturada:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('💥 [Anti-Crash] Excepción no capturada:', error);
});

// 🌐 Configuración del servidor Express para servir la Academia y satisfacer a Render
const app = express();
const PORT = process.env.PORT || 3000;

// 🎓 Enganchamos la Academia Familiar en la raíz del servidor web
app.use('/', academiaRouter);

app.listen(PORT, () => {
    console.log(`🌐 Servidor web HTTP activo en el puerto ${PORT} (Academia Campos activa)`);
});

// 📌 Importación de comandos Slash principales
import * as dashCommand from './commands/dash';
import * as dashStaffCommand from './commands/dashstaff';
import * as dadoCommand from './commands/dado';
import * as borrarCommand from './commands/borrar';
import * as msnCommand from './commands/msn'; // ➔ Comando msn
import * as draftCommand from './commands/draft'; // ➔ Comando draft
import * as listaCommand from './commands/lista'; // ➔ Comando Lista
import * as clubCommand from './commands/club'; // ➔ Comando Club
import * as clubclasCommand from './commands/clubclas'; // ➔ Comando Club Clasificación General
import * as transCommand from './commands/trans'; // ➔ Comando Traducción
import * as titularesCommand from './commands/titulares'; // 👈 Comando titulares
import * as reservasCommand from './commands/reservas'; // 👈 Comando reservas
import * as eloCommand from './commands/elo'; // 👈 Comando elo añadido
import * as dashSheetsCommand from './dashsheet/dashsheet';
import * as dashAdminCommand from './dashadmin/dashadmin'; // ➔ Comando dashadmin

// ➔ Importación de comandos exclusivos de LCS
import * as alarmaCommand from './LCS/alarma/alarma';
import * as menuCommand from './LCS/menu/menu'; // 👈 🎛️ Importamos el comando /menu de LCS

/**
 * 📦 Conexión centralizada y segura a la colección de eventos de MongoDB
 */
let cachedCollection: MongoCollection | null = null;

export async function getEventsCollection(): Promise<MongoCollection> {
    if (cachedCollection) return cachedCollection;

    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || process.env.MONGO_URL;

    if (!uri) {
        throw new Error('❌ No se encontró ninguna variable de entorno para MongoDB (revisa Render).');
    }

    const mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    cachedCollection = mongoClient.db().collection('events');
    return cachedCollection;
}

// 🤖 Inicialización del Cliente de Discord con los Intents necesarios
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
}) as Client & { commands: Collection<string, any> };

// 🗂️ Inicializar la colección de comandos en el cliente
client.commands = new Collection();

// Registro de comandos en la colección (incluyendo los de LCS)
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
    menuCommand // 👈 🎛️ Comando /menu añadido a la colección del cliente
];

for (const cmd of commandsList) {
    if ('data' in cmd && 'execute' in cmd) {
        client.commands.set((cmd.data as any).name, cmd);
    }
}

// 🐛 Diagnóstico en tiempo real del WebSocket de Discord
client.on('debug', (info) => {
    console.log(`🐛 [Discord Debug] ${info}`);
});

// 🔄 Detectar cortes de conexión con Discord para autoreconectarse
client.on('shardDisconnect', (event, id) => {
    console.warn(`⚠️ [Gateway] Shard ${id} desconectado. Intentando reconectar automáticamente...`);
});

client.on('shardError', (error, shardId) => {
    console.error(`❌ [Gateway] Error crítico en Shard ${shardId}:`, error);
});

/**
 * 🚀 Evento de Arranque (Ready)
 */
client.once('ready', () => {
    console.log(`🤖 [DISCORDBOT] Bot conectado exitosamente como ${client.user?.tag}`);

    // Inicializar el sistema de apodos automáticos
    setupNicknameSystem(client);

    // Inicializar el sistema de Bienvenidas y Despedidas
    setupWelcomeSystem(client);

    // Inicializar el sistema de Avisos y Logs
    setupAvisosSystem(client);

    // ➔ Inicializar el sistema de Encuestas (Worker de cierre automático)
    setupPollSystem(client);

    // ➔ Inicializar el worker de Eventos y Campeonatos (Avisos 30 min e inicio/limpieza de roles)
    setupEventWorker(client);

    // ⏰ ➔ Inicializar el worker de Alarmas para LCS
    setupAlarmaWorker(client);
});

/**
 * ⚡ Enrutador Maestro de Interacciones (Con depuración de llegada)
 */
client.on('interactionCreate', async (interaction: Interaction) => {
    const user = interaction.user.tag;
    const type = interaction.isChatInputCommand() 
        ? `Slash Command: /${interaction.commandName}` 
        : interaction.isButton() 
            ? `Botón: ${interaction.customId}` 
            : interaction.isStringSelectMenu() 
                ? `Menú desplegable: ${interaction.customId}` 
                : 'Otra interacción';

    console.log(`📥 [Interacción recibida] Usuario: ${user} | Tipo: ${type}`);

    try {
        await handleGlobalInteraction(interaction, client);
    } catch (error) {
        console.error('❌ Error no capturado dentro de handleGlobalInteraction:', error);
    }
});

/**
 * 🗳️ Listener de Reacciones para las Encuestas
 */
client.on('messageReactionAdd', async (reaction, user) => {
    await handleEncuestaReactionAdd(reaction, user);
});

/**
 * 🏎️ Listener de Mensajes para GT Club
 */
client.on('messageCreate', async (message: Message) => {
    await handleClubMessage(message);
});

// 🔐 Inicio de sesión del bot sin cortes estrictos
console.log('🔄 [Discord] Intentando conectar el cliente con el token (esperando respuesta del Gateway)');

client.login(process.env.DISCORD_TOKEN)
    .then(() => {
        console.log('✅ [Discord] client.login() se ha completado y conectado correctamente.');
    })
    .catch((err) => {
        console.error('❌ [Discord] Error al iniciar sesión:', err);
    });
