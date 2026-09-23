import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';

// Inicializar el cliente con los intents necesarios para tu servidor
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// Evento cuando el bot está listo y operativo
client.once('ready', async () => {
    console.log(`¡Bot conectado con éxito como ${client.user?.tag}!`);
    
    // Registro automático del comando /dash
    const commands = [
        new SlashCommandBuilder()
            .setName('dash')
            .setDescription('Abre el panel de control principal de administración y gestión')
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

    try {
        console.log('Registrando comandos de barra...');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID!),
            { body: commands },
        );
        console.log('Comandos de barra registrados correctamente.');
    } catch (error) {
        console.error('Error al registrar los comandos:', error);
    }
});

// Manejador básico para interacciones del comando /dash
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'dash') {
        await interaction.reply({
            content: '🚧 **REDLINE BOT GT** - Panel de control en construcción. ¡Próximamente operativo!',
            ephemeral: true
        });
    }
});

// Iniciar sesión con el token del bot
client.login(process.env.DISCORD_TOKEN);

