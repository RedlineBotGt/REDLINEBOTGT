import { Client, GatewayIntentBits } from 'discord.js';
import { handleInteraction } from './handlers/interactionRouter';

// 1. Inicialización limpia con los intents multiserver necesarios
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// 2. Evento de arranque (Sin código de limpieza, solo aviso de conexión)
client.once('ready', () => {
    console.log(`✅ REDLINE GT Bot conectado y operativo como ${client.user?.tag}`);
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
