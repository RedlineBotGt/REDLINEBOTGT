import http from 'http';
import { Client, GatewayIntentBits } from 'discord.js';
import { handleInteraction } from './handlers/interactionRouter';
import { startScheduledWorker } from './handlers/scheduledMessage';
import { initReactionRoles, handleReactionAdd, handleReactionRemove } from './handlers/reactionRoles';
import { setupWelcomeSystem } from './handlers/welcomeSystem'; // 👋 Importamos la función general de bienvenidas/despedidas
import { setupEventWorker } from './handlers/eventSystem'; // 📅 Importamos el worker del organizador de eventos
import { setupNicknameSystem } from './handlers/nicknameSystem'; // 🏷️ Importamos el sistema de apodos jerárquicos por rol

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
        GatewayIntentBits.GuildMembers, // 🛡 Imprescindible para detectar miembros nuevos, salidas y cambios de roles
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

    // 👋 Activamos el sistema completo de bienvenidas y despedidas
    setupWelcomeSystem(client);

    // 📅 Activamos el worker de eventos, recordatorios y gestión de roles temporales
    setupEventWorker(client);

    // 🏷️ Activamos el sistema de apodos automáticos según jerarquía de roles
    setupNicknameSystem(client);
});

// 3. Enrutador ciego: deriva cualquier interacción al sistema modular externo
client.on('interactionCreate', async (interaction) => {
    try {
        await handleInteraction(interaction);
    } catch (error) {
        console.error('❌ Error crítico en el enrutador de interacciones:', error);
    }
});

// 🎭 4. Escuchas globales de Reacciones (Asignan y retiran roles de forma persistente)
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

// 5. Conexión definitiva
client.login(process.env.DISCORD_TOKEN);
