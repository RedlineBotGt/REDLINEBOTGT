import { Client, GatewayIntentBits, Collection, Interaction } from 'discord.js';
import { MongoClient, Collection as MongoCollection } from 'mongodb';
import { handleGlobalInteraction } from './generalinteraction';
import { setupNicknameSystem } from './dashadmin/nickname/nicknamemanager';

// 📌 Importación de comandos Slash principales
import * as dashCommand from './commands/dash';
import * as dashStaffCommand from './commands/dashstaff';
import * as dadoCommand from './commands/dado';
import * as borrarCommand from './commands/borrar';
import * as dashSheetsCommand from './dashsheet/dashsheet'; // ➔ Corregido a 'dashsheet/dashsheet' (singular)
// (Añade aquí cualquier otro comando de barra individual que tengas en tu carpeta commands)

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
const commandsList = [dashCommand, dashStaffCommand, dadoCommand, borrarCommand, dashSheetsCommand];
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

    // Inicializar el sistema de apodos automáticos (evento guildMemberUpdate)
    setupNicknameSystem(client);
});

/**
 * ⚡ Enrutador Maestro de Interacciones (Conectado a generalinteraction.ts)
 */
client.on('interactionCreate', async (interaction: Interaction) => {
    await handleGlobalInteraction(interaction, client);
});

// 🔐 Inicio de sesión del bot con el token de entorno
client.login(process.env.DISCORD_TOKEN);
