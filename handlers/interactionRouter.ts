import { 
    ButtonInteraction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ChannelSelectMenuBuilder, 
    RoleSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    ModalSubmitInteraction, 
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    MessageFlags
} from 'discord.js';
import { MongoClient as MongoDriver, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const client = new MongoDriver(uri);

let schedTemplatesCollection: any = null;
let scheduledJobsCollection: any = null;

async function getSchedCollections() {
    if (!schedTemplatesCollection || !scheduledJobsCollection) {
        await client.connect();
        const db = client.db('redline_bot');
        schedTemplatesCollection = db.collection('scheduled_templates');
        scheduledJobsCollection = db.collection('scheduled_messages');
        console.log('⏰ [MongoDB] Conectado al sistema de plantillas y mensajes programados (Interaction).');
    }
    return { templates: schedTemplatesCollection, jobs: scheduledJobsCollection };
}

const scheduledSessions = new Map<string, any>();

// 🌍 Funciones de hora de Madrid
function parseMadridDateTime(dateStr: string, timeStr: string): Date | null {
    try {
        const [day, month, year] = dateStr.split('/').map(Number);
        const [hour, minute] = timeStr.split(':').map(Number);

        if (!day || !month || !year || isNaN(hour) || isNaN(minute)) return null;

        const targetString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`;
        const tempDate = new Date(targetString);
        if (isNaN(tempDate.getTime())) return null;

        const madridOffsetMinutes = getMadridOffsetMinutes(tempDate);
        const finalTimestamp = tempDate.getTime() - (madridOffsetMinutes * 60 * 1000);

        const targetDate = new Date(finalTimestamp);
        return isNaN(targetDate.getTime()) ? null : targetDate;
    } catch (error) {
        console.error('❌ Error al parsear fecha y hora de Madrid:', error);
        return null;
    }
}

function getMadridOffsetMinutes(date: Date): number {
    const madridDateStr = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Madrid',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(date);

    const [datePart, timePart] = madridDateStr.split(', ');
    const [m, d, y] = datePart.split('/').map(Number);
    const [h, min] = timePart.split(':').map(Number);

    const asUTC = Date.UTC(y, m - 1, d, h, min, 0);
    const diffMs = asUTC - date.getTime();
    return Math.round(diffMs / (1000 * 60));
}

// 🛡️ ENRUTADOR PRINCIPAL DEL MÓDULO SCHEDULED
export async function handleScheduledInteraction(interaction: any): Promise<boolean> {
    try {
        // --- 1. BOTONES ---
        if (interaction.isButton()) {
            const customId = interaction.customId;

            if (customId === 'dash_btn_scheduled_msg') {
                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId('sched_btn_new').setLabel('Crear Nuevo Mensaje').setStyle(ButtonStyle.Success).setEmoji('➕'),
                    new ButtonBuilder().setCustomId('sched_btn_existing').setLabel('Usar Mensaje Existente').setStyle(ButtonStyle.Primary).setEmoji('📂')
                );

                await interaction.reply({
                    content: '📅 **Sistema de Mensajes Programados**\n¿Qué deseas hacer con tus plantillas de mensajes?',
                    components: [row],
                    flags: [MessageFlags.Ephemeral]
                });
                return true;
            }

            if (customId === 'sched_btn_new') {
                scheduledSessions.set(interaction.user.id, {});

                const modal = new ModalBuilder()
                    .setCustomId('modal_sched_new')
                    .setTitle('Crear Plantilla de Mensaje');

                const titleInput = new TextInputBuilder()
                    .setCustomId('sched_title_input')
                    .setLabel('Título / Identificador interno')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Ej: Aviso de Carrera, Sanciones...')
                    .setRequired(true);

                const contentInput = new TextInputBuilder()
                    .setCustomId('sched_content_input')
                    .setLabel('Contenido del mensaje')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Escribe el texto que enviará el bot...')
                    .setRequired(true);

                const imageInput = new TextInputBuilder()
                    .setCustomId('sched_image_input')
                    .setLabel('URL de la imagen (Opcional)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('https://... (dejar en blanco si no hay)')
                    .setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(contentInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput)
                );

                await interaction.showModal(modal);
                return true;
            }

            if (customId === 'sched_btn_existing') {
                if (!interaction.guildId) return true;

                const { templates } = await getSchedCollections();
                const allTemplates = await templates.find({ guildId: interaction.guildId }).toArray();

                if (allTemplates.length === 0) {
                    await interaction.update({
                        content: '❌ No hay ninguna plantilla de mensaje guardada todavía. ¡Crea una nueva!',
                        components: []
                    });
                    return true;
                }

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('sched_select_existing')
                    .setPlaceholder('📂 Selecciona una plantilla guardada...')
                    .addOptions(allTemplates.map(t => ({
                        label: t.title.substring(0, 100),
                        description: (t.content ? t.content.substring(0, 90) : '') + '...',
                        value: t._id.toString()
                    })));

                const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

                await interaction.update({
                    content: '📂 **Selecciona la plantilla que deseas programar o editar:**',
                    components: [row]
                });
                return true;
            }

            if (customId.startsWith('sched_action_edit_')) {
                const templateId = customId.replace('sched_action_edit_', '');
                const { templates } = await getSchedCollections();
                const template = await templates.findOne({ _id: new ObjectId(templateId) });
                if (!template) return true;

                scheduledSessions.set(interaction.user.id, { templateId });

                const modal = new ModalBuilder()
                    .setCustomId('modal_sched_edit')
                    .setTitle('Editar Plantilla');

                const titleInput = new TextInputBuilder()
                    .setCustomId('sched_title_input')
                    .setLabel('Título / Identificador')
                    .setStyle(TextInputStyle.Short)
                    .setValue(template.title)
                    .setRequired(true);

                const contentInput = new TextInputBuilder()
                    .setCustomId('sched_content_input')
                    .setLabel('Contenido del mensaje')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(template.content || '')
                    .setRequired(true);

                const imageInput = new TextInputBuilder()
                    .setCustomId('sched_image_input')
                    .setLabel('URL de la imagen (Opcional)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(template.image || '')
                    .setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(contentInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput)
                );

                await interaction.showModal(modal);
                return true;
            }

            if (customId.startsWith('sched_action_delete_')) {
                const templateId = customId.replace('sched_action_delete_', '');
                const { templates } = await getSchedCollections();
                await templates.deleteOne({ _id: new ObjectId(templateId) });

                await interaction.update({
                    content: '✅ **¡Plantilla borrada de la base de datos con éxito!**',
                    embeds: [],
                    components: []
                });
                return true;
            }

            if (customId.startsWith('sched_action_schedule_')) {
                const templateId = customId.replace('sched_action_schedule_', '');
                const { templates } = await getSchedCollections();
                const template = await templates.findOne({ _id: new ObjectId(templateId) });
                if (!template) return true;

                const session = scheduledSessions.get(interaction.user.id) || {};
                session.templateId = templateId;
                session.text = template.content;
                session.image = template.image || null;
                scheduledSessions.set(interaction.user.id, session);

                const selectChannel = new ChannelSelectMenuBuilder()
                    .setCustomId('sched_select_channel')
                    .setPlaceholder('📢 Selecciona el canal donde se enviará el mensaje...')
                    .addChannelTypes(ChannelType.GuildText);

                const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectChannel);

                await interaction.update({
                    content: '📢 **Paso 1/3:** Selecciona el canal de destino para este mensaje:',
                    embeds: [],
                    components: [row]
                });
                return true;
            }

            if (customId === 'sched_skip_role') {
                const session = scheduledSessions.get(interaction.user.id) || {};
                session.roleId = null;
                scheduledSessions.set(interaction.user.id, session);

                const modal = new ModalBuilder()
                    .setCustomId('modal_sched_datetime')
                    .setTitle('Fecha y Hora de Envío');

                const dateInput = new TextInputBuilder()
                    .setCustomId('sched_date')
                    .setLabel('Fecha de envío (DD/MM/YYYY)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Ej: 15/10/2026')
                    .setRequired(true);

                const timeInput = new TextInputBuilder()
                    .setCustomId('sched_time')
                    .setLabel('Hora peninsular (Formato 24h HH:MM)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Ej: 21:30')
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput)
                );

                await interaction.showModal(modal);
                return true;
            }

            if (customId === 'sched_repeat_no') {
                const session = scheduledSessions.get(interaction.user.id);
                if (!session) {
                    await interaction.update({ content: '❌ Sesión caducada.', components: [], embeds: [] });
                    return true;
                }

                try {
                    const { jobs } = await getSchedCollections();
                    await jobs.insertOne({
                        guildId: interaction.guildId,
                        userId: interaction.user.id,
                        text: session.text,
                        image: session.image || null,
                        channelId: session.channelId,
                        roleId: session.roleId || null,
                        date: session.date,
                        time: session.time,
                        scheduledAt: session.scheduledAt,
                        repeats: false,
                        status: 'pending',
                        createdAt: new Date()
                    });

                    scheduledSessions.delete(interaction.user.id);

                    await interaction.update({
                        content: `✅ **¡Mensaje programado con éxito!**\nSe enviará el **${session.date}** a las **${session.time}** (hora peninsular).`,
                        components: [],
                        embeds: []
                    });
                } catch (error) {
                    console.error('❌ Error al guardar mensaje programado:', error);
                    await interaction.update({ content: '❌ Hubo un error al guardar en MongoDB.', components: [] });
                }
                return true;
            }

            if (customId === 'sched_repeat_yes') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_sched_repeat')
                    .setTitle('Configurar Frecuencia de Repetición');

                const daysInput = new TextInputBuilder()
                    .setCustomId('sched_repeat_days')
                    .setLabel('¿Cada cuántos días?')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Ej: 7 (Opcional)')
                    .setRequired(false);

                const hoursInput = new TextInputBuilder()
                    .setCustomId('sched_repeat_hours')
                    .setLabel('¿Cada cuántas horas?')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Ej: 1 (Opcional)')
                    .setRequired(false);

                const timesInput = new TextInputBuilder()
                    .setCustomId('sched_repeat_times')
                    .setLabel('Nº de repeticiones (contando el 1º)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Ej: 2 (Mínimo 2)')
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(daysInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(hoursInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(timesInput)
                );

                await interaction.showModal(modal);
                return true;
            }
        }

        // --- 2. STRING SELECT MENUS ---
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'sched_select_existing') {
                const templateId = interaction.values[0];
                const { templates } = await getSchedCollections();
                const template = await templates.findOne({ _id: new ObjectId(templateId) });

                if (!template) {
                    await interaction.update({ content: '❌ Plantilla no encontrada.', components: [] });
