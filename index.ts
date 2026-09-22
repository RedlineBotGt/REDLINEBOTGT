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

// Cliente de Discord con todas las intenciones necesarias
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
});

// Rutas de archivos de persistencia
const DB_FILE = path.join(__dirname, 'scheduled_embeds.json');
const REPORTS_FILE = path.join(__dirname, 'reports_data.json');

// IDs de los Canales de Reportes e Hilos
const CHANNEL_REPORTES_ID = '1469654237519810687';
const CHANNEL_HILOS_ID = '1473834354529538079';

// Comprobar si un usuario tiene el rol Dirección
function isDireccion(member: GuildMember | null): boolean {
  if (!member) return false;
  return member.roles.cache.some(role => 
    role.name.toLowerCase() === 'dirección' || role.name.toLowerCase() === 'direccion'
  );
}

// Estructuras de datos
interface ScheduledEmbed {
  id: string;
  targetChannelId: string;
  textContent: string;
  executionTime: number;
  repeat: boolean;
  intervalDays?: number;
  remainingRepetitions?: number;
  creatorId: string;
}

interface ReportsData {
  lastId: number;
}

// Funciones para leer/guardar archivos
function loadScheduledTasks(): ScheduledEmbed[] {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
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

function loadReportsData(): ReportsData {
  try {
    if (fs.existsSync(REPORTS_FILE)) {
      return JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error al cargar datos de reportes:', err);
  }
  return { lastId: 0 };
}

function saveReportsData(data: ReportsData) {
  try {
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error al guardar datos de reportes:', err);
  }
}

let scheduledTasks: ScheduledEmbed[] = loadScheduledTasks();

// Sesiones en memoria para el comando /embed
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

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || '');
    if (client.user) {
      const commands = [
        new SlashCommandBuilder()
          .setName('embed')
          .setDescription('Programa una publicación con cajón rojo (Solo rol Dirección)')
      ];
      await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
      console.log('Comando /embed registrado.');
    }
  } catch (error) {
    console.error('Error al registrar comandos slash:', error);
  }

  setInterval(checkAndExecuteTasks, 15000);
});

// Comprobador periódico de mensajes programados (/embed)
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
            .setColor('#FF0000')
            .setDescription(task.textContent)
            .setFooter({ text: 'REDLINE GT' })
            .setTimestamp();

          await channel.send({ embeds: [embed] });
        }
      } catch (err) {
        console.error(`Error al publicar embed ${task.id}:`, err);
      }

      if (task.repeat && task.intervalDays && task.remainingRepetitions && task.remainingRepetitions > 1) {
        task.remainingRepetitions -= 1;
        task.executionTime += task.intervalDays * 24 * 60 * 60 * 1000;
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

// Convertir hora de España a Timestamp UTC
function parseDateTime(dateStr: string): number | null {
  const parts = dateStr.trim().split(' ');
  if (parts.length !== 2) return null;

  const dateParts = parts[0].split('/');
  const timeParts = parts[1].split(':');

  if (dateParts.length !== 3 || timeParts.length !== 2) return null;

  const day = dateParts[0].padStart(2, '0');
  const month = dateParts[1].padStart(2, '0');
  const year = dateParts[2];
  const hour = timeParts[0].padStart(2, '0');
  const minute = timeParts[1].padStart(2, '0');

  const isoTarget = `${year}-${month}-${day}T${hour}:${minute}:00`;

  const targetDate = new Date(`${isoTarget}Z`);
  if (isNaN(targetDate.getTime())) return null;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });

  const partsFormatted = formatter.formatToParts(targetDate);
  const map: Record<string, string> = {};
  partsFormatted.forEach(p => { if (p.type !== 'literal') map[p.type] = p.value; });

  const yearSpain = parseInt(map.year, 10);
  const monthSpain = parseInt(map.month, 10) - 1;
  const daySpain = parseInt(map.day, 10);
  let hourSpain = parseInt(map.hour, 10);
  if (hourSpain === 24) hourSpain = 0;
  const minuteSpain = parseInt(map.minute, 10);

  const utcAsSpainTime = Date.UTC(yearSpain, monthSpain, daySpain, hourSpain, minuteSpain);
  const offsetMs = utcAsSpainTime - targetDate.getTime();

  const wantedLocalUtc = Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hour, 10), parseInt(minute, 10));
  
  return wantedLocalUtc - offsetMs;
}

