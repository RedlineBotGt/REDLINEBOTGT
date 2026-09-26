import { Client, GatewayIntentBits } from 'discord.js';

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds] 
});

client.once('ready', async () => {
    console.log(`🧹 Conectado como ${client.user?.tag}. Iniciando limpieza profunda...`);

    try {
        // 1. Borrar comandos globales
        await client.application?.commands.set([]);
        console.log('✅ Comandos globales eliminados.');

        // 2. Borrar comandos específicos de cada servidor (Guild commands)
        const guilds = await client.guilds.fetch();
        for (const [guildId] of guilds) {
            const guild = await client.guilds.fetch(guildId);
            await guild.commands.set([]);
            console.log(`✅ Comandos locales eliminados en el servidor: ${guild.name}`);
        }

        console.log('🎉 ¡Limpieza total completada! Ya no queda rastro de nada.');
    } catch (error) {
        console.error('❌ Error durante la limpieza profunda:', error);
    }
});

client.login(process.env.DISCORD_TOKEN);
