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

        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(timeStr)) return null;
        if (!day || month < 1 || month > 12 || year < 2000 || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
        const calendarCheck = new Date(Date.UTC(year, month - 1, day));
        if (calendarCheck.getUTCFullYear() !== year || calendarCheck.getUTCMonth() !== month - 1 || calendarCheck.getUTCDate() !== day) return null;

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

            // Administración de trabajos ya guardados: solo se editan los pendientes.
            if (customId.startsWith('sched_job_edit_')) {
                const jobId = customId.slice('sched_job_edit_'.length);
                if (!ObjectId.isValid(jobId) || !interaction.guildId) return true;
                const { jobs } = await getSchedCollections();
                const job = await jobs.findOne({ _id: new ObjectId(jobId), guildId: interaction.guildId, status: 'pending' });
                if (!job) {
                    await interaction.reply({ content: '⚠️ Este registro ya no está pendiente o no existe. Actualiza el historial.', flags: [MessageFlags.Ephemeral] });
                    return true;
                }
                scheduledSessions.set(interaction.user.id, { editJobId: jobId, guildId: interaction.guildId });
                const modal = new ModalBuilder().setCustomId('modal_sched_job_content').setTitle('Editar mensaje pendiente');
                const textInput = new TextInputBuilder().setCustomId('job_text').setLabel('Texto del mensaje').setStyle(TextInputStyle.Paragraph).setValue(String(job.text || '').slice(0, 4000)).setRequired(true);
                const imageInput = new TextInputBuilder().setCustomId('job_image').setLabel('URL de imagen (vacío = quitar)').setStyle(TextInputStyle.Short).setValue(String(job.image || '').slice(0, 400)).setRequired(false);
                const dateInput = new TextInputBuilder().setCustomId('job_date').setLabel('Fecha DD/MM/AAAA').setStyle(TextInputStyle.Short).setValue(String(job.date || '')).setRequired(true);
                const timeInput = new TextInputBuilder().setCustomId('job_time').setLabel('Hora HH:MM (Madrid)').setStyle(TextInputStyle.Short).setValue(String(job.time || '')).setRequired(true);
                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(textInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput)
                );
                await interaction.showModal(modal);
                return true;
            }

            if (customId.startsWith('sched_job_delete_')) {
                const jobId = customId.slice('sched_job_delete_'.length);
                if (!ObjectId.isValid(jobId) || !interaction.guildId) return true;
                const { jobs } = await getSchedCollections();
                const result = await jobs.deleteOne({ _id: new ObjectId(jobId), guildId: interaction.guildId });
                await interaction.update({ content: result.deletedCount ? '✅ Registro eliminado.' : '⚠️ El registro ya no existe.', embeds: [], components: [] });
                return true;
            }

            if (customId.startsWith('sched_job_channel_')) {
                const jobId = customId.slice('sched_job_channel_'.length);
                if (!ObjectId.isValid(jobId) || !interaction.guildId) return true;
                scheduledSessions.set(interaction.user.id, { editJobId: jobId, guildId: interaction.guildId });
                const menu = new ChannelSelectMenuBuilder().setCustomId('sched_job_channel_select').setPlaceholder('Selecciona el nuevo canal...').addChannelTypes(ChannelType.GuildText);
                await interaction.reply({ content: '📢 Selecciona el canal de destino. Solo se actualizará si el mensaje sigue pendiente.', components: [new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(menu)], flags: [MessageFlags.Ephemeral] });
                return true;
            }

            if (customId.startsWith('sched_job_role_')) {
                const jobId = customId.slice('sched_job_role_'.length);
                if (!ObjectId.isValid(jobId) || !interaction.guildId) return true;
                scheduledSessions.set(interaction.user.id, { editJobId: jobId, guildId: interaction.guildId });
                const menu = new RoleSelectMenuBuilder().setCustomId('sched_job_role_select').setPlaceholder('Selecciona el rol que se mencionará...');
                const clear = new ButtonBuilder().setCustomId('sched_job_role_clear').setLabel('Quitar mención de rol').setStyle(ButtonStyle.Secondary);
                await interaction.reply({ content: '🏷️ Selecciona un rol o quita la mención:', components: [new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(menu), new ActionRowBuilder<ButtonBuilder>().addComponents(clear)], flags: [MessageFlags.Ephemeral] });
                return true;
            }

            if (customId === 'sched_job_role_clear') {
                const session = scheduledSessions.get(interaction.user.id);
                if (!session?.editJobId || !session.guildId) return true;
                const { jobs } = await getSchedCollections();
                const result = await jobs.updateOne({ _id: new ObjectId(session.editJobId), guildId: session.guildId, status: 'pending' }, { $set: { roleId: null } });
                await interaction.update({ content: result.modifiedCount ? '✅ Mención de rol eliminada.' : '⚠️ El mensaje ya no está pendiente; no se modificó.', components: [] });
                return true;
            }

            if (customId.startsWith('sched_job_repeat_')) {
                const jobId = customId.slice('sched_job_repeat_'.length);
                if (!ObjectId.isValid(jobId) || !interaction.guildId) return true;
                const { jobs } = await getSchedCollections();
                const job = await jobs.findOne({ _id: new ObjectId(jobId), guildId: interaction.guildId, status: 'pending' });
                if (!job) {
                    await interaction.reply({ content: '⚠️ El mensaje ya no está pendiente.', flags: [MessageFlags.Ephemeral] });
                    return true;
                }
                scheduledSessions.set(interaction.user.id, { editJobId: jobId, guildId: interaction.guildId });
                const modal = new ModalBuilder().setCustomId('modal_sched_job_repeat').setTitle('Editar repetición');
                const days = new TextInputBuilder().setCustomId('job_repeat_days').setLabel('Intervalo en días').setStyle(TextInputStyle.Short).setValue(String(job.repeatIntervalDays ?? 0)).setRequired(true);
                const hours = new TextInputBuilder().setCustomId('job_repeat_hours').setLabel('Intervalo en horas').setStyle(TextInputStyle.Short).setValue(String(job.repeatIntervalHours ?? 0)).setRequired(true);
                const remaining = new TextInputBuilder().setCustomId('job_remaining').setLabel('Envíos restantes (1 = último envío)').setStyle(TextInputStyle.Short).setValue(String(job.remainingTimes ?? job.totalRepetitions ?? 1)).setRequired(true);
                modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(days), new ActionRowBuilder<TextInputBuilder>().addComponents(hours), new ActionRowBuilder<TextInputBuilder>().addComponents(remaining));
                await interaction.showModal(modal);
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
            if (interaction.customId === 'sched_job_select') {
                const jobId = interaction.values[0];
                if (!ObjectId.isValid(jobId) || !interaction.guildId) return true;
                const { jobs } = await getSchedCollections();
                const job = await jobs.findOne({ _id: new ObjectId(jobId), guildId: interaction.guildId });
                if (!job) {
                    await interaction.update({ content: '⚠️ Registro no encontrado.', embeds: [], components: [] });
                    return true;
                }
                const status = String(job.status || 'pending');
                const description = [
                    `**Estado:** ${status}`,
                    `**Fecha/hora:** ${job.date || 'N/D'} · ${job.time || 'N/D'} (Madrid)`,
                    `**Canal:** <#${job.channelId}>`,
                    `**Rol:** ${job.roleId ? '<@&' + job.roleId + '>' : 'Ninguno'}`,
                    `**Repetición:** ${job.repeats ? 'Sí' : 'No'} · intervalo ${job.repeatIntervalDays || 0} días / ${job.repeatIntervalHours || 0} horas`,
                    `**Envíos restantes:** ${job.remainingTimes ?? job.totalRepetitions ?? (job.repeats ? 'N/D' : 1)} · realizados: ${job.repetitionsDone || 0}`,
                    '',
                    '**Texto:**',
                    String(job.text || '[Sin texto]').slice(0, 2500)
                ].join('\n');
                const embed = new EmbedBuilder().setColor(0x00AAFF).setTitle('📋 Detalle del mensaje guardado').setDescription(description);
                if (job.image) embed.setImage(job.image);
                const rows: any[] = [];
                if (status === 'pending') {
                    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder().setCustomId(`sched_job_edit_${jobId}`).setLabel('Editar texto y fecha').setStyle(ButtonStyle.Primary).setEmoji('📝'),
                        new ButtonBuilder().setCustomId(`sched_job_channel_${jobId}`).setLabel('Cambiar canal').setStyle(ButtonStyle.Secondary).setEmoji('📢'),
                        new ButtonBuilder().setCustomId(`sched_job_role_${jobId}`).setLabel('Cambiar rol').setStyle(ButtonStyle.Secondary).setEmoji('🏷️')
                    ));
                    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder().setCustomId(`sched_job_repeat_${jobId}`).setLabel('Editar repetición').setStyle(ButtonStyle.Secondary).setEmoji('🔁'),
                        new ButtonBuilder().setCustomId(`sched_job_delete_${jobId}`).setLabel('Borrar').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
                    ));
                } else {
                    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder().setCustomId(`sched_job_delete_${jobId}`).setLabel('Borrar registro').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
                    ));
                }
                await interaction.update({ content: '', embeds: [embed], components: rows });
                return true;
            }
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
