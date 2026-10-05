import http from 'http';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { handleInteraction } from './handlers/interactionRouter';
import { startScheduledWorker } from './handlers/scheduledMessage';
import { initReactionRoles } from './handlers/reactionRoles';
import { setupWelcomeSystem } from './handlers/welcomeSystem'; 
import { setupEventWorker } from './handlers/eventSystem'; 
import { setupNicknameSystem } from './handlers/nicknameSystem'; 
import { setupAvisosSystem } from './handlers/avisosSystem'; 
import { handleReactionAddRouter, handleReactionRemoveRouter } from './handlers/reactionRouter'; 
import { startPollsWorker } from './handlers/encuestaSystem'; // 👈 Importamos el worker de encuestas

// 0. Servidor HTTP auxiliar obligatorio para Render
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('REDLINE GT Bot is active and running!');
});

const PORT = process.env.PORT || 3000;
server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🌐 Servidor HTTP auxiliar escuchando en el puerto ${PORT}`);
});

// 1. Inicialización limpia con intents y partials imprescindibles
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [
        Partials.Message, 
        Partials.Channel, 
        Partials.Reaction // 👈 Imprescindible para leer reacciones en mensajes ya publicados
    ]
});

// 2. Evento de arranque
client.once('ready', async () => {
    console.log(`✅ REDLINE GT Bot conectado y operativo como ${client.user?.tag}`);

    startScheduledWorker(client);
    startPollsWorker(client); // 👈 ¡Iniciamos el vigilante de cierre automático de encuestas!
    await initReactionRoles(client);
    setupWelcomeSystem(client);
    setupAvisosSystem(client);
    setupEventWorker(client);
    setupNicknameSystem(client);
});

// 3. Enrutador de interacciones
client.on('interactionCreate', async (interaction) => {
    try {
        await handleInteraction(interaction);
    } catch (error) {
        console.error('❌ Error crítico en el enrutador de interacciones:', error);
    }
});

// 4. Escuchas de Reacciones delegadas limpiamente al Router externo
client.on('messageReactionAdd', async (reaction, user) => {
    await handleReactionAddRouter(reaction, user);
});

client.on('messageReactionRemove', async (reaction, user) => {
    await handleReactionRemoveRouter(reaction, user);
});

// 5. Conexión definitiva
client.login(process.env.DISCORD_TOKEN);
