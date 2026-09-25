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
  StringSelectMenuBuilder,
  ModalBuilder,
TextInputBuilder,
TextInputStyle,
} from 'discord.js';

const app = express();
const PORT = process.env.PORT || 3000;
// Memoria temporal de los procesos /msn
const msnSessions = new Map();

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

    // =========================
    // COMANDO /MSN
    // =========================

    if (interaction.commandName === 'msn') {

      const channels = interaction.guild?.channels.cache
  .filter(
    channel =>
      (
        channel.type === ChannelType.GuildText ||
        channel.type === ChannelType.GuildAnnouncement
      ) &&
      channel.viewable
  )
  .sort((a, b) => a.position - b.position)
  .map(channel => channel);

const channelOptions = channels
  .slice(0, 25)
  .map(channel => ({
    label: channel.name,
    value: channel.id,
  }));

const channelMenu = new StringSelectMenuBuilder()
  .setCustomId('redline_msn_channel:0')
  .setPlaceholder('Selecciona el canal de destino')
  .addOptions(channelOptions);

const row = new ActionRowBuilder<StringSelectMenuBuilder>()
  .addComponents(channelMenu);
const navigationRow = new ActionRowBuilder<ButtonBuilder>()
  .addComponents(
    new ButtonBuilder()
      .setCustomId('redline_msn_channels_prev:0')
      .setLabel('◀️ Anterior')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),

    new ButtonBuilder()
      .setCustomId('redline_msn_channels_next:0')
      .setLabel('Siguiente ▶️')
      .setStyle(ButtonStyle.Secondary)
  );      

await interaction.reply({
  content: '📨 **/MSN**\n\nSelecciona el canal donde quieres publicar el mensaje:',
  components: [row, navigationRow],
  ephemeral: true,
});

      console.log(
        `📨 /msn ejecutado por ${interaction.user.tag}`
      );

      return;
    }

    return;
  }
  
  // =========================
  // MODAL DE MENSAJE /MSN
  // =========================

  if (
    interaction.isModalSubmit() &&
    interaction.customId.startsWith('redline_msn_message:')
  ) {

    const selectedChannelId =
      interaction.customId.split(':')[1];

    const messageText =
  interaction.fields.getTextInputValue('redline_msn_text');

const imageUrl =
  interaction.fields.getTextInputValue('redline_msn_image').trim();

msnSessions.set(interaction.user.id, {
  channelId: selectedChannelId,
  messageText: messageText,
  imageUrl: imageUrl,
});
    const repeatYesButton = new ButtonBuilder()
      .setCustomId(
        `redline_msn_repeat_yes:${selectedChannelId}`
      )
      .setLabel('SÍ')
      .setStyle(ButtonStyle.Success);

    const repeatNoButton = new ButtonBuilder()
      .setCustomId(
        `redline_msn_repeat_no:${selectedChannelId}`
      )
      .setLabel('NO')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        repeatYesButton,
        repeatNoButton
      );

