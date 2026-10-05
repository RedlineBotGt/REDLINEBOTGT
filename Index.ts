import http from 'http';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { handleInteraction } from './handlers/interactionRouter';
import { startScheduledWorker } from './handlers/scheduledMessage';
import { initReactionRoles, handleReactionAdd, handleReactionRemove } from './handlers/reactionRoles';
import { handleEncuestaReactionAdd } from './handlers/encuestaSystem'; // 📊 ¡Importante para capturar los votos de las encuestas!
import { setupWelcomeSystem } from './handlers/welcomeSystem'; 
import { setupEventWorker } from './handlers/eventSystem'; 
import { setupNicknameSystem } from './handlers/nicknameSystem'; 
import { setupAvisosSystem } from './handlers/avisosSystem'; 

// 0. Servidor HTTP auxiliar obligatorio para satisfacer el puerto de Render
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

// 4. Escuchas globales de Reacciones (Roles y Encuestas)
client.on('messageReactionAdd', async (reaction, user) => {
    try {
        await handleReactionAdd(reaction, user);
        await handleEncuestaReactionAdd(reaction, user); // 📊 ¡Aquí procesamos el voto de la encuesta y enviamos el log!
    } catch (error) {
        console.error('❌ Error en messageReactionAdd:', error);
    }
});

client.on('messageReactionRemove', async (reaction, user) => {
    try {
        await handleReactionRemove(reaction, user);
    } catch (error) {
        console.error('❌ Error en messageReactionRemove:', error);
    }
});

// 5. Conexión definitiva
client.login(process.env.DISCORD_TOKEN);
