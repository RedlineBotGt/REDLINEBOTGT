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

// Cliente de Discord con intenciones requeridas
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
});

// Archivo de almacenamiento para mensajes programados
const DB_FILE = path.join(__dirname, 'scheduled_embeds.json');

// IDs de Canales
const CHANNEL_REPORTES_ID = '1469654237519810687';
const CHANNEL_HILOS_ID = '1473834354529538079';

// Comprobar si un usuario tiene el rol Dirección
function isDireccion(member: GuildMember | null): boolean {
  if (!member) return false;
  return member.roles.cache.some(role => 
    role.name.toLowerCase() === 'dirección' || role.name.toLowerCase() === 'direccion'
  );
}

// Estructura de programación de embeds
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

let scheduledTasks: ScheduledEmbed[] = loadScheduledTasks();

// Sesiones en memoria para /embed
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

// Comprobador periódico de mensajes programados
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
// Limpieza de comandos Slash antiguos en Discord
client.once('ready', async () => {
  console.log(`🤖 Bot conectado como ${client.user?.tag}`);
  try {
    console.log('🧹 Limpiando comandos Slash antiguos...');
      if (client.application) {
        const GUILD_ID = 'TU_ID_DE_SERVIDOR_AQUÍ'; // 👈 Pon aquí el ID numérico de tu servidor de Discord
        const guild = client.guilds.cache.get(GUILD_ID);
        
        if (guild) {
          await guild.commands.set([
            {
              name: 'embed',
              description: 'Crea o programa un embed'
            },
            {
              name: 'veredicto',
              description: 'Abre el formulario de resolución de comisaría'
            }
          ]);
          console.log('✅ Comandos /embed y /veredicto registrados instantáneamente en el servidor.');
        } else {
          console.error('❌ No se pudo encontrar el servidor para registrar los comandos.');
        }
      }
    } catch (error) {
      console.error('❌ Error al registrar comandos Slash:', error);
    }
  });

          
    
      
      console.log('✅ Todos los comandos Slash antiguos han sido eliminados de Discord.');
    }
  } catch (error) {
    console.error('❌ Error al borrar comandos Slash:', error);
  }
});

// Escuchador de Mensajes (!setup-buzon, !setup-reporte, !setup-defensa, !embed)
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

      // Comando por texto !veredicto
    if (message.content.toLowerCase() === '!veredicto') {
      const member = message.member;
      const isComisario = member?.roles.cache.some(r => r.name.toLowerCase().includes('comisario'));
      const isDireccion = member?.roles.cache.some(r => r.name.toLowerCase().includes('direccion'));

      if (!isComisario && !isDireccion) {
        await message.reply('❌ Solo **Dirección** y **Comisarios** pueden utilizar este comando.');
        return;
      }

      await message.reply('⚖️ Para gestionar veredictos, utiliza el botón **VEREDICTOS** en el Dashboard o el comando `/veredicto`.');
      return;
    }
  
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
        .setStyle(ButtonStyle.Primary)
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
        .setStyle(ButtonStyle.Success)
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