// ESCUCHADOR DE MENSAJES (COMANDOS !PREFIX)
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // 1. !setup-buzon
  if (message.content === '!setup-buzon') {
    if (!isDireccion(message.member)) {
      await message.reply('Solo el rol **Dirección** puede usar este comando.');
      return;
    }
    try { await message.delete(); } catch (_) {}

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('crear_sugerencia')
        .setLabel('SUGERENCIA')
        .setStyle(ButtonStyle.Danger)
    );

    const texto = 
      "¿Quieres hablar con el equipo de REDLINE GT?\n" +
      "Pincha en el botón rojo y te atenderemos lo antes posible.\n" +
      "¡Gracias!\n\n" +
      "Do you want to talk to the REDLINE GT team?\n" +
      "Click the red button and we will assist you as soon as possible.\n" +
      "Thank you!";

    await message.channel.send({ content: texto, components: [row] });
    return;
  }

  // 2. !setup-reporte
  if (message.content === '!setup-reporte') {
    if (!isDireccion(message.member)) {
      await message.reply('Solo el rol **Dirección** puede usar este comando.');
      return;
    }
    try { await message.delete(); } catch (_) {}

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_iniciar_reporte')
        .setLabel('REPORTE')
        .setStyle(ButtonStyle.Primary) // Botón Azul
    );

    const texto = 
      "¿Quieres Reportar una acción en carrera?\n" +
      "Pincha en el botón Azul y rellena el formulario";

    await message.channel.send({ content: texto, components: [row] });
    return;
  }

  // 3. !setup-defensa
  if (message.content === '!setup-defensa') {
    if (!isDireccion(message.member)) {
      await message.reply('Solo el rol **Dirección** puede usar este comando.');
      return;
    }
    try { await message.delete(); } catch (_) {}

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_iniciar_defensa')
        .setLabel('DEFENSA')
        .setStyle(ButtonStyle.Success) // Botón Verde
    );

    const texto = 
      "¿Quieres presentar la alegación o defensa a un reporte?\n" +
      "Pincha en el botón Verde y rellena el formulario";

    await message.channel.send({ content: texto, components: [row] });
    return;
  }

  // 4. !embed
  if (message.content === '!embed') {
    if (!isDireccion(message.member)) {
      await message.reply('Solo el rol **Dirección** puede usar este comando.');
      return;
    }
    try { await message.delete(); } catch (_) {}
    await startEmbedCreationProcess(message);
  }
});

// FLUJO DE CREACIÓN /EMBED
async function startEmbedCreationProcess(context: any) {
  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('embed_select_channel')
    .setPlaceholder('Selecciona el canal de destino...')
    .setChannelTypes([DiscordChannelType.GuildText]);

  const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);

  await context.reply({
    content: '📢 **Paso 1:** Selecciona en el desplegable el canal donde quieres publicar el mensaje:',
    components: [row],
    ephemeral: true
  });
}

