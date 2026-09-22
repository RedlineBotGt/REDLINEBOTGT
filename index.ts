import { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChannelType, 
  PermissionsBitField,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Interaction,
  TextChannel,
  SlashCommandBuilder,
  GuildMember,
  ChannelSelectMenuBuilder,
  ChannelType as DiscordChannelType
} from 'discord.js';
import http from 'http';
import fs from 'fs';
import path from 'path';

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

const DB_FILE = path.join(__dirname, 'scheduled_embeds.json');

// Función para verificar si un miembro tiene el rol de Dirección
function isDireccion(member: GuildMember | null): boolean {
  if (!member) return false;
  return member.roles.cache.some(role => 
    role.name.toLowerCase() === 'dirección' || role.name.toLowerCase() === 'direccion'
  );
}

// Estructura de tarea programada
interface ScheduledEmbed {
  id: string;
  targetChannelId: string;
  textContent: string;
  executionTime: number; // Timestamp UTC ms
  repeat: boolean;
  intervalDays?: number;
  remainingRepetitions?: number;
  creatorId: string;
}

// Cargar y guardar programación en archivo JSON
function loadScheduledTasks(): ScheduledEmbed[] {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error al cargar tareas programadas:', err);
  }
  return [];
}

function saveScheduledTasks(tasks: ScheduledEmbed[]) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(tasks, null, 2));
  } catch (err) {
    console.error('Error al guardar tareas programadas:', err);
  }
}

let scheduledTasks: ScheduledEmbed[] = loadScheduledTasks();

// Memoria temporal para la sesión de creación del embed
const creationSessions = new Map<string, {
  channelId?: string;
  textContent?: string;
  executionTime?: number;
  rawDateStr?: string;
  repeat?: boolean;
  intervalDays?: number;
  repetitions?: number;
}>();

client.once('ready', async () => {
  console.log(`¡Bot conectado exitosamente como ${client.user?.tag}!`);

  // Registrar comando slash /embed en Discord
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || '');
    if (client.user) {
      const commands = [
        new SlashCommandBuilder()
          .setName('embed')
          .setDescription('Programa una publicación con cajón rojo (Solo rol Dirección)')
      ];
      await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
      console.log('Comando /embed registrado correctamente.');
    }
  } catch (error) {
    console.error('Error al registrar comando /embed:', error);
  }

  // Comprobador periódico de mensajes programados (cada 15 segundos)
  setInterval(checkAndExecuteTasks, 15000);
});

// Comprobar y ejecutar tareas programadas
async function checkAndExecuteTasks() {
  const now = Date.now();
  let tasksChanged = false;

  for (let i = scheduledTasks.length - 1; i >= 0; i--) {
    const task = scheduledTasks[i];

    if (now >= task.executionTime) {
      try {
        const channel = await client.channels.fetch(task.targetChannelId) as TextChannel;
        if (channel && channel.isTextBased()) {
          const embed = new EmbedBuilder()
            .setColor('#FF0000') // Rojo corporativo REDLINE GT
            .setDescription(task.textContent)
            .setFooter({ text: 'REDLINE GT' })
            .setTimestamp();

          await channel.send({ embeds: [embed] });
          console.log(`Embed programado publicado con éxito en el canal ${task.targetChannelId}`);
        }
      } catch (err) {
        console.error(`Error al publicar embed programado ${task.id}:`, err);
      }

      // Gestionar repeticiones si están activadas
      if (task.repeat && task.intervalDays && task.remainingRepetitions && task.remainingRepetitions > 1) {
        task.remainingRepetitions -= 1;
        task.executionTime += task.intervalDays * 24 * 60 * 60 * 1000;
        console.log(`Tarea ${task.id} reprogramada para dentro de ${task.intervalDays} días. Quedan ${task.remainingRepetitions} envíos.`);
      } else {
        scheduledTasks.splice(i, 1);
      }
      tasksChanged = true;
    }
  }

  if (tasksChanged) {
    saveScheduledTasks(scheduledTasks);
  }
}

// Parsea fechas en formato DD/MM/AAAA HH:MM a timestamp UTC respetando el horario de España
function parseDateTime(dateStr: string): number | null {
  const parts = dateStr.trim().split(' ');
  if (parts.length !== 2) return null;

  const dateParts = parts[0].split('/');
  const timeParts = parts[1].split(':');

  if (dateParts.length !== 3 || timeParts.length !== 2) return null;

  const day = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1; // Los meses en JS van de 0 a 11
  const year = parseInt(dateParts[2], 10);
  const hour = parseInt(timeParts[0], 10);
  const minute = parseInt(timeParts[1], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year) || isNaN(hour) || isNaN(minute)) return null;

  // Determinar si estamos en horario de verano (CEST = UTC+2) o de invierno (CET = UTC+1)
  const isDST = month >= 2 && month <= 9; 
  const offsetHours = isDST ? 2 : 1;

  // Convertir la hora introducida (hora de España) a UTC restando el offset
  const utcDate = new Date(Date.UTC(year, month, day, hour - offsetHours, minute));

  return utcDate.getTime();
}

