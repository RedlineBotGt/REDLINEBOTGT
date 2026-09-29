import http from 'http';
import { Client, GatewayIntentBits } from 'discord.js';
import { handleInteraction } from './handlers/interactionRouter';
import { startScheduledWorker } from './handlers/scheduledMessage'; // ⏰ NUEVO: Importamos el worker de mensajes

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
        GatewayIntentBits.GuildMembers
    ]
});

// 2. Evento de arranque (Arrancamos el worker de mensajes programados)
client.once('ready', () => {
    console.log(`✅ REDLINE GT Bot conectado y operativo como ${client.user?.tag}`);
    
    // ⏰ Activamos el bucle en segundo plano para enviar los mensajes a su hora
    startScheduledWorker(client);
});

// 3. Enrutador ciego: deriva cualquier interacción al sistema modular externo
client.on('interactionCreate', async (interaction) => {
    try {
        await handleInteraction(interaction);
    } catch (error) {
        console.error('❌ Error crítico en el enrutador de interacciones:', error);
    }
});

// 4. Conexión definitiva
client.login(process.env.DISCORD_TOKEN);
