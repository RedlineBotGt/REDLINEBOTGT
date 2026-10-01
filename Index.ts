import http from 'http';
import { Client, GatewayIntentBits } from 'discord.js';
import { handleInteraction } from './handlers/interactionRouter';
import { startScheduledWorker } from './handlers/scheduledMessage';
import { initReactionRoles, handleReactionAdd, handleReactionRemove } from './handlers/reactionRoles';
import { handleGuildMemberAdd } from './handlers/welcomeSystem'; // 👋 NUEVO: Importamos el manejador de entradas

// 0. Servidor HTTP auxiliar obligatorio para satisfacer el puerto de Render
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('REDLINE GT Bot is active and running!');
});

const PORT = process.env.PORT || 3000;
server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🌐 Servidor HTTP auxiliar escuchando en el puerto ${PORT}`);
});

// 1. Inicialización limpia con los intents multiserver necesarios
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers, // 🛡️ Imprescindible para detectar miembros nuevos
        GatewayIntentBits.GuildMessageReactions
    ]
});

// 2. Evento de arranque (Arrancamos workers y sincronizamos sistemas persistentes)
client.once('ready', async () => {
    console.log(`✅ REDLINE GT Bot conectado y operativo como ${client.user?.tag}`);
    
    // ⏰ Activamos el bucle en segundo plano de mensajes programados
    startScheduledWorker(client);
    
    // 🎭 Sincronizamos y recuperamos los mensajes de roles por reacción desde MongoDB
    await initReactionRoles(client);
});

// 3. Enrutador ciego: deriva cualquier interacción al sistema modular externo
client.on('interactionCreate', async (interaction) => {
    try {
        await handleInteraction(interaction);
    } catch (error) {
        console.error('❌ Error crítico en el enrutador de interacciones:', error);
    }
});

// 👋 4. NUEVO: Escucha global cuando un usuario entra al servidor (Sistema de Bienvenidas)
client.on('guildMemberAdd', async (member) => {
    try {
        await handleGuildMemberAdd(member);
    } catch (error) {
        console.error('❌ Error en guildMemberAdd (Bienvenidas):', error);
    }
});

// 🎭 5. Escuchas globales de Reacciones (Asignan y retiran roles de forma persistente)
client.on('messageReactionAdd', async (reaction, user) => {
    try {
        await handleReactionAdd(reaction, user);
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

// 6. Conexión definitiva
client.login(process.env.DISCORD_TOKEN);
