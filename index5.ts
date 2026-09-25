import 'dotenv/config';
import express from 'express';

import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';

const app = express();
const PORT = process.env.PORT || 3000;

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

app.get('/health', (_req, res) => {
  res.status(200).send('REDLINE BOT GT OK');
});

app.listen(PORT, () => {
  console.log(`Health server activo en el puerto ${PORT}`);
});

const token = process.env.DISCORD_TOKEN;
const clientId = '1551200581190942862';

if (!token) {
  console.error('Falta la variable DISCORD_TOKEN');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('sugerencia')
    .setDescription(
      'Publica el panel para contactar con el equipo'
    ),

  new SlashCommandBuilder()
    .setName('msn')
    .setDescription(
      'Envía un mensaje personalizado a un canal'
    ),
].map(command => command.toJSON());

const suggestionButton = new ButtonBuilder()
  .setCustomId('redline_sugerencia')
  .setLabel('SUGERENCIA')
  .setEmoji('🟧')
  .setStyle(ButtonStyle.Secondary);

client.once('ready', async () => {
  console.log(
    `REDLINE BOT GT conectado como ${client.user?.tag}`
  );

  try {
    const rest = new REST({ version: '10' })
      .setToken(token);

    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );

    console.log(
      '✅ Comando /sugerencia registrado globalmente.'
    );
  } catch (error) {
    console.error(
      '❌ Error registrando comandos:',
      error
    );
  }
});
client.on('interactionCreate', async (interaction: Interaction) => {

  // =========================
  // COMANDO /SUGERENCIA
  // =========================

  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === 'sugerencia') {

      const embed = new EmbedBuilder()
        .setColor(0xF39C12)
        .setTitle('BUZÓN DE SUGERENCIAS')
        .setDescription(
          '¿Quieres hablar con el equipo de Dirección?\n' +
          'Pincha en el botón naranja y te atenderemos lo antes posible.\n' +
          '¡Gracias!\n\n' +
          'Do you want to talk to the team?\n' +
          'Click the orange button and we will assist you as soon as possible.\n' +
          'Thank you!'
        );

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(suggestionButton);

      await interaction.reply({
        embeds: [embed],
        components: [row],
      });

      console.log(
        `📨 Panel de sugerencias publicado en ${interaction.guild?.name}`
      );
    }

    return;
  }
      return;
  }

  // =========================
  // COMANDO /MSN
  // =========================

  if (interaction.commandName === 'msn') {

    await interaction.reply({
      content: '📝 Preparando el sistema de mensajes...',
      ephemeral: true,
    });

    console.log(
      `📨 /msn ejecutado por ${interaction.user.tag}`
    );

    return;
  }

  // =========================
  // BOTÓN SUGERENCIA
  // =========================

  if (interaction.isButton()) {

    if (interaction.customId !== 'redline_sugerencia') {
      return;
    }

    if (!interaction.guild) {
      await interaction.reply({
        content:
          '❌ Este botón solo puede utilizarse dentro de un servidor.',
        ephemeral: true,
      });

      return;
    }

    const guild = interaction.guild;
    const user = interaction.user;

    const direccionRole = guild.roles.cache.find(
      role => role.name === 'Dirección'
    );

    if (!direccionRole) {
      await interaction.reply({
        content:
          '❌ No encuentro el rol @Dirección en este servidor.',
        ephemeral: true,
      });

      return;
        }
        const existingChannel = guild.channels.cache.find(
      channel =>
        channel.type === ChannelType.GuildText &&
        channel.topic === `REDLINE_SUGERENCIA:${user.id}`
    );

    if (existingChannel) {
      await interaction.reply({
        content:
          `Ya tienes una sugerencia abierta: ${existingChannel}`,
        ephemeral: true,
      });

      return;
    }

    try {
      const channel = await guild.channels.create({
        name: `sugerencia-${user.username}`
          .toLowerCase()
          .replace(/[^a-z0-9-_]/g, '-'),

        type: ChannelType.GuildText,

        topic: `REDLINE_SUGERENCIA:${user.id}`,

        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
            ],
          },
          {
            id: direccionRole.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
            ],
          },
        ],
      });

      await channel.send(
        `Hola ${user}, de qué quieres hablar? El equipo de ${guild.name} te atenderá enseguida`
      );

      await interaction.reply({
        content: `✅ Canal creado: ${channel}`,
        ephemeral: true,
      });

      console.log(
        `📩 Canal de sugerencia creado: ${channel.name} para ${user.tag}`
      );

    } catch (error) {
      console.error(
        '❌ Error al crear el canal de sugerencia:',
        error
      );

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content:
            '❌ Ha ocurrido un error al crear tu canal de sugerencia.',
          ephemeral: true,
        });
      }
    }
  }
});

client.login(token);
