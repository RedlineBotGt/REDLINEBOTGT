import { 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    EmbedBuilder,
    MessageFlags 
} from 'discord.js';
import { MongoClient as MongoDriver } from 'mongodb';
import { handleScheduledActions } from './interactionscheduledactions';

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || process.env.MONGO_URL || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const client = new MongoDriver(uri);

let schedTemplatesCollection: any = null;
let scheduledJobsCollection: any = null;

export async function getSchedCollections() {
    if (!schedTemplatesCollection || !scheduledJobsCollection) {
        await client.connect();
        const db = client.db('redline_bot');
        schedTemplatesCollection = db.collection('scheduled_templates');
        scheduledJobsCollection = db.collection('scheduled_messages');
        console.log('⏰ [MongoDB] Conectado al sistema de plantillas y mensajes programados (Interaction).');
    }
    return { templates: schedTemplatesCollection, jobs: scheduledJobsCollection };
}

export const scheduledSessions = new Map<string, any>();

export async function handleScheduledInteractions(interaction: any): Promise<boolean> {
    try {
        // --- 1. BOTONES PRINCIPALES DE ENTRADA ---
        if (interaction.isButton()) {
            const customId = interaction.customId;

            if (customId === 'dash_btn_scheduled_msg') {
                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId('sched_btn_new').setLabel('Crear Nuevo').setStyle(ButtonStyle.Success).setEmoji('➕'),
                    new ButtonBuilder().setCustomId('sched_btn_existing').setLabel('Usar Plantilla').setStyle(ButtonStyle.Primary).setEmoji('📂'),
                    new ButtonBuilder().setCustomId('sched_btn_list').setLabel('Ver Historial / Programados').setStyle(ButtonStyle.Secondary).setEmoji('📋')
                );

                await interaction.reply({
                    content: '📅 **Sistema de Mensajes Programados**\n¿Qué deseas hacer?',
                    components: [row],
                    flags: [MessageFlags.Ephemeral]
                });
                return true;
            }

                        if (customId === 'sched_btn_list') {
                if (!interaction.guildId) return true;

                const { jobs } = await getSchedCollections();
                const allJobs = await jobs.find({ guildId: interaction.guildId }).toArray();

                if (allJobs.length === 0) {
                    await interaction.reply({
                        content: '❌ No hay ningún registro de mensajes en la base de datos para este servidor.',
                        flags: [MessageFlags.Ephemeral]
                    });
                    return true;
                }

                const embed = new EmbedBuilder()
                    .setColor(0x00AAFF)
                    .setTitle('📋 Historial Completo de Mensajes Programados')
                    .setDescription(`Se encontraron **${allJobs.length}** registro(s) en total:`)
                    .setTimestamp();

                allJobs.forEach((job: any, index: number) => {
                    const previewText = job.text ? job.text.substring(0, 45) + '...' : '[Sin texto]';
                    let statusEmoji = '⏳ Pendiente';
                    if (job.status === 'sent') statusEmoji = '✅ Enviado';
                    else if (job.status) statusEmoji = `📌 ${job.status}`;

                    embed.addFields({
                        name: `🆔 Trabajo #${index + 1} [${statusEmoji}]`,
                        value: `📢 Canal: <#${job.channelId}>\n📅 Fecha: **${job.date || 'N/A'} a las ${job.time || 'N/A'}**\n💬 Texto: *${previewText}*\n🔄 Repite: ${job.repeats ? 'Sí' : 'No'}`,
                        inline: false
                    });
                });

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('sched_delete_job_select')
                    .setPlaceholder('🗑️ Selecciona un registro para borrarlo...')
                    .addOptions(allJobs.map((job: any, index: number) => ({
                        label: `Borrar #${index + 1} (${job.date || 'S/F'} - ${job.status || 'pend.'})`,
                        description: (job.text ? job.text.substring(0, 75) : 'Sin texto'),
                        value: job._id.toString()
                    })));

                const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

                await interaction.reply({
                    embeds: [embed],
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
        }

        // --- 2. DELEGAR EL RESTO DE ACCIONES A LA PARTE 2 ---
        const handledByActions = await handleScheduledActions(interaction);
        if (handledByActions) return true;

        return false;
    } catch (error) {
        console.error('❌ Error en el enrutador principal de Scheduled:', error);
        return false;
    }
}
import { 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ChannelSelectMenuBuilder, 
    RoleSelectMenuBuilder, 
    ChannelType, 
    EmbedBuilder,
    MessageFlags 
} from 'discord.js';
import { ObjectId } from 'mongodb';
import { getSchedCollections, scheduledSessions } from './interactionscheduled';

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

        return new Date(finalTimestamp);
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

export async function handleScheduledActions(interaction: any): Promise<boolean> {
    try {
        if (interaction.isButton()) {
            const customId = interaction.customId;

            if (customId.startsWith('sched_action_edit_')) {
                const templateId = customId.replace('sched_action_edit_', '');
                const { templates } = await getSchedCollections();
                const template = await templates.findOne({ _id: new ObjectId(templateId) });
                if (!template) return true;

                scheduledSessions.set(interaction.user.id, { templateId });

                const modal = new ModalBuilder()
                    .setCustomId('modal_sched_edit')
                    .setTitle('Editar Plantilla');

                const titleInput = new TextInputBuilder().setCustomId('sched_title_input').setLabel('Título').setStyle(TextInputStyle.Short).setValue(template.title).setRequired(true);
                const contentInput = new TextInputBuilder().setCustomId('sched_content_input').setLabel('Contenido').setStyle(TextInputStyle.Paragraph).setValue(template.content || '').setRequired(true);
                const imageInput = new TextInputBuilder().setCustomId('sched_image_input').setLabel('URL Imagen').setStyle(TextInputStyle.Short).setValue(template.image || '').setRequired(false);

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

                await interaction.update({ content: '✅ **¡Plantilla borrada con éxito!**', embeds: [], components: [] });
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
                    .setPlaceholder('📢 Selecciona el canal...')
                    .addChannelTypes(ChannelType.GuildText);

                const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectChannel);
                await interaction.update({ content: '📢 **Paso 1/3:** Selecciona el canal de destino:', embeds: [], components: [row] });
                return true;
            }

            if (customId === 'sched_skip_role') {
                const session = scheduledSessions.get(interaction.user.id) || {};
                session.roleId = null;
                scheduledSessions.set(interaction.user.id, session);

                const modal = new ModalBuilder().setCustomId('modal_sched_datetime').setTitle('Fecha y Hora de Envío');
                const dateInput = new TextInputBuilder().setCustomId('sched_date').setLabel('Fecha (DD/MM/YYYY)').setStyle(TextInputStyle.Short).setPlaceholder('15/10/2026').setRequired(true);
                const timeInput = new TextInputBuilder().setCustomId('sched_time').setLabel('Hora (HH:MM)').setStyle(TextInputStyle.Short).setPlaceholder('21:30').setRequired(true);

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
                await interaction.update({ content: `✅ **¡Programado con éxito!** Se enviará el **${session.date}** a las **${session.time}**.`, components: [], embeds: [] });
                return true;
            }

            if (customId === 'sched_repeat_yes') {
                const modal = new ModalBuilder().setCustomId('modal_sched_repeat').setTitle('Repetición');
                const daysInput = new TextInputBuilder().setCustomId('sched_repeat_days').setLabel('¿Cada cuántos días?').setStyle(TextInputStyle.Short).setRequired(false);
                const hoursInput = new TextInputBuilder().setCustomId('sched_repeat_hours').setLabel('¿Cada cuántas horas?').setStyle(TextInputStyle.Short).setRequired(false);
                const timesInput = new TextInputBuilder().setCustomId('sched_repeat_times').setLabel('Nº repeticiones').setStyle(TextInputStyle.Short).setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(daysInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(hoursInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(timesInput)
                );
                await interaction.showModal(modal);
                return true;
            }
        }

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'sched_select_existing') {
                const templateId = interaction.values[0];
                const { templates } = await getSchedCollections();
                const template = await templates.findOne({ _id: new ObjectId(templateId) });
                if (!template) return true;

                scheduledSessions.set(interaction.user.id, { templateId, text: template.content, image: template.image || null });

                const embed = new EmbedBuilder().setColor(0x00AAFF).setTitle(`📄 ${template.title}`).setDescription(template.content || '');
                if (template.image) embed.setImage(template.image);

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId(`sched_action_schedule_${templateId}`).setLabel('Programar').setStyle(ButtonStyle.Success).setEmoji('⏰'),
                    new ButtonBuilder().setCustomId(`sched_action_edit_${templateId}`).setLabel('Editar').setStyle(ButtonStyle.Secondary).setEmoji('📝'),
                    new ButtonBuilder().setCustomId(`sched_action_delete_${templateId}`).setLabel('Borrar').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
                );

                await interaction.update({ content: `📄 **Plantilla:** \`${template.title}\``, embeds: [embed], components: [row] });
                return true;
            }

            if (interaction.customId === 'sched_delete_job_select') {
                const jobId = interaction.values[0];
                const { jobs } = await getSchedCollections();
                await jobs.deleteOne({ _id: new ObjectId(jobId) });
                await interaction.update({ content: '✅ **¡Registro borrado!**', embeds: [], components: [] });
                return true;
            }
        }

        if (interaction.isChannelSelectMenu()) {
            if (interaction.customId === 'sched_select_channel') {
                const session = scheduledSessions.get(interaction.user.id);
                if (!session) return true;
                session.channelId = interaction.values[0];
                scheduledSessions.set(interaction.user.id, session);

                const selectRole = new RoleSelectMenuBuilder().setCustomId('sched_select_role').setPlaceholder('🏷️ Rol a mencionar (Opcional)...');
                const rowRole = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(selectRole);
                const rowSkip = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('sched_skip_role').setLabel('Omitir').setStyle(ButtonStyle.Secondary));

                await interaction.update({ content: '🏷️ **Paso 2/3:** Selecciona un rol o pulsa Omitir:', components: [rowRole, rowSkip] });
                return true;
            }
        }

        if (interaction.isRoleSelectMenu()) {
            if (interaction.customId === 'sched_select_role') {
                const session = scheduledSessions.get(interaction.user.id);
                if (!session) return true;
                session.roleId = interaction.values[0];
                scheduledSessions.set(interaction.user.id, session);

                const modal = new ModalBuilder().setCustomId('modal_sched_datetime').setTitle('Fecha y Hora');
                const dateInput = new TextInputBuilder().setCustomId('sched_date').setLabel('Fecha (DD/MM/YYYY)').setStyle(TextInputStyle.Short).setRequired(true);
                const timeInput = new TextInputBuilder().setCustomId('sched_time').setLabel('Hora (HH:MM)').setStyle(TextInputStyle.Short).setRequired(true);

                modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput), new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput));
                await interaction.showModal(modal);
                return true;
            }
        }

        if (interaction.isModalSubmit()) {
            const customId = interaction.customId;

            if (customId === 'modal_sched_new' || customId === 'modal_sched_edit') {
                const title = interaction.fields.getTextInputValue('sched_title_input').trim();
                const content = interaction.fields.getTextInputValue('sched_content_input').trim();
                const image = interaction.fields.getTextInputValue('sched_image_input').trim() || null;
                const session = scheduledSessions.get(interaction.user.id) || {};
                const { templates } = await getSchedCollections();

                if (customId === 'modal_sched_new') {
                    await templates.insertOne({ guildId: interaction.guildId, userId: interaction.user.id, title, content, image, createdAt: new Date() });
                    await interaction.reply({ content: `✅ **¡Plantilla "${title}" creada!**`, flags: [MessageFlags.Ephemeral] });
                } else if (session.templateId) {
                    await templates.updateOne({ _id: new ObjectId(session.templateId) }, { $set: { title, content, image } });
                    scheduledSessions.delete(interaction.user.id);
                    await interaction.reply({ content: `✅ **¡Plantilla actualizada!**`, flags: [MessageFlags.Ephemeral] });
                }
                return true;
            }

            if (customId === 'modal_sched_datetime') {
                const session = scheduledSessions.get(interaction.user.id);
                if (!session) return true;

                const date = interaction.fields.getTextInputValue('sched_date').trim();
                const time = interaction.fields.getTextInputValue('sched_time').trim();
                const parsedDate = parseMadridDateTime(date, time);
                if (!parsedDate) {
                    await interaction.reply({ content: '❌ Formato de fecha u hora inválido. Usa `DD/MM/YYYY` y `HH:MM`.', flags: [MessageFlags.Ephemeral] });
                    return true;
                }

                session.date = date;
                session.time = time;
                session.scheduledAt = parsedDate;
                scheduledSessions.set(interaction.user.id, session);

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId('sched_repeat_yes').setLabel('Sí, repetir').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('sched_repeat_no').setLabel('No, único').setStyle(ButtonStyle.Success)
                );

                await interaction.reply({ content: '⏰ **Paso 3/3:** ¿Deseas que este mensaje se repita periódicamente?', components: [row], flags: [MessageFlags.Ephemeral] });
                return true;
            }

            if (customId === 'modal_sched_repeat') {
                const session = scheduledSessions.get(interaction.user.id);
                if (!session) return true;

                const repeatDays = parseInt(interaction.fields.getTextInputValue('sched_repeat_days').trim() || '0', 10);
                const repeatHours = parseInt(interaction.fields.getTextInputValue('sched_repeat_hours').trim() || '0', 10);
                const repeatTimes = parseInt(interaction.fields.getTextInputValue('sched_repeat_times').trim(), 10);

                if (isNaN(repeatTimes) || repeatTimes < 2) {
                    await interaction.reply({ content: '❌ Las repeticiones deben ser al menos 2.', flags: [MessageFlags.Ephemeral] });
                    return true;
                }

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
                    repeats: true,
                    repeatIntervalDays: repeatDays,
                    repeatIntervalHours: repeatHours,
                    totalRepetitions: repeatTimes,
                    remainingTimes: repeatTimes,
                    repetitionsDone: 0,
                    status: 'pending',
                    createdAt: new Date()
                });

                scheduledSessions.delete(interaction.user.id);
                await interaction.reply({ content: `✅ **¡Programado con repetición configurado!** Se enviará el **${session.date}** a las **${session.time}** (${repeatTimes} veces).`, flags: [MessageFlags.Ephemeral] });
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error('❌ Error en handleScheduledActions (Parte 2):', error);
        return false;
    }
}