// Escuchar mensajes (para !setup-buzon y !embed)
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Comando !setup-buzon
  if (message.content === '!setup-buzon') {
    try { await message.delete(); } catch (_) {}

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('crear_sugerencia')
        .setLabel('SUGERENCIA')
        .setStyle(ButtonStyle.Danger)
    );

    const mensajeTexto = 
      "¿Quieres hablar con el equipo de REDLINE GT?\n" +
      "Pincha en el botón rojo y te atenderemos lo antes posible.\n" +
      "¡Gracias!\n\n" +
      "Do you want to talk to the REDLINE GT team?\n" +
      "Click the red button and we will assist you as soon as possible.\n" +
      "Thank you!";

    await message.channel.send({ content: mensajeTexto, components: [row] });
    return;
  }

  // Comando !embed como alternativa
  if (message.content === '!embed') {
    const member = message.member;
    if (!isDireccion(member)) {
      await message.reply('Solo los miembros con el rol **Dirección** pueden usar este comando.');
      return;
    }
    try { await message.delete(); } catch (_) {}
    await startEmbedCreationProcess(message);
  }
});

// Inicia el proceso mostrando el Desplegable de Canales
async function startEmbedCreationProcess(context: any) {
  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('embed_select_channel')
    .setPlaceholder('Selecciona el canal de destino...')
    .setChannelTypes([DiscordChannelType.GuildText]);

  const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);

  const replyData = {
    content: '📢 **Paso 1:** Selecciona en el desplegable el canal donde quieres publicar el mensaje:',
    components: [row],
    ephemeral: true
  };

  await context.reply(replyData);
}

// Muestra el Modal para ingresar texto y fecha
async function openEmbedFormModal(interaction: any, defaultText = '', defaultDate = '') {
  const modal = new ModalBuilder()
    .setCustomId('modal_embed_step1')
    .setTitle('Programar Embed Rojo');

  const inputTexto = new TextInputBuilder()
    .setCustomId('embed_text')
    .setLabel('Texto / Contenido a publicar')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Escribe aquí el contenido del mensaje...')
    .setValue(defaultText)
    .setRequired(true);

  const inputFecha = new TextInputBuilder()
    .setCustomId('embed_datetime')
    .setLabel('Fecha y hora de envío (DD/MM/AAAA HH:MM)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ejemplo: 25/09/2026 21:00')
    .setValue(defaultDate)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(inputTexto),
    new ActionRowBuilder<TextInputBuilder>().addComponents(inputFecha)
  );

  await interaction.showModal(modal);
}