await interaction.reply({
  content:
    '📨 **Mensaje preparado**\n\n' +
    (imageUrl
      ? '🖼️ Se ha añadido un enlace de imagen/archivo.\n\n'
      : '🖼️ Sin imagen/archivo.\n\n') +
    '¿Quieres repetir este mensaje?',
      components: [row],
      ephemeral: true,
    });

    console.log(
      `📨 Mensaje preparado para /msn por ${interaction.user.tag}`
    );

    return;
  }

  // =========================
  // BOTÓN NO - REPETIR /MSN
  // =========================

  if (
    interaction.isButton() &&
    interaction.customId.startsWith('redline_msn_repeat_no:')
  ) {

    const session = msnSessions.get(interaction.user.id);

    if (!session) {
      await interaction.reply({
        content: '❌ No encuentro el mensaje que estabas preparando.',
        ephemeral: true,
      });

      return;
    }

    msnSessions.set(interaction.user.id, {
  ...session,
  repetitions: 1,
  days: 0,
  hours: 0,
  intervalHours: 0,
});

const sendButton = new ButtonBuilder()
  .setCustomId('redline_msn_send')
  .setLabel('ENVIAR')
  .setEmoji('🟢')
  .setStyle(ButtonStyle.Success);

const editButton = new ButtonBuilder()
  .setCustomId('redline_msn_edit')
  .setLabel('EDITAR')
  .setEmoji('⚪')
  .setStyle(ButtonStyle.Secondary);

const cancelButton = new ButtonBuilder()
  .setCustomId('redline_msn_cancel')
  .setLabel('CANCELAR')
  .setEmoji('🔴')
  .setStyle(ButtonStyle.Danger);

const previewRow = new ActionRowBuilder<ButtonBuilder>()
  .addComponents(
    sendButton,
    editButton,
    cancelButton
  );

await interaction.update({
  content:
    `📨 **VISTA PREVIA DEL MENSAJE**\n\n` +
    `${session.messageText}\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `📅 Sin repetición\n` +
    `🔢 Envíos totales: **1**\n` +
    `📺 Canal: <#${session.channelId}>`,
  components: [previewRow],
});

    return;
  }
  // =========================
  // BOTÓN SÍ - REPETIR /MSN
  // =========================

  if (
    interaction.isButton() &&
    interaction.customId.startsWith('redline_msn_repeat_yes:')
  ) {

    const session = msnSessions.get(interaction.user.id);

    if (!session) {
      await interaction.reply({
        content: '❌ No encuentro el mensaje que estabas preparando.',
        ephemeral: true,
      });

      return;
    }

    const modal = new ModalBuilder()
  .setCustomId('redline_msn_interval')
  .setTitle('Repetir mensaje');

const daysInput = new TextInputBuilder()
  .setCustomId('redline_msn_days')
  .setLabel('¿Cada cuántos días?')
  .setPlaceholder('Ejemplo: 1')
  .setStyle(TextInputStyle.Short)
  .setRequired(false)
  .setMaxLength(3);

const hoursInput = new TextInputBuilder()
  .setCustomId('redline_msn_hours')
  .setLabel('¿Y cuántas horas?')
  .setPlaceholder('Ejemplo: 6')
  .setStyle(TextInputStyle.Short)
  .setRequired(false)
  .setMaxLength(2);

const daysRow = new ActionRowBuilder<TextInputBuilder>()
  .addComponents(daysInput);

const hoursRow = new ActionRowBuilder<TextInputBuilder>()
  .addComponents(hoursInput);

modal.addComponents(
  daysRow,
  hoursRow
);

    await interaction.showModal(modal);

    return;
      }

// =========================
// MODAL INTERVALO /MSN
// =========================