async function openEmbedFormModal(interaction: any, defaultText = '', defaultDate = '') {
  const modal = new ModalBuilder()
    .setCustomId('modal_embed_step1')
    .setTitle('Programar Embed Rojo');

  const inputTexto = new TextInputBuilder()
    .setCustomId('embed_text')
    .setLabel('Texto / Contenido a publicar')
    .setStyle(TextInputStyle.Paragraph)
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

// MANEJADOR GENERAL DE INTERACCIONES (BOTONES, MODALES, SLASH)
client.on('interactionCreate', async (interaction: Interaction) => {

  // Slash Command /embed
  if (interaction.isChatInputCommand() && interaction.commandName === 'embed') {
    if (!isDireccion(interaction.member as GuildMember)) {
      await interaction.reply({ content: 'Solo el rol **Dirección** puede usar este comando.', ephemeral: true });
      return;
    }
    await startEmbedCreationProcess(interaction);
    return;
  }

  // Desplegable de selección de canal para /embed
  if (interaction.isChannelSelectMenu() && interaction.customId === 'embed_select_channel') {
    creationSessions.set(interaction.user.id, { channelId: interaction.values[0] });
    await openEmbedFormModal(interaction);
    return;
  }

  // BOTONES INTERACTIVOS
  if (interaction.isButton()) {

    // Botón Sugerencia Buzón
    if (interaction.customId === 'crear_sugerencia') {
      const guild = interaction.guild;
      const user = interaction.user;
      if (!guild) return;

      await interaction.reply({ content: 'Creando tu canal privado de sugerencia...', ephemeral: true });

      try {
        const canal = await guild.channels.create({
          name: `sugerencia-${user.username}`,
          type: ChannelType.GuildText,
          permissionOverwrites: [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
          ]
        });

        await canal.send(
          `Hola <@${user.id}>, cuéntanos, enseguida estamos contigo.\n\n` +
          `Hello <@${user.id}>, tell us, we will be with you shortly.`
        );
      } catch (err) {
        console.error('Error al crear buzón:', err);
      }
      return;
    }

    // Botón REPORTE (Abre formulario de Reporte)
    if (interaction.customId === 'btn_iniciar_reporte') {
      const modal = new ModalBuilder()
        .setCustomId('modal_reporte_submit')
        .setTitle('Formulario de Reporte');

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('rep_jornada').setLabel('JORNADA').setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('rep_reporta').setLabel('PILOTO QUE REPORTA').setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('rep_reportado').setLabel('PILOTO REPORTADO').setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('rep_explicacion').setLabel('BREVE EXPLICACIÓN').setStyle(TextInputStyle.Paragraph).setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('rep_enlace').setLabel('ENLACE DE VIDEO').setStyle(TextInputStyle.Short).setPlaceholder('https://...').setRequired(true)
        )
      );

      await interaction.showModal(modal);
      return;
    }

    // Botón DEFENSA (Abre formulario de Defensa)
    if (interaction.customId === 'btn_iniciar_defensa') {
      const modal = new ModalBuilder()
        .setCustomId('modal_defensa_submit')
        .setTitle('Formulario de Defensa');

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('def_id').setLabel('🆔 DEL REPORTE A DEFENDER').setStyle(TextInputStyle.Short).setPlaceholder('Ejemplo: 001').setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('def_defiende').setLabel('PILOTO EN DEFENSA').setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('def_reporto').setLabel('PILOTO QUE REPORTÓ').setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('def_explicacion').setLabel('BREVE EXPLICACIÓN').setStyle(TextInputStyle.Paragraph).setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('def_enlace').setLabel('ENLACE DE VIDEO').setStyle(TextInputStyle.Short).setPlaceholder('https://...').setRequired(true)
        )
      );

      await interaction.showModal(modal);
      return;
    }

    // Botones auxiliares de /embed
    if (interaction.customId === 'embed_repeat_no') {
      const session = creationSessions.get(interaction.user.id);
      if (session) session.repeat = false;
      await showEmbedPreviewAndConfirm(interaction);
      return;
    }

    if (interaction.customId === 'embed_repeat_yes') {
      const modal = new ModalBuilder()
        .setCustomId('modal_embed_repeat_details')
        .setTitle('Configurar Repetición');

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('embed_interval').setLabel('Intervalo entre publicaciones (días)').setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('embed_reps').setLabel('Número total de repeticiones').setStyle(TextInputStyle.Short).setRequired(true)
        )
      );

      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId === 'embed_edit_btn') {
      const session = creationSessions.get(interaction.user.id);
      await openEmbedFormModal(interaction, session?.textContent || '', session?.rawDateStr || '');
      return;
    }

    if (interaction.customId === 'embed_cancel_btn') {
      creationSessions.delete(interaction.user.id);
      await interaction.update({ content: '🚫 **Publicación cancelada.**', embeds: [], components: [] });
      return;
    }

    if (interaction.customId === 'embed_confirm_final') {
      const session = creationSessions.get(interaction.user.id);
      if (!session || !session.channelId || !session.textContent || !session.executionTime) {
        await interaction.reply({ content: '❌ Sesión caducada.', ephemeral: true });
        return;
      }

      scheduledTasks.push({
        id: Date.now().toString(),
        targetChannelId: session.channelId,
        textContent: session.textContent,
        executionTime: session.executionTime,
        repeat: session.repeat || false,
        intervalDays: session.intervalDays,
        remainingRepetitions: session.repetitions,
        creatorId: interaction.user.id
      });
      saveScheduledTasks(scheduledTasks);
      creationSessions.delete(interaction.user.id);

      await interaction.update({ content: '✅ **¡Publicación programada correctamente!**', embeds: [], components: [] });
      return;
    }
  }

  // RECEPCIÓN DE MODALES SUBMIT
  if (interaction.isModalSubmit()) {

    // 1. ENVÍO DEL FORMULARIO DE REPORTE
    if (interaction.customId === 'modal_reporte_submit') {
      const jornada = interaction.fields.getTextInputValue('rep_jornada');
      const pilotoReporta = interaction.fields.getTextInputValue('rep_reporta');
      const pilotoReportado = interaction.fields.getTextInputValue('rep_reportado');
      const explicacion = interaction.fields.getTextInputValue('rep_explicacion');
      const enlace = interaction.fields.getTextInputValue('rep_enlace');

      if (!enlace.startsWith('http://') && !enlace.startsWith('https://')) {
        await interaction.reply({ content: '❌ El enlace debe comenzar con `http://` o `https://`.', ephemeral: true });
        return;
      }

      // Incrementar contador para la ID
      const repData = loadReportsData();
      repData.lastId += 1;
      saveReportsData(repData);

      const reportIdStr = String(repData.lastId).padStart(3, '0');

      // Buscar roles en el servidor
      const guild = interaction.guild;
      const roleGTCUP = guild?.roles.cache.find(r => r.name.toUpperCase() === 'GTCUP');
      const roleComisario = guild?.roles.cache.find(r => r.name.toLowerCase().includes('comisario'));

      const mentionGTCUP = roleGTCUP ? `<@&${roleGTCUP.id}>` : '@GTCUP';
      const mentionComisario = roleComisario ? `<@&${roleComisario.id}>` : '@Comisario';

      // Crear Embed Azul de Reporte
      const embedReporte = new EmbedBuilder()
        .setColor('#0000FF') // Azul
        .setTitle(`🆔 ${reportIdStr}`)
        .addFields(
          { name: 'JORNADA', value: jornada, inline: false },
          { name: 'PILOTO QUE REPORTA', value: pilotoReporta, inline: false }