// Escuchar interacciones
client.on('interactionCreate', async (interaction: Interaction) => {

  // 1. Comando Slash /embed
  if (interaction.isChatInputCommand() && interaction.commandName === 'embed') {
    const member = interaction.member as GuildMember;
    if (!isDireccion(member)) {
      await interaction.reply({ content: 'Solo los miembros con el rol **Dirección** pueden usar este comando.', ephemeral: true });
      return;
    }
    await startEmbedCreationProcess(interaction);
    return;
  }

  // 2. Selección de Canal en Desplegable
  if (interaction.isChannelSelectMenu() && interaction.customId === 'embed_select_channel') {
    const selectedChannelId = interaction.values[0];
    
    creationSessions.set(interaction.user.id, {
      channelId: selectedChannelId
    });

    await openEmbedFormModal(interaction);
    return;
  }

  // 3. Recepción de Modales
  if (interaction.isModalSubmit()) {

    // Modal Paso 1
    if (interaction.customId === 'modal_embed_step1') {
      const textContent = interaction.fields.getTextInputValue('embed_text');
      const rawDateTime = interaction.fields.getTextInputValue('embed_datetime');

      const timestamp = parseDateTime(rawDateTime);

      if (!timestamp || isNaN(timestamp)) {
        await interaction.reply({ 
          content: '❌ Formato de fecha incorrecto. Debe ser: `DD/MM/AAAA HH:MM` (ejemplo: `25/09/2026 21:00`).', 
          ephemeral: true 
        });
        return;
      }

      const session = creationSessions.get(interaction.user.id) || {};
      session.textContent = textContent;
      session.executionTime = timestamp;
      session.rawDateStr = rawDateTime;
      creationSessions.set(interaction.user.id, session);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('embed_repeat_yes').setLabel('SÍ').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('embed_repeat_no').setLabel('NO').setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({
        content: '¿Deseas que esta publicación se repita de forma periódica?',
        components: [row],
        ephemeral: true
      });
      return;
    }

    // Modal Paso 2 (Repetición)
    if (interaction.customId === 'modal_embed_repeat_details') {
      const rawInterval = interaction.fields.getTextInputValue('embed_interval');
      const rawReps = interaction.fields.getTextInputValue('embed_reps');

      const intervalDays = parseInt(rawInterval, 10);
      const repetitions = parseInt(rawReps, 10);

      if (isNaN(intervalDays) || isNaN(repetitions) || intervalDays <= 0 || repetitions <= 0) {
        await interaction.reply({ content: '❌ Introduce números válidos mayores que 0.', ephemeral: true });
        return;
      }

      const session = creationSessions.get(interaction.user.id);
      if (session) {
        session.repeat = true;
        session.intervalDays = intervalDays;
        session.repetitions = repetitions;
      }

      await showEmbedPreviewAndConfirm(interaction);
      return;
    }
  }

  // 4. Botones interactivos
  if (interaction.isButton()) {

    // Botón de Sugerencias
    if (interaction.customId === 'crear_sugerencia') {
      const guild = interaction.guild;
      const user = interaction.user;
      if (!guild) return;

      await interaction.reply({ content: 'Creando tu canal privado de sugerencia...', ephemeral: true });

      try {
        const canalTicket = await guild.channels.create({
          name: `sugerencia-${user.username}`,
          type: ChannelType.GuildText,
          permissionOverwrites: [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
          ]
        });

        const mensajeBienvenida = 
          `Hola <@${user.id}>, cuéntanos, enseguida estamos contigo.\n\n` +
          `Hello <@${user.id}>, tell us, we will be with you shortly.`;

        await canalTicket.send(mensajeBienvenida);
      } catch (error) {
        console.error('Error al crear el canal privado:', error);
      }
      return;
    }

    // Botón Repetición = NO
    if (interaction.customId === 'embed_repeat_no') {
      const session = creationSessions.get(interaction.user.id);
      if (session) {
        session.repeat = false;
      }
      await showEmbedPreviewAndConfirm(interaction);
      return;
    }

    // Botón Repetición = SÍ
    if (interaction.customId === 'embed_repeat_yes') {
      const modal = new ModalBuilder()
        .setCustomId('modal_embed_repeat_details')
        .setTitle('Configurar Repetición');

      const inputInterval = new TextInputBuilder()
        .setCustomId('embed_interval')
        .setLabel('Intervalo entre publicaciones (en días)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ejemplo: 7 (para publicación semanal)')
        .setRequired(true);

      const inputReps = new TextInputBuilder()
        .setCustomId('embed_reps')
        .setLabel('Número total de repeticiones')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ejemplo: 4')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputInterval),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputReps)
      );

      await interaction.showModal(modal);
      return;
    }

    // Botón EDITAR
    if (interaction.customId === 'embed_edit_btn') {
      const session = creationSessions.get(interaction.user.id);
      await openEmbedFormModal(
        interaction, 
        session?.textContent || '', 
        session?.rawDateStr || ''
      );
      return;
    }

    // Botón PUBLICAR (Confirmación final)
    if (interaction.customId === 'embed_confirm_final') {
      const session = creationSessions.get(interaction.user.id);
      if (!session || !session.channelId || !session.textContent || !session.executionTime) {
        await interaction.reply({ content: '❌ Sesión caducada o datos incompletos. Inicia de nuevo con /embed.', ephemeral: true });
        return;
      }

      const newTask: ScheduledEmbed = {
        id: Date.now().toString(),
        targetChannelId: session.channelId,
        textContent: session.textContent,
        executionTime: session.executionTime,
        repeat: session.repeat || false,
        intervalDays: session.intervalDays,
        remainingRepetitions: session.repetitions,
        creatorId: interaction.user.id
      };

      scheduledTasks.push(newTask);
      saveScheduledTasks(scheduledTasks);

      creationSessions.delete(interaction.user.id);

      await interaction.update({
        content: '✅ **¡Publicación programada correctamente!** El mensaje se enviará automáticamente en el canal seleccionado a la fecha indicada.',
        embeds: [],
        components: []
      });
      return;
    }
  }
});

// Muestra vista previa del Embed Rojo con botones PUBLICAR y EDITAR
async function showEmbedPreviewAndConfirm(interaction: any) {
  const session = creationSessions.get(interaction.user.id);
  if (!session) return;

  const previewEmbed = new EmbedBuilder()
    .setColor('#FF0000') // Rojo corporativo
    .setDescription(session.textContent || '')
    .setFooter({ text: 'REDLINE GT' })
    .setTimestamp();

  const fechaFormat = new Date(session.executionTime || 0).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

  let resumenInfo = `📌 **VISTA PREVIA DE TU MENSAJE PROGRAMADO**\n\n` +
    `• **Canal de destino:** <#${session.channelId}>\n` +
    `• **Fecha/Hora de envío (España):** ${fechaFormat}\n` +
    `• **Repetición:** ${session.repeat ? `SÍ (Cada ${session.intervalDays} días, ${session.repetitions} veces)` : 'NO'}\n\n` +
    `*Revisa la vista previa del cajón rojo abajo:*`;

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('embed_confirm_final')
      .setLabel('PUBLICAR')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('embed_edit_btn')
      .setLabel('EDITAR')
      .setStyle(ButtonStyle.Secondary)
  );

  if (interaction.isModalSubmit()) {
    await interaction.reply({
      content: resumenInfo,
      embeds: [previewEmbed],
      components: [actionRow],
      ephemeral: true
    });
  } else {
    await interaction.update({
      content: resumenInfo,
      embeds: [previewEmbed],
      components: [actionRow]
    });
  }
}

// Inicio de sesión
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('ERROR: No se ha encontrado la variable DISCORD_TOKEN');
} else {
  client.login(token);
                     }
                               