if (
  interaction.isModalSubmit() &&
  interaction.customId === 'redline_msn_interval'
) {

  console.log(
    '🟢 INTERVALO RECIBIDO:',
    interaction.customId
  );

  const session = msnSessions.get(interaction.user.id);

  if (!session) {
    await interaction.reply({
      content:
        '❌ No encuentro el mensaje que estabas preparando.',
      ephemeral: true,
    });

    return;
  }

  const daysText =
    interaction.fields
      .getTextInputValue('redline_msn_days')
      .trim();

  const hoursText =
    interaction.fields
      .getTextInputValue('redline_msn_hours')
      .trim();

  const days =
    daysText === '' ? 0 : Number(daysText);

  const hours =
    hoursText === '' ? 0 : Number(hoursText);

  if (
    !Number.isInteger(days) ||
    !Number.isInteger(hours) ||
    days < 0 ||
    hours < 0
  ) {
    await interaction.reply({
      content:
        '❌ Introduce únicamente números válidos en días y horas.',
      ephemeral: true,
    });

    return;
  }

  if (days === 0 && hours === 0) {
    await interaction.reply({
      content:
        '❌ Debes indicar al menos días u horas.',
      ephemeral: true,
    });

    return;
  }

  const intervalHours =
    (days * 24) + hours;

  msnSessions.set(interaction.user.id, {
    ...session,
    days: days,
    hours: hours,
    intervalHours: intervalHours,
  });

  const repetitionsButton =
    new ButtonBuilder()
      .setCustomId('redline_msn_repetitions_button')
      .setLabel('INDICAR NÚMERO DE ENVÍOS')
      .setEmoji('🔢')
      .setStyle(ButtonStyle.Primary);

  const row =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(repetitionsButton);

  await interaction.reply({
    content:
      `📨 **Intervalo configurado**\n\n` +
      `📅 Cada **${days} días y ${hours} horas**\n\n` +
      `Ahora indica cuántas veces quieres enviar el mensaje:`,
    components: [row],
    ephemeral: true,
  });

  return;
  }

  // =========================
  // MODAL NÚMERO DE ENVÍOS /MSN
  // =========================

  if (
    interaction.isModalSubmit() &&
    interaction.customId === 'redline_msn_repetitions'
  ) {

    const session = msnSessions.get(interaction.user.id);

    if (!session) {
      await interaction.reply({
        content:
          '❌ No encuentro el mensaje que estabas preparando.',
        ephemeral: true,
      });

      return;
    }

    const repetitionsText =
      interaction.fields
        .getTextInputValue('redline_msn_repetitions_value')
        .trim();

    const repetitions = Number(repetitionsText);

    if (
      !Number.isInteger(repetitions) ||
      repetitions < 1
    ) {
      await interaction.reply({
        content:
          '❌ Introduce un número válido de envíos, mínimo 1.',
        ephemeral: true,
      });

      return;
    }

    msnSessions.set(interaction.user.id, {
      ...session,
      repetitions: repetitions,
    });

    const sendButton = new ButtonBuilder()
  .setCustomId('redline_msn_send')
  .setLabel('ENVIAR')
  .setEmoji('🟢')
  .setStyle(ButtonStyle.Success);

const editButton = new ButtonBuilder()
  .setCustomId('redline_msn_edit')
  .setLabel('EDITAR')
  .setEmoji('⚪')
  .setStyle(ButtonStyle.Secondary);

const cancelButton = new ButtonBuilder()
  .setCustomId('redline_msn_cancel')
  .setLabel('CANCELAR')
  .setEmoji('🔴')
  .setStyle(ButtonStyle.Danger);

const previewRow = new ActionRowBuilder<ButtonBuilder>()
  .addComponents(
    sendButton,
    editButton,
    cancelButton
  );

msnSessions.set(interaction.user.id, {
  ...session,
  repetitions: repetitions,
});

await interaction.reply({
  content:
    `📨 **VISTA PREVIA DEL MENSAJE**\n\n` +
    `${session.messageText}\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `📅 Intervalo: **${session.days} días y ${session.hours} horas**\n` +
    `🔢 Envíos totales: **${repetitions}**\n` +
    `📺 Canal: <#${session.channelId}>`,
  components: [previewRow],
  ephemeral: true,
});
    return;
  }
  // =========================
  // BOTÓN CANCELAR /MSN
  // =========================

  if (
    interaction.isButton() &&
    interaction.customId === 'redline_msn_cancel'
  ) {

    msnSessions.delete(interaction.user.id);

    await interaction.update({
      content: '❌ **Proceso cancelado.**',
      components: [],
    });

    return;
  }

  // =========================
  // BOTÓN EDITAR /MSN
  // =========================

  if (
    interaction.isButton() &&
    interaction.customId === 'redline_msn_edit'
  ) {

    const session = msnSessions.get(interaction.user.id);

    if (!session) {
      await interaction.reply({
        content:
          '❌ No encuentro el mensaje que estabas preparando.',
        ephemeral: true,
      });

      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(
        `redline_msn_message:${session.channelId}`
      )
      .setTitle('Editar mensaje');

const messageInput = new TextInputBuilder()
  .setCustomId('redline_msn_text')
  .setLabel('Mensaje')
  .setPlaceholder(
    'Escribe aquí el mensaje que quieres enviar...'
  )
  .setStyle(TextInputStyle.Paragraph)
  .setRequired(true)
  .setMaxLength(2000);

const imageInput = new TextInputBuilder()
  .setCustomId('redline_msn_image')
  .setLabel('Enlace de imagen o archivo (opcional)')
  .setPlaceholder(
    'Pega aquí el enlace de la imagen o archivo...'
  )
  .setStyle(TextInputStyle.Short)
  .setRequired(false)
  .setMaxLength(1000);

const messageRow =
  new ActionRowBuilder<TextInputBuilder>()
    .addComponents(messageInput);

const imageRow =
  new ActionRowBuilder<TextInputBuilder>()
    .addComponents(imageInput);

modal.addComponents(
  messageRow,
  imageRow
);

    await interaction.showModal(modal);

    return;
  }

  // =========================
  // BOTÓN ENVIAR /MSN
  // =========================

  if (
    interaction.isButton() &&
    interaction.customId === 'redline_msn_send'
  ) {

    const session = msnSessions.get(interaction.user.id);

    if (!session) {
      await interaction.reply({
        content:
          '❌ No encuentro el mensaje que estabas preparando.',
        ephemeral: true,
      });

      return;
    }

        const channel =
      interaction.guild?.channels.cache.get(
        session.channelId
      );

    if (
      !channel ||
      channel.type !== ChannelType.GuildText
    ) {

      await interaction.reply({
        content:
          '❌ No encuentro el canal de destino.',
        ephemeral: true,
      });

      return;
    }

    await interaction.update({
      content:
        '⏳ **Enviando mensaje...**',
      components: [],
    });

    await channel.send({
  content: session.messageText,
  ...(session.imageUrl
    ? {
        files: [session.imageUrl],
      }
    : {}),
});

    // =========================
    // PROGRAMAR REPETICIONES
    // =========================

    if (
      session.repetitions &&
      session.repetitions > 1 &&
      session.intervalHours
    ) {

      const totalRepeats =
        session.repetitions - 1;

      for (
        let i = 1;
        i <= totalRepeats;
        i++
      ) {

        setTimeout(async () => {

          try {

            await channel.send({
  content: session.messageText,
  ...(session.imageUrl
    ? {
        files: [session.imageUrl],
      }
    : {}),
});

            console.log(
              `📨 /msn repetición ${i}/${totalRepeats} enviada en ${channel.name}`
            );

          } catch (error) {

            console.error(
              `❌ Error enviando repetición ${i} de /msn:`,
              error
            );

          }

        }, session.intervalHours * 60 * 60 * 1000 * i);
      }
    }

    msnSessions.delete(interaction.user.id);

    return;
  }
  // =========================
// PAGINACIÓN DE CANALES /MSN
// =========================

if (
  interaction.isButton() &&
  (
    interaction.customId.startsWith('redline_msn_channels_next:') ||
    interaction.customId.startsWith('redline_msn_channels_prev:')
  )
) {

  const channels = interaction.guild?.channels.cache
    .filter(
  channel =>
    (
      channel.type === ChannelType.GuildText ||
      channel.type === ChannelType.GuildAnnouncement
    ) &&
    channel.viewable
)
    .sort((a, b) => a.position - b.position)
    .map(channel => channel);

  const currentPage = Number(
    interaction.customId.split(':')[1]
  );

  const isNext =
    interaction.customId.startsWith(
      'redline_msn_channels_next:'
    );

  const newPage = isNext
    ? currentPage + 1
    : currentPage - 1;

  const pageSize = 25;

  const start = newPage * pageSize;

  const pageChannels = channels.slice(
    start,
    start + pageSize
  );

  if (pageChannels.length === 0) {
    return;
  }

  const channelOptions = pageChannels.map(channel => ({
    label: channel.name,
    value: channel.id,
  }));

  const channelMenu = new StringSelectMenuBuilder()
    .setCustomId(
      `redline_msn_channel:${newPage}`
    )
    .setPlaceholder(
      'Selecciona el canal de destino'
    )
    .addOptions(channelOptions);

  const row =
    new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(channelMenu);

  const totalPages =
    Math.ceil(channels.length / pageSize);

  const navigationRow =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `redline_msn_channels_prev:${newPage}`
          )
          .setLabel('◀️ Anterior')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(newPage === 0),

        new ButtonBuilder()
          .setCustomId(
            `redline_msn_channels_next:${newPage}`
          )
          .setLabel('Siguiente ▶️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(
            newPage >= totalPages - 1
          )
      );

  await interaction.update({
    content:
      `📨 **/MSN**\n\n` +
      `Selecciona el canal donde quieres publicar el mensaje:\n` +
      `Página **${newPage + 1}/${totalPages}**`,
    components: [
      row,
      navigationRow,
    ],
  });

  return;
}
  
  // =========================
  // SELECTOR DE CANAL /MSN
  // =========================

  if (
    interaction.isStringSelectMenu() &&
    interaction.customId.startsWith('redline_msn_channel:')
    ) {

    const selectedChannelId = interaction.values[0];

    const selectedChannel = interaction.guild?.channels.cache.get(
      selectedChannelId
    );

    if (!selectedChannel || selectedChannel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: '❌ No se ha podido encontrar el canal seleccionado.',
        ephemeral: true,
      });

      return;
    }

   const modal = new ModalBuilder()
  .setCustomId(`redline_msn_message:${selectedChannel.id}`)
  .setTitle('Enviar mensaje');

const messageInput = new TextInputBuilder()
  .setCustomId('redline_msn_text')
  .setLabel('Mensaje')
  .setPlaceholder(
    'Escribe aquí el mensaje que quieres enviar...'
  )
  .setStyle(TextInputStyle.Paragraph)
  .setRequired(true)
  .setMaxLength(2000);

const imageInput = new TextInputBuilder()
  .setCustomId('redline_msn_image')
  .setLabel('Enlace de imagen o archivo (opcional)')
  .setPlaceholder(
    'Pega aquí el enlace de la imagen o archivo...'
  )
  .setStyle(TextInputStyle.Short)
  .setRequired(false)
  .setMaxLength(1000);

const messageRow = new ActionRowBuilder<TextInputBuilder>()
  .addComponents(messageInput);

const imageRow = new ActionRowBuilder<TextInputBuilder>()
  .addComponents(imageInput);

modal.addComponents(
  messageRow,
  imageRow
);

await interaction.showModal(modal);

console.log(
  `📨 Canal seleccionado para /msn: ${selectedChannel.name} por ${interaction.user.tag}`
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
