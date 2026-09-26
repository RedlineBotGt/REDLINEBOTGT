import { Client, GatewayIntentBits } from 'discord.js';

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds] 
});

client.once('ready', async () => {
    console.log(`🧹 Conectado como ${client.user?.tag}. Limpiando comandos antiguos en Discord...`);

    try {
        // Borra absolutamente todos los comandos globales de la API de Discord
        await client.application?.commands.set([]);
        console.log('✅ ¡Limpieza completada! La API de Discord está completamente a cero.');
    } catch (error) {
        console.error('❌ Error durante la limpieza:', error);
    }
});

client.login(process.env.DISCORD_TOKEN);