// Flujo de creación de /embed
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
    // Manejador de interacciones
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
      // Slash Command /veredicto
    if (interaction.isChatInputCommand() && interaction.commandName === 'veredicto') {
      const member = interaction.member as GuildMember;
      const isComisario = member?.roles.cache.some(r => r.name.toLowerCase().includes('comisario'));
      const isDireccion = member?.roles.cache.some(r => r.name.toLowerCase().includes('direccion'));

      if (!isComisario && !isDireccion) {
        await interaction.reply({ content: '❌ Solo **Dirección** y **Comisarios** pueden utilizar este comando.', ephemeral: true });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_veredicto_submit')
        .setTitle('⚖️ RESOLUCIÓN DE COMISARÍA');

      const inputId = new TextInputBuilder()
        .setCustomId('ver_id')
        .setLabel('🆔 Reporte (ej: 005)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const inputReporto = new TextInputBuilder()
        .setCustomId('ver_reporto')
        .setLabel('Piloto que Reportó')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const inputReportado = new TextInputBuilder()
        .setCustomId('ver_reportado')
        .setLabel('Piloto Reportado')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const inputDecision = new TextInputBuilder()
        .setCustomId('ver_decision')
        .setLabel('Decisión')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const inputSancion = new TextInputBuilder()
        .setCustomId('ver_sancion')
        .setLabel('Sanción Aplicada')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputId),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputReporto),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputReportado),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputDecision),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputSancion)
      );

      await interaction.showModal(modal);
      return;
    }

    // Submit de Veredicto (Cuando se envía el formulario)
    if (interaction.isModalSubmit() && interaction.customId === 'modal_veredicto_submit') {
      await interaction.deferReply({ ephemeral: true });

      const rawId = interaction.fields.getTextInputValue('ver_id').trim();
      const reportIdStr = rawId.padStart(3, '0');
      const pilotoReporto = interaction.fields.getTextInputValue('ver_reporto');
      const pilotoReportado = interaction.fields.getTextInputValue('ver_reportado');
      const decision = interaction.fields.getTextInputValue('ver_decision');
      const sancion = interaction.fields.getTextInputValue('ver_sancion');

      const CHANNEL_VEREDICTOS_ID = '1463096144900001854';
      const guild = interaction.guild;
      const roleGTCUP = guild?.roles.cache.find(r => r.name.toUpperCase() === 'GTCUP');
      const mentionGTCUP = roleGTCUP ? `<@&${roleGTCUP.id}>` : '@GTCUP';

      const embedVeredicto = new EmbedBuilder()
        .setColor('#0099FF') // Azul
        .setTitle(`⚖️ RESOLUCIÓN DE COMISARÍA 🆔 ${reportIdStr}`)
        .addFields(
          { name: 'PILOTO QUE REPORTÓ', value: pilotoReporto, inline: true },
          { name: 'PILOTO REPORTADO', value: pilotoReportado, inline: true },
          { name: 'DECISIÓN', value: decision, inline: false },
          { name: 'SANCIÓN', value: sancion, inline: false }
        )
        .setFooter({ text: 'REDLINE GT' })
        .setTimestamp();

      try {
        const canalVeredictos = await client.channels.fetch(CHANNEL_VEREDICTOS_ID) as TextChannel;
        if (canalVeredictos) {
          await canalVeredictos.send({
            content: `${mentionGTCUP}`,
            embeds: [embedVeredicto],
            allowedMentions: { parse: ['roles', 'users'] }
          });
          await interaction.editReply({ content: `✅ Veredicto para el reporte **${reportIdStr}** publicado con éxito en <#${CHANNEL_VEREDICTOS_ID}>.` });
        } else {
          await interaction.editReply({ content: '❌ No se pudo encontrar el canal de veredictos.' });
        }
      } catch (e) {
        console.error('Error al publicar el veredicto:', e);
        await interaction.editReply({ content: '❌ Ocurrió un error al intentar publicar el veredicto.' });
      }
      return;
    }
  client.once('ready', async () => {
  console.log(`🤖 Bot conectado como ${client.user?.tag}`);
    // Registrar comandos Slash globalmente o en el servidor
  try {
    if (client.application) {
      await client.application.commands.set([
        {
          name: 'embed',
          description: 'Crea o programa un embed'
        },
        {
          name: 'veredicto',
          description: 'Abre el formulario de resolución de comisaría'
        }
      ]);
      console.log('✅ Comandos /embed y /veredicto registrados correctamente en Discord.');
    }
  } catch (error) {
    console.error('❌ Error al registrar comandos Slash:', error);
  }
     
     try {
    if (client.application) {
      await client.application.commands.set([
        {
          name: 'embed',
          description: 'Crea o programa un embed'
        },
        {
          name: 'veredicto',
          description: 'Abre el formulario de resolución de comisaría'
        }
      ]);
      console.log('✅ Comandos /embed y /veredicto registrados correctamente en Discord.');
    }
  } catch (error) {
    console.error('❌ Error al registrar comandos:', error);
  }
});
  // Slash Command /veredicto
    if (interaction.isChatInputCommand() && interaction.commandName === 'veredicto') {
      const member = interaction.member as GuildMember;
      const isComisario = member?.roles.cache.some(r => r.name.toLowerCase().includes('comisario'));
      const isDireccion = member?.roles.cache.some(r => r.name.toLowerCase().includes('direccion'));

      if (!isComisario && !isDireccion) {
        await interaction.reply({ content: '❌ Solo **Dirección** y **Comisarios** pueden gestionar veredictos.', ephemeral: true });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_veredicto_submit')
        .setTitle('⚖️ RESOLUCIÓN DE COMISARÍA');

      const inputId = new TextInputBuilder()
        .setCustomId('ver_id')
        .setLabel('🆔 Reporte (ej: 005)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const inputReporto = new TextInputBuilder()
        .setCustomId('ver_reporto')
        .setLabel('Piloto que Reportó')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const inputReportado = new TextInputBuilder()
        .setCustomId('ver_reportado')
        .setLabel('Piloto Reportado')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const inputDecision = new TextInputBuilder()
        .setCustomId('ver_decision')
        .setLabel('Decisión')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const inputSancion = new TextInputBuilder()
        .setCustomId('ver_sancion')
        .setLabel('Sanción Aplicada')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputId),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputReporto),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputReportado),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputDecision),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputSancion)
      );

      await interaction.showModal(modal);
      return;
    }    // Submit de Veredicto
    if (interaction.isModalSubmit() && interaction.customId === 'modal_veredicto_submit') {
      await interaction.deferReply({ ephemeral: true });

      const rawId = interaction.fields.getTextInputValue('ver_id').trim();
      const reportIdStr = rawId.padStart(3, '0');
      const pilotoReporto = interaction.fields.getTextInputValue('ver_reporto');
      const pilotoReportado = interaction.fields.getTextInputValue('ver_reportado');
      const decision = interaction.fields.getTextInputValue('ver_decision');
      const sancion = interaction.fields.getTextInputValue('ver_sancion');

      const CHANNEL_VEREDICTOS_ID = '1463096144900001854';
      const guild = interaction.guild;
      const roleGTCUP = guild?.roles.cache.find(r => r.name.toUpperCase() === 'GTCUP');
      const mentionGTCUP = roleGTCUP ? `<@&${roleGTCUP.id}>` : '@GTCUP';

      const embedVeredicto = new EmbedBuilder()
        .setColor('#0099FF') // Azul
        .setTitle(`⚖️ RESOLUCIÓN DE COMISARÍA 🆔 ${reportIdStr}`)
        .addFields(
          { name: 'PILOTO QUE REPORTÓ', value: pilotoReporto, inline: true },
          { name: 'PILOTO REPORTADO', value: pilotoReportado, inline: true },
          { name: 'DECISIÓN', value: decision, inline: false },
          { name: 'SANCIÓN', value: sancion, inline: false }
        )
        .setFooter({ text: 'REDLINE GT' })
        .setTimestamp();

      try {
        const canalVeredictos = await client.channels.fetch(CHANNEL_VEREDICTOS_ID) as TextChannel;
        if (canalVeredictos) {
          await canalVeredictos.send({
            content: `${mentionGTCUP}`,
            embeds: [embedVeredicto],
            allowedMentions: { parse: ['roles', 'users'] }
          });
          await interaction.editReply({ content: `✅ Veredicto para el reporte **${reportIdStr}** publicado con éxito en <#${CHANNEL_VEREDICTOS_ID}>.` });
        } else {
          await interaction.editReply({ content: '❌ No se pudo encontrar el canal de veredictos.' });
        }
      } catch (e) {
        console.error('Error al publicar el veredicto:', e);
        await interaction.editReply({ content: '❌ Ocurrió un error al intentar publicar el veredicto.' });
      }
      return;
          }
  

    // Botón Veredicto (para cuando lo pulses en el Dashboard)
    if (interaction.isButton() && interaction.customId === 'btn_abrir_veredicto') {
      const member = interaction.member as GuildMember;
      const isComisario = member?.roles.cache.some(r => r.name.toLowerCase().includes('comisario'));
      const isDireccion = member?.roles.cache.some(r => r.name.toLowerCase().includes('direccion'));

      if (!isComisario && !isDireccion) {
        await interaction.reply({ content: '❌ Solo **Dirección** y **Comisarios** pueden gestionar veredictos.', ephemeral: true });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_veredicto_submit')
        .setTitle('⚖️ RESOLUCIÓN DE COMISARÍA');

      const inputId = new TextInputBuilder()
        .setCustomId('ver_id')
        .setLabel('🆔 Reporte (ej: 005)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const inputReporto = new TextInputBuilder()
        .setCustomId('ver_reporto')
        .setLabel('Piloto que Reportó')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const inputReportado = new TextInputBuilder()
        .setCustomId('ver_reportado')
        .setLabel('Piloto Reportado')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const inputDecision = new TextInputBuilder()
        .setCustomId('ver_decision')
        .setLabel('Decisión')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const inputSancion = new TextInputBuilder()
        .setCustomId('ver_sancion')
        .setLabel('Sanción Aplicada')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputId),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputReporto),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputReportado),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputDecision),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputSancion)
      );

      await interaction.showModal(modal);
      return;
    }
  
  // Desplegable canal /embed
  if (interaction.isChannelSelectMenu() && interaction.customId === 'embed_select_channel') {
    creationSessions.set(interaction.user.id, { channelId: interaction.values[0] });
    await openEmbedFormModal(interaction);
    return;
  }

  // BOTONES
  if (interaction.isButton()) {

    // Sugerencia
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

    // Modal Reporte
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

    // Modal Defensa
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
          new TextInputBuilder().setCustomId('def_enlace').setLabel('ENLACE DE VIDEO (OPCIONAL)').setStyle(TextInputStyle.Short).setPlaceholder('https://...').setRequired(false)
        )
      );

      await interaction.showModal(modal);
      return;
    }

    // Botones /embed
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

  // MODALES SUBMIT
  if (interaction.isModalSubmit()) {

    // 1. Submit Reporte
    if (interaction.customId === 'modal_reporte_submit') {
      await interaction.deferReply({ ephemeral: true });

      const jornada = interaction.fields.getTextInputValue('rep_jornada');
      const pilotoReporta = interaction.fields.getTextInputValue('rep_reporta');
      const pilotoReportado = interaction.fields.getTextInputValue('rep_reportado');
      const explicacion = interaction.fields.getTextInputValue('rep_explicacion');
      const enlace = interaction.fields.getTextInputValue('rep_enlace');

      if (!enlace.startsWith('http://') && !enlace.startsWith('https://')) {
        await interaction.editReply({ content: '❌ El enlace debe comenzar con `http://` o `https://`.' });
        return;
      }

      let reportIdStr = '001';
      try {
        const canalHilos = await client.channels.fetch(CHANNEL_HILOS_ID) as TextChannel;
        if (canalHilos) {
          const activeThreads = await canalHilos.threads.fetchActive();
          const archivedThreads = await canalHilos.threads.fetchArchived();
          
          const totalThreadsCount = activeThreads.threads.size + archivedThreads.threads.size;
          const nextIdNumber = totalThreadsCount + 1;
          reportIdStr = String(nextIdNumber).padStart(3, '0');
        }
      } catch (e) {
        console.error('Error al obtener hilos para la numeración:', e);
      }

      const guild = interaction.guild;
      const roleGTCUP = guild?.roles.cache.find(r => r.name.toUpperCase() === 'GTCUP');
      const roleComisario = guild?.roles.cache.find(r => r.name.toLowerCase().includes('comisario'));

      const mentionGTCUP = roleGTCUP ? `<@&${roleGTCUP.id}>` : '@GTCUP';
      const mentionComisario = roleComisario ? `<@&${roleComisario.id}>` : '@Comisario';

      const embedReporte = new EmbedBuilder()
        .setColor('#0000FF')
        .setTitle(`🆔 ${reportIdStr}`)
        .addFields(
          { name: 'JORNADA', value: jornada, inline: false },
          { name: 'PILOTO QUE REPORTA', value: pilotoReporta, inline: false },
          { name: 'PILOTO REPORTADO', value: pilotoReportado, inline: false },
          { name: 'EXPLICACIÓN', value: explicacion, inline: false },
          { name: 'ENLACE', value: enlace, inline: false }
        )
        .setFooter({ text: 'REDLINE GT' })
        .setTimestamp();

      // PUBLICAR EN CANAL PÚBLICO (1469654237519810687) -> Mención GTCUP + EMBED AZUL
      try {
        const canalReportes = await client.channels.fetch(CHANNEL_REPORTES_ID) as TextChannel;
        if (canalReportes) {
          await canalReportes.send({
            content: `${mentionGTCUP}`,
            embeds: [embedReporte],
            allowedMentions: { parse: ['roles', 'users'] }
          });
        }
      } catch (e) {
        console.error('Error al enviar reporte al canal público:', e);
      }

      // CREAR HILO Y ENVIAR -> Mención Comisario + EMBED AZUL
      try {
        const canalHilos = await client.channels.fetch(CHANNEL_HILOS_ID) as TextChannel;
        if (canalHilos) {
          const thread = await canalHilos.threads.create({
            name: reportIdStr,
            autoArchiveDuration: 1440,
            reason: `Hilo para el reporte ${reportIdStr}`
          });

          await thread.send({
            content: `${mentionComisario}`,
            embeds: [embedReporte],
            allowedMentions: { parse: ['roles', 'users'] }
          });
        }
      } catch (e) {
        console.error('Error al crear el hilo:', e);
      }
      await interaction.editReply({ content: `✅ Reporte **${reportIdStr}** registrado con éxito.` });
      return;
    }
    // 2. Submit Defensa
    if (interaction.customId === 'modal_defensa_submit') {
      await interaction.deferReply({ ephemeral: true });

      const rawId = interaction.fields.getTextInputValue('def_id').trim();
      const reportIdStr = rawId.padStart(3, '0');
      const pilotoDefensa = interaction.fields.getTextInputValue('def_defiende');
      const pilotoReporto = interaction.fields.getTextInputValue('def_reporto');
      const explicacion = interaction.fields.getTextInputValue('def_explicacion');
      const rawEnlace = interaction.fields.getTextInputValue('def_enlace');
      const enlace = rawEnlace && rawEnlace.trim() !== '' ? rawEnlace.trim() : 'No aportado';

      if (enlace !== 'No aportado' && !enlace.startsWith('http://') && !enlace.startsWith('https://')) {
        await interaction.editReply({ content: '❌ El enlace debe comenzar con `http://` o `https://`.' });
        return;
      }

      // Buscar roles para las menciones
      const guild = interaction.guild;
      const roleGTCUP = guild?.roles.cache.find(r => r.name.toUpperCase() === 'GTCUP');
      const roleComisario = guild?.roles.cache.find(r => r.name.toLowerCase().includes('comisario'));

      const mentionGTCUP = roleGTCUP ? `<@&${roleGTCUP.id}>` : '@GTCUP';
      const mentionComisario = roleComisario ? `<@&${roleComisario.id}>` : '@Comisario';

      const embedDefensa = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle(`🛡️ DEFENSA A REPORTE 🆔 ${reportIdStr}`)
        .addFields(
          { name: 'PILOTO EN DEFENSA', value: pilotoDefensa, inline: false },
          { name: 'PILOTO QUE REPORTÓ', value: pilotoReporto, inline: false },
          { name: 'EXPLICACIÓN', value: explicacion, inline: false },
          { name: 'ENLACE DE VIDEO', value: enlace, inline: false }
        )
        .setFooter({ text: 'REDLINE GT' })
        .setTimestamp();

      // PUBLICAR EN CANAL PÚBLICO (1469654237519810687) -> Mención GTCUP + EMBED VERDE
      try {
        const canalReportes = await client.channels.fetch(CHANNEL_REPORTES_ID) as TextChannel;
        if (canalReportes) {
          await canalReportes.send({
            content: `${mentionGTCUP}`,
            embeds: [embedDefensa],
            allowedMentions: { parse: ['roles', 'users'] }
          });
        }
      } catch (e) {
        console.error('Error al publicar defensa en canal público:', e);
      }

      // BUSCAR HILO CORRESPONDIENTE Y REENVIAR -> Mención Comisario + EMBED VERDE
      try {
        const canalHilos = await client.channels.fetch(CHANNEL_HILOS_ID) as TextChannel;
        if (canalHilos) {
          const activeThreads = await canalHilos.threads.fetchActive();
          let targetThread = activeThreads.threads.find(t => t.name === reportIdStr);

          if (!targetThread) {
            const archivedThreads = await canalHilos.threads.fetchArchived();
            targetThread = archivedThreads.threads.find(t => t.name === reportIdStr);
          }

          if (targetThread) {
            await targetThread.send({
              content: `${mentionComisario}`,
              embeds: [embedDefensa],
              allowedMentions: { parse: ['roles', 'users'] }
            });
          }
        }
      } catch (e) {
        console.error('Error al reenviar la defensa al hilo:', e);
      }

      await interaction.editReply({ content: `✅ Defensa para el reporte **${reportIdStr}** enviada correctamente.` });
      return;
           }
    

    // Modal Step 1 /embed
    if (interaction.customId === 'modal_embed_step1') {
      const textContent = interaction.fields.getTextInputValue('embed_text');
      const rawDateTime = interaction.fields.getTextInputValue('embed_datetime');
      const timestamp = parseDateTime(rawDateTime);

      if (!timestamp || isNaN(timestamp)) {
        await interaction.reply({ content: '❌ Formato de fecha incorrecto. Debe ser: `DD/MM/AAAA HH:MM`.', ephemeral: true });
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

      await interaction.reply({ content: '¿Deseas que esta publicación se repita de forma periódica?', components: [row], ephemeral: true });
      return;
    }

    // Modal Repetición /embed
    if (interaction.customId === 'modal_embed_repeat_details') {
      const intervalDays = parseInt(interaction.fields.getTextInputValue('embed_interval'), 10);
      const repetitions = parseInt(interaction.fields.getTextInputValue('embed_reps'), 10);

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
});

// Vista previa /embed
async function showEmbedPreviewAndConfirm(interaction: any) {
  const session = creationSessions.get(interaction.user.id);
  if (!session) return;

  const previewEmbed = new EmbedBuilder()
    .setColor('#FF0000')
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
    new ButtonBuilder().setCustomId('embed_confirm_final').setLabel('PUBLICAR').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('embed_edit_btn').setLabel('EDITAR').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('embed_cancel_btn').setLabel('CANCELAR').setStyle(ButtonStyle.Danger)
  );

  if (interaction.isModalSubmit()) {
    await interaction.reply({ content: resumenInfo, embeds: [previewEmbed], components: [actionRow], ephemeral: true });
  } else {
    await interaction.update({ content: resumenInfo, embeds: [previewEmbed], components: [actionRow] });
  }
}

// Iniciar sesión
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('ERROR: No se ha encontrado la variable DISCORD_TOKEN');
} else {
  client.login(token);
                                   }
          
