import { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChannelType, 
  PermissionsBitField 
} from 'discord.js';
import http from 'http';

// Servidor web para mantener vivo el bot en Render
const PORT = process.env.PORT || 3000;
http.createServer((_, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('Bot REDLINE GT Online');
  res.end();
}).listen(PORT, () => {
  console.log(`Servidor web activo en puerto ${PORT}`);
});

// Cliente de Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', async () => {
  console.log(`¡Bot conectado exitosamente como ${client.user?.tag}!`);

  // Limpieza de comandos viejos de BotGhost
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || '');
    if (client.user) {
      await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
    }
  } catch (error) {
    console.error('Error al borrar comandos viejos:', error);
  }
});

// Listener de mensajes
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Comando para publicar el panel de sugerencias
  if (message.content === '!setup-buzon') {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('crear_sugerencia')
        .setLabel('SUGERENCIA')
        .setStyle(ButtonStyle.Danger) // Botón Rojo
    );

    const mensajeTexto = 
      "¿Quieres hablar con el equipo de REDLINE GT?\n" +
      "Pincha en el botón rojo y te atenderemos lo antes posible.\n" +
      "¡Gracias!\n\n" +
      "Do you want to talk to the REDLINE GT team?\n" +
      "Click the red button and we will assist you as soon as possible.\n" +
      "Thank you!";

    await message.channel.send({
      content: mensajeTexto,
      components: [row]
    });

    if (message.deletable) await message.delete();
  }
});

// Listener para el click del botón
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'crear_sugerencia') {
    const guild = interaction.guild;
    const user = interaction.user;

    if (!guild) return;

    // ID de la categoría especificada
    const ID_CATEGORIA = '1470046414607225018';

    await interaction.reply({ 
      content: 'Creando tu canal privado de sugerencia...', 
      ephemeral: true 
    });

    try {
      // Crear el canal privado para la sugerencia
      const canalTicket = await guild.channels.create({
        name: `sugerencia-${user.username}`,
        type: ChannelType.GuildText,
        parent: ID_CATEGORIA,
        permissionOverwrites: [
          {
            id: guild.id, // @everyone no puede ver el canal
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: user.id, // El usuario que pulsa sí lo ve e interactúa
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory
            ],
          },
        ],
      });

      // Mensaje de bienvenida con mención al usuario por ID
      const mensajeBienvenida = 
        `Hola <@${user.id}>, cuéntanos, enseguida estamos contigo.\n\n` +
        `Hello <@${user.id}>, tell us, we will be with you shortly.`;

      await canalTicket.send(mensajeBienvenida);

    } catch (error) {
      console.error('Error al crear el canal privado:', error);
    }
  }
});

// Inicio de sesión
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('ERROR: No se ha encontrado la variable DISCORD_TOKEN');
} else {
  client.login(token);
}
