import { Client, GatewayIntentBits, Collection, Interaction } from 'discord.js';
import { MongoClient, Collection as MongoCollection } from 'mongodb';
import { handleGlobalInteraction } from './generalinteraction';
import { setupNicknameSystem } from './dashadmin/nickname/nicknamemanager';
import { setupWelcomeSystem } from './dashadmin/welcome/welcomemanager'; // ➔ Sistema de bienvenidas y despedidas
import { setupAvisosSystem } from './dashadmin/avisos/avisosmanager'; // ➔ Sistema de avisos y logs
import { setupPollSystem, handleEncuestaReactionAdd } from './dashadmin/encuestas/encuestasmanager'; // ➔ Sistema de Encuestas
import express from 'express';

// 🌐 Configuración del servidor Express para satisfacer el requisito de puertos de Render (Plan Gratuito)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🚗 REDLINE GT Bot está en línea y funcionando perfectamente.');
});

app.listen(PORT, () => {
    console.log(`🌐 Servidor web HTTP activo en el puerto ${PORT}`);
});

// 📌 Importación de comandos Slash principales
import * as dashCommand from './commands/dash';
import * as dashStaffCommand from './commands/dashstaff';
import * as dadoCommand from './commands/dado';
import * as borrarCommand from './commands/borrar';
import * as msnCommand from './commands/msn'; // ➔ Comando msn
import * as draftCommand from './commands/draft'; // ➔ Comando draft
import * as listaCommand from './commands/lista'; // ➔ Comando Lista
import * as clubCommand from './commands/club'; // 👈 1. Importación del comando Club
import * as dashSheetsCommand from './dashsheet/dashsheet';
import * as dashAdminCommand from './dashadmin/dashadmin'; // ➔ Comando dashadmin

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

// Registro de comandos en la colección
const commandsList = [
    dashCommand, 
    dashStaffCommand, 
    dadoCommand, 
    borrarCommand, 
    msnCommand, 
    draftCommand,
    listaCommand,
    clubCommand, // 👈 2. Registrado en la colección de comandos
    dashSheetsCommand, 
    dashAdminCommand
];

for (const cmd of commandsList) {
    if ('data' in cmd && 'execute' in cmd) {
        client.commands.set((cmd.data as any).name, cmd);
    }
}

/**
 * 🚀 Evento de Arranque (Ready)
 */
client.once('ready', () => {
    console.log(`🤖 [REDLINE GT] Bot conectado exitosamente como ${client.user?.tag}`);

    // Inicializar el sistema de apodos automáticos
    setupNicknameSystem(client);

    // Inicializar el sistema de Bienvenidas y Despedidas
    setupWelcomeSystem(client);

    // Inicializar el sistema de Avisos y Logs
    setupAvisosSystem(client);

    // ➔ Inicializar el sistema de Encuestas (Worker de cierre automático)
    setupPollSystem(client);
});

/**
 * ⚡ Enrutador Maestro de Interacciones (Conectado a generalinteraction.ts)
 */
client.on('interactionCreate', async (interaction: Interaction) => {
    await handleGlobalInteraction(interaction, client);
});

/**
 * 🗳️ Listener de Reacciones para las Encuestas
 */
client.on('messageReactionAdd', async (reaction, user) => {
    await handleEncuestaReactionAdd(reaction, user);
});

// 🔐 Inicio de sesión del bot con el token de entorno
client.login(process.env.DISCORD_TOKEN);
