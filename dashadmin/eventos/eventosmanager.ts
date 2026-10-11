import { ObjectId } from 'mongodb';
import { 
    ButtonInteraction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ChannelSelectMenuBuilder, 
    ChannelType, 
    ModalSubmitInteraction, 
    MessageFlags,
    RoleSelectMenuBuilder,
    ButtonStyle,
    ButtonBuilder,
    TextChannel,
    EmbedBuilder,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder
} from 'discord.js';
import { getEventsCollection } from './eventosstorage';

export const eventSessions = new Map<string, any>();
export const adminAdminSessions = new Map<string, { targetUserId?: string; status?: string; eventMessageId: string }>();

// --- PARSER DE FECHAS MADRID (Con cálculo exacto de offset CET/CEST) ---
function parseMadridDateTime(dateStr: string, timeStr: string): Date | null {
    try {
        const [day, month, year] = dateStr.split('/').map(Number);
        const [hour, minute] = timeStr.split(':').map(Number);
        if (!day || !month || !year || isNaN(hour) || isNaN(minute)) return null;

        const tempUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
        const madridOffsetMinutes = getMadridOffsetMinutes(tempUtc);
        const finalTimestamp = tempUtc.getTime() - (madridOffsetMinutes * 60 * 1000);

        const targetDate = new Date(finalTimestamp);
        return isNaN(targetDate.getTime()) ? null : targetDate;
    } catch (error) {
        console.error('❌ Error al parsear fecha de Madrid:', error);
        return null;
    }
}

function getMadridOffsetMinutes(date: Date): number {
    const madridDateStr = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Madrid',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(date);

    const [datePart, timePart] = madridDateStr.split(', ');
    const [m, d, y] = datePart.split('/').map(Number);
    const [h, min] = timePart.split(':').map(Number);
    const asUTC = Date.UTC(y, m - 1, d, h, min, 0);
    const diffMs = asUTC - date.getTime();
    return Math.round(diffMs / (1000 * 60));
}

// --- PASO 1 y 2: Botón Dash inicial -> Borrador en MongoDB ---
export async function handleDashEventButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_event_create') return false;

    const col = await getEventsCollection();
    await col.updateOne(
        { userId: interaction.user.id, status: 'draft' },
        { 
            $set: { guildId: interaction.guildId, channelId: null, roleId: null, updatedAt: new Date() },$setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
    );

    const selectChannel = new ChannelSelectMenuBuilder()
        .setCustomId('event_select_channel')
        .setPlaceholder('📢 Selecciona el canal de publicación...')
        .addChannelTypes(ChannelType.GuildText);

    const selectRole = new RoleSelectMenuBuilder()
        .setCustomId('event_select_role')
        .setPlaceholder('🏷️ Selecciona el rol a mencionar...');

    const rowChannel = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectChannel);
    const rowRole = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(selectRole);
    const rowButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('event_proceed_to_modal')
            .setLabel('Continuar al Formulario')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('➡️')
    );

    await interaction.reply({
        content: '📅 **Organizador de Eventos:** Selecciona el canal y el rol en los menús desplegables y pulsa **Continuar**:',
        components: [rowChannel, rowRole, rowButton],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

export async function handleEventChannelSelect(interaction: any): Promise<boolean> {
    if (interaction.customId !== 'event_select_channel') return false;
    const col = await getEventsCollection();
    await col.updateOne(
        { userId: interaction.user.id, status: 'draft' },
        { $set: { channelId: interaction.values[0] } }
    );
    await interaction.deferUpdate();
    return true;
}

export async function handleEventRoleSelect(interaction: any): Promise<boolean> {
    if (interaction.customId !== 'event_select_role') return false;
    const col = await getEventsCollection();
    await col.updateOne(
        { userId: interaction.user.id, status: 'draft' },
        { $set: { roleId: interaction.values[0] } }
    );
    await interaction.deferUpdate();
    return true;
}

// --- PASO 3: Abrir Modal con Datos del Evento ---
export async function handleEventProceedToModal(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'event_proceed_to_modal') return false;

    const col = await getEventsCollection();
    const session = await col.findOne({ userId: interaction.user.id, status: 'draft' });
    if (!session || !session.channelId || !session.roleId) {
        await interaction.reply({ 
            content: '❌ Debes seleccionar tanto un **canal** como un **rol** en los menús antes de continuar.', 
            flags: [MessageFlags.Ephemeral] 
        });
        return true;
    }

    const modal = new ModalBuilder()
        .setCustomId('modal_event_create')
        .setTitle('📅 Detalles del Evento');

    const dateInput = new TextInputBuilder()
        .setCustomId('event_date')
        .setLabel('Día del evento (DD/MM/YYYY)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 25/06/2026')
        .setRequired(true);

    const timeInput = new TextInputBuilder()
        .setCustomId('event_time')
        .setLabel('Hora del evento CET (HH:MM)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 21:30')
        .setRequired(true);

    const titleInput = new TextInputBuilder()
        .setCustomId('event_title')
        .setLabel('Título del Evento')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: GP de España - GT3')
        .setRequired(true);

    const descInput = new TextInputBuilder()
        .setCustomId('event_desc')
        .setLabel('Descripción (Opcional)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Normativa, horarios, circuitos...')
        .setRequired(false);

    const imageInput = new TextInputBuilder()
        .setCustomId('event_image')
        .setLabel('URL de la imagen (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://...')
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput)
    );

    await interaction.showModal(modal);
    return true;
}

// --- PASO 4: Procesar Modal y Bifurcar (Publicar Ya / Programar) ---
export async function handleEventModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_event_create') return false;

    const col = await getEventsCollection();
    const session = await col.findOne({ userId: interaction.user.id, status: 'draft' });
    if (!session) {
        await interaction.reply({ content: '❌ Sesión caducada.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const date = interaction.fields.getTextInputValue('event_date').trim();
    const time = interaction.fields.getTextInputValue('event_time').trim();
    const title = interaction.fields.getTextInputValue('event_title').trim();
    const description = interaction.fields.getTextInputValue('event_desc').trim() || 'Sin descripción detallada.';
    const image = interaction.fields.getTextInputValue('event_image').trim() || null;

    const scheduledAt = parseMadridDateTime(date, time);
    if (!scheduledAt) {
        await interaction.reply({ content: '❌ Formato de fecha u hora inválido (Usa DD/MM/YYYY y HH:MM).', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    await col.updateOne(
        { _id: session._id },
        { $set: { date, time, scheduledAt, title, description, image } }
    );

    const rowFork = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('event_publish_now')
            .setLabel('🚀 Publicar Ya (Ipso Facto)')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('event_config_repeat')
            .setLabel('⚙️ Programar / Repetición Semanal')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
        content: `📋 **Datos guardados.** ¿Cómo deseas proceder?\n• **Publicar Ya:** Se lanza al instante.\n• **Programar:** Permite fijar fecha/hora y repeticiones periódicas.`,
        components: [rowFork],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}
// --- Publicar Inmediatamente ---
export async function handleEventPublishNowButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'event_publish_now') return false;

    const col = await getEventsCollection();
    const session = await col.findOne({ userId: interaction.user.id, status: 'draft' });
    if (!session || !session.channelId || !session.roleId || !session.title) {
        await interaction.reply({ content: '❌ Sesión caducada o ya procesada.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const guild = interaction.guild;
    if (!guild) return true;

    const channel = await guild.channels.fetch(session.channelId).catch(() => null) as TextChannel;
    if (!channel || !channel.isTextBased()) {
        await interaction.reply({ content: '❌ Canal de destino no válido.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    try {
        const embed = new EmbedBuilder()
            .setColor(0x0055FF)
            .setTitle(`🏁 ${session.title}`)
            .setDescription(`📅 **Fecha:** ${session.date} a las ${session.time} CET\n\n${session.description}`)
            .setTimestamp();

        if (session.image) embed.setImage(session.image);

        embed.addFields(
            { name: '✅ Asistiré (0/16)', value: 'Ninguno', inline: false },
            { name: '❔ Duda (0)', value: 'Ninguno', inline: false },
            { name: '❌ No puedo (0)', value: 'Ninguno', inline: false }
        );

        const rowRsvp = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('event_rsvp_yes').setLabel('Asistiré').setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId('event_rsvp_maybe').setLabel('Duda').setStyle(ButtonStyle.Secondary).setEmoji('❓'),
            new ButtonBuilder().setCustomId('event_rsvp_no').setLabel('No puedo').setStyle(ButtonStyle.Danger).setEmoji('✖️')
        );

        const rowAdmin = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('event_admin_manage').setLabel('Gestión Admin').setStyle(ButtonStyle.Secondary).setEmoji('⚙️')
        );

        const sentMessage = await channel.send({ 
            content: `<@&${session.roleId}>`, 
            embeds: [embed], 
            components: [rowRsvp, rowAdmin] 
        });

        await col.updateOne(
            { _id: session._id },
            { 
                $set: { 
                    messageId: sentMessage.id,
                    status: 'sent',
                    rsvps: { yes: [], maybe: [], no: [] },
                    createdAt: new Date(),
                    scheduledAt: session.scheduledAt
                } 
            }
        );

        await interaction.update({ content: `🚀 **¡Evento publicado con éxito en <#${session.channelId}>!**`, components: [] });
    } catch (error) {
        console.error('❌ Error publicando evento:', error);
        await interaction.update({ content: '❌ Error al publicar el evento.', components: [] }).catch(() => {});
    }

    return true;
}

// --- Modal para Programación y Repetición ---
export async function handleEventConfigRepeatButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'event_config_repeat') return false;

    const modal = new ModalBuilder()
        .setCustomId('modal_event_repeat')
        .setTitle('⚙️ Configuración de Repetición');

    const intervalInput = new TextInputBuilder()
        .setCustomId('event_interval_days')
        .setLabel('Intervalo en Días (Ej: 7 para semanal)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('7')
        .setValue('7')
        .setRequired(true);

    const timesInput = new TextInputBuilder()
        .setCustomId('event_repeat_times')
        .setLabel('Nº total de repeticiones (ej: 4)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('4')
        .setValue('4')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(intervalInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(timesInput)
    );

    await interaction.showModal(modal);
    return true;
}

// --- Guardar Programación y Recurrencia ---
export async function handleEventRepeatModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_event_repeat') return false;

    const col = await getEventsCollection();
    const session = await col.findOne({ userId: interaction.user.id, status: 'draft' });
    if (!session) {
        await interaction.reply({ content: '❌ Sesión caducada.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const intervalDays = parseInt(interaction.fields.getTextInputValue('event_interval_days').trim(), 10) || 7;
    const totalTimes = parseInt(interaction.fields.getTextInputValue('event_repeat_times').trim(), 10) || 1;
    const intervalMs = intervalDays * 24 * 3600 * 1000;

    await col.updateOne(
        { _id: session._id },
        {
            $set: {
                repeats: true,
                intervalMs,
                remainingTimes: totalTimes,
                status: 'pending',
                rsvps: { yes: [], maybe: [], no: [] },
                createdAt: new Date()
            }
        }
    );

    await interaction.reply({
        content: `✅ **¡Evento programado con éxito!** Se lanzará automáticamente el **${session.date}** a las **${session.time}** y se repetirá cada ${intervalDays} días (${totalTimes} veces en total).`,
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// --- GESTIÓN DE BD EVENTOS (Listar eventos activos) ---
export async function handleBdEventosButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_bd_eventos') return false;

    const col = await getEventsCollection();
    const events = await col.find({ status: { $in: ['pending', 'sent'] } }).toArray();

    if (events.length === 0) {
        await interaction.reply({
            content: '📭 No hay eventos activos o programados en la base de datos.',
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('bd_event_select_action')
        .setPlaceholder('Selecciona un evento para gestionar...')
        .addOptions(
            events.slice(0, 25).map(ev => ({
                label: ev.title.substring(0, 100),
                description: `Fecha: ${ev.date} a las ${ev.time} (${ev.status})`,
                value: ev._id.toString()
            }))
        );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.reply({
        content: '🗂️ **Gestión de Base de Datos de Eventos:** Selecciona el evento que deseas administrar:',
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// --- MOSTRAR OPCIONES DE GESTIÓN DEL EVENTO SELECCIONADO ---
export async function handleBdEventosSelect(interaction: any): Promise<boolean> {
    if (interaction.customId !== 'bd_event_select_action') return false;

    const eventId = interaction.values[0];
    const col = await getEventsCollection();
    const ev = await col.findOne({ _id: new ObjectId(eventId) });

    if (!ev) {
        await interaction.update({ content: '❌ El evento seleccionado ya no existe en la base de datos.', components: [] });
        return true;
    }

    const rowActions = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`bd_event_cancel_${ev._id}`)
            .setLabel('Cancelar Evento')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('✖️')
    );

    await interaction.update({
        content: `⚙️ **Administrando Evento:**\n> **Título:** ${ev.title}\n> **Fecha:** ${ev.date} a las${ev.time}\n> **Estado actual:** \`${ev.status}\``,
        components: [rowActions]
    });

    return true;
}

// --- EJECUTAR CANCELACIÓN DESDE LA BD ---
export async function handleBdEventosCancelAction(interaction: ButtonInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('bd_event_cancel_')) return false;

    const eventId = interaction.customId.replace('bd_event_cancel_', '');
    const col = await getEventsCollection();

    await col.updateOne(
        { _id: new ObjectId(eventId) },
        { $set: { status: 'cancelled' } }
    );

    await interaction.update({
        content: '✅ **El evento ha sido cancelado con éxito** en la base de datos. El worker dejará de procesarlo y enviar avisos.',
        components: []
    });

    return true;
}
// --- 1. ABRIR PANEL ADMIN ---
export async function handleEventAdminManageButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'event_admin_manage') return false;

    const sessionId = `${interaction.user.id}_${interaction.message.id}`;
    adminAdminSessions.set(sessionId, { eventMessageId: interaction.message.id });

    const userSelect = new UserSelectMenuBuilder()
        .setCustomId(`admin_user_select_${sessionId}`)
        .setPlaceholder('👤 Selecciona al piloto...');

    const statusSelect = new StringSelectMenuBuilder()
        .setCustomId(`admin_status_select_${sessionId}`)
        .setPlaceholder('📊 Selecciona el estado...')
        .addOptions(
            { label: '✅ Asistiré', value: 'yes', description: 'Añadir a la parrilla titular' },
            { label: '❔ Duda', value: 'maybe', description: 'Añadir a lista de espera / duda' },
            { label: '❌ No puedo', value: 'no', description: 'Marcar como ausente' }
        );

    const confirmButton = new ButtonBuilder()
        .setCustomId(`admin_confirm_${sessionId}`)
        .setLabel('Confirmar Cambios')
        .setStyle(ButtonStyle.Success)
        .setEmoji('💾');

    const rowUser = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(userSelect);
    const rowStatus = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(statusSelect);
    const rowBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton);

    await interaction.reply({
        content: '⚙️ **Gestión Admin de Asistencia:** Selecciona el usuario y el estado deseado en los menús desplegables y pulsa **Confirmar**:',
        components: [rowUser, rowStatus, rowBtn],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// --- 2. CAPTURAR SELECCIÓN DE USUARIO ---
export async function handleEventAdminUserSelect(interaction: any): Promise<boolean> {
    if (!interaction.customId.startsWith('admin_user_select_')) return false;

    const sessionId = interaction.customId.replace('admin_user_select_', '');
    const session = adminAdminSessions.get(sessionId);

    if (!session) {
        await interaction.reply({ content: '❌ Sesión caducada. Vuelve a abrir el panel de gestión.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    session.targetUserId = interaction.values[0];
    adminAdminSessions.set(sessionId, session);

    await interaction.update({
        content: `⚙️ **Gestión Admin:** Usuario seleccionado (<@${session.targetUserId}>). Ahora selecciona el estado y pulsa Confirmar.`
    });

    return true;
}

// --- 3. CAPTURAR SELECCIÓN DE ESTADO ---
export async function handleEventAdminStatusSelect(interaction: any): Promise<boolean> {
    if (!interaction.customId.startsWith('admin_status_select_')) return false;

    const sessionId = interaction.customId.replace('admin_status_select_', '');
    const session = adminAdminSessions.get(sessionId);

    if (!session) {
        await interaction.reply({ content: '❌ Sesión caducada. Vuelve a abrir el panel de gestión.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    session.status = interaction.values[0];
    adminAdminSessions.set(sessionId, session);

    const statusNames: Record<string, string> = { yes: 'Asistiré', maybe: 'Duda', no: 'No puedo' };
    await interaction.update({
        content: `⚙️ **Gestión Admin:** Estado seleccionado (**${statusNames[session.status]}**). Asegúrate de haber elegido usuario y pulsa Confirmar.`
    });

    return true;
}

// --- 4. CONFIRMAR Y APLICAR CAMBIOS EN LA BD Y EL MENSAJE PRINCIPAL ---
export async function handleEventAdminConfirmButton(interaction: ButtonInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('admin_confirm_')) return false;

    const sessionId = interaction.customId.replace('admin_confirm_', '');
    const session = adminAdminSessions.get(sessionId);

    if (!session || !session.targetUserId || !session.status) {
        await interaction.reply({ content: '❌ Debes seleccionar tanto un **usuario** como un **estado** antes de confirmar.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const targetUserId = session.targetUserId;
    const targetStatus = session.status;
    const messageId = session.eventMessageId;

    adminAdminSessions.delete(sessionId);

    const guild = interaction.guild;
    if (!guild) return true;

    const col = await getEventsCollection();
    const eventDoc = await col.findOne({ messageId });

    if (!eventDoc) {
        await interaction.update({ content: '❌ Este evento ya no está activo en la base de datos.', components: [] });
        return true;
    }

    if (!eventDoc.rsvps) eventDoc.rsvps = { yes: [], maybe: [], no: [] };

    eventDoc.rsvps.yes = eventDoc.rsvps.yes.filter((id: string) => id !== targetUserId);
    eventDoc.rsvps.maybe = eventDoc.rsvps.maybe.filter((id: string) => id !== targetUserId);
    eventDoc.rsvps.no = eventDoc.rsvps.no.filter((id: string) => id !== targetUserId);

    let asistenteRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'asistente');
    if (!asistenteRole) {
        try {
            asistenteRole = await guild.roles.create({
                name: 'asistente',
                color: 0x00FF00,
                reason: 'Rol automático creado para gestión de asistencias.'
            });
        } catch (e) {
            console.error('❌ Error creando rol asistente:', e);
        }
    }

    const member = await guild.members.fetch(targetUserId).catch(() => null);

    if (targetStatus === 'yes') {
        if (eventDoc.rsvps.yes.length < 16) {
            eventDoc.rsvps.yes.push(targetUserId);
            if (asistenteRole && member) await member.roles.add(asistenteRole).catch(() => {});
        } else {
            eventDoc.rsvps.maybe.push(targetUserId);
            if (asistenteRole && member) await member.roles.add(asistenteRole).catch(() => {});
        }
    } else if (targetStatus === 'maybe') {
        eventDoc.rsvps.maybe.push(targetUserId);
        if (asistenteRole && member) await member.roles.add(asistenteRole).catch(() => {});
    } else if (targetStatus === 'no') {
        eventDoc.rsvps.no.push(targetUserId);
        if (asistenteRole && member && member.roles.cache.has(asistenteRole.id)) {
            await member.roles.remove(asistenteRole).catch(() => {});
        }
    }

    await col.updateOne({ messageId }, { $set: { rsvps: eventDoc.rsvps } });

    const channel = await guild.channels.fetch(eventDoc.channelId).catch(() => null) as TextChannel;
    if (channel) {
        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (message) {
            const embed = new EmbedBuilder()
                .setColor(0x0055FF)
                .setTitle(`🏁 ${eventDoc.title}`)
                .setDescription(`📅 **Fecha:** ${eventDoc.date} a las ${eventDoc.time} CET\n\n${eventDoc.description}`)
                .setTimestamp();

            if (eventDoc.image) embed.setImage(eventDoc.image);

            const formatVerticalList = (ids: string[]) => ids.length > 0 ? ids.map(id => `<@${id}>`).join('\n') : 'Ninguno';

            embed.addFields(
                { name: `✅ Asistiré (${eventDoc.rsvps.yes.length}/16)`, value: formatVerticalList(eventDoc.rsvps.yes), inline: false },
                { name: `❔ Duda (${eventDoc.rsvps.maybe.length})`, value: formatVerticalList(eventDoc.rsvps.maybe), inline: false },
                { name: `❌ No puedo (${eventDoc.rsvps.no.length})`, value: formatVerticalList(eventDoc.rsvps.no), inline: false }
            );

            const rowRsvp = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('event_rsvp_yes').setLabel('Asistiré').setStyle(ButtonStyle.Success).setEmoji('✅'),
                new ButtonBuilder().setCustomId('event_rsvp_maybe').setLabel('Duda').setStyle(ButtonStyle.Secondary).setEmoji('❓'),
                new ButtonBuilder().setCustomId('event_rsvp_no').setLabel('No puedo').setStyle(ButtonStyle.Danger).setEmoji('✖️')
            );

            const rowAdmin = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('event_admin_manage').setLabel('Gestión Admin').setStyle(ButtonStyle.Secondary).setEmoji('⚙️')
            );

            await message.edit({ embeds: [embed], components: [rowRsvp, rowAdmin] }).catch(() => {});
        }
    }

    await interaction.update({
        content: `✅ Asistencia actualizada correctamente para el usuario <@${targetUserId}> como **${targetStatus}**.`,
        components: []
    });

    return true;
}

// --- GESTIÓN DE RSVP Y LÍMITE DE 16 PLAZAS ---
export async function handleEventRsvpButton(interaction: ButtonInteraction): Promise<boolean> {
    const customId = interaction.customId;
    if (!['event_rsvp_yes', 'event_rsvp_maybe', 'event_rsvp_no'].includes(customId)) return false;

    const userId = interaction.user.id;
    const messageId = interaction.message.id;
    const guild = interaction.guild;

    if (!guild) return true;

    const col = await getEventsCollection();
    const eventDoc = await col.findOne({ messageId });

    if (!eventDoc) {
        await interaction.reply({ content: '❌ Este evento ya no está activo en la base de datos.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    if (!eventDoc.rsvps) eventDoc.rsvps = { yes: [], maybe: [], no: [] };

    const wasInYes = eventDoc.rsvps.yes.includes(userId);

    eventDoc.rsvps.yes = eventDoc.rsvps.yes.filter((id: string) => id !== userId);
    eventDoc.rsvps.maybe = eventDoc.rsvps.maybe.filter((id: string) => id !== userId);
    eventDoc.rsvps.no = eventDoc.rsvps.no.filter((id: string) => id !== userId);

    let asistenteRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'asistente');
    if (!asistenteRole) {
        try {
            asistenteRole = await guild.roles.create({
                name: 'asistente',
                color: 0x00FF00,
                reason: 'Rol automático creado para gestión de asistencias.'
            });
        } catch (e) {
            console.error('❌ Error creando rol asistente:', e);
        }
    }

    const member = await guild.members.fetch(userId).catch(() => null);
    let responseContent = '';

    if (customId === 'event_rsvp_yes') {
        if (eventDoc.rsvps.yes.length < 16) {
            eventDoc.rsvps.yes.push(userId);
            responseContent = '✅ ¡Tu asistencia (**Asistiré**) ha quedado registrada!';
            if (asistenteRole && member) await member.roles.add(asistenteRole).catch(() => {});
        } else {
            eventDoc.rsvps.maybe.push(userId);
            responseContent = '⚠️ La parrilla titular (16 plazas) está llena. Has sido colocado automáticamente en **Duda** (en lista de espera).';
            if (asistenteRole && member) await member.roles.add(asistenteRole).catch(() => {});
        }
    } else if (customId === 'event_rsvp_maybe') {
        eventDoc.rsvps.maybe.push(userId);
        responseContent = '✅ ¡Tu estado (**Duda**) ha quedado registrado!';
        if (asistenteRole && member) await member.roles.add(asistenteRole).catch(() => {});
    } else if (customId === 'event_rsvp_no') {
        eventDoc.rsvps.no.push(userId);
        responseContent = '❌ Tu asistencia ha sido marcada como **No puedo**.';
        if (asistenteRole && member && member.roles.cache.has(asistenteRole.id)) {
            await member.roles.remove(asistenteRole).catch(() => {});
        }
    }

    const leftYes = wasInYes && !eventDoc.rsvps.yes.includes(userId);
    if (leftYes && eventDoc.rsvps.yes.length < 16 && eventDoc.rsvps.maybe.length > 0) {
        const promotedId = eventDoc.rsvps.maybe.shift()!;
        eventDoc.rsvps.yes.push(promotedId);
    }

    await col.updateOne({ messageId }, { $set: { rsvps: eventDoc.rsvps } });

    const embed = new EmbedBuilder()
        .setColor(0x0055FF)
        .setTitle(`🏁 ${eventDoc.title}`)
        .setDescription(`📅 **Fecha:** ${eventDoc.date} a las ${eventDoc.time} CET\n\n${eventDoc.description}`)
        .setTimestamp();

    if (eventDoc.image) embed.setImage(eventDoc.image);

    const formatVerticalList = (ids: string[]) => ids.length > 0 ? ids.map(id => `<@${id}>`).join('\n') : 'Ninguno';

    embed.addFields(
        { name: `✅ Asistiré (${eventDoc.rsvps.yes.length}/16)`, value: formatVerticalList(eventDoc.rsvps.yes), inline: false },
        { name: `❔ Duda (${eventDoc.rsvps.maybe.length})`, value: formatVerticalList(eventDoc.rsvps.maybe), inline: false },
        { name: `❌ No puedo (${eventDoc.rsvps.no.length})`, value: formatVerticalList(eventDoc.rsvps.no), inline: false }
    );

    const rowRsvp = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('event_rsvp_yes').setLabel('Asistiré').setStyle(ButtonStyle.Success).setEmoji('✅'),
        newButtonBuilder().setCustomId('event_rsvp_maybe').setLabel('Duda').setStyle(ButtonStyle.Secondary).setEmoji('❓'),
        new ButtonBuilder().setCustomId('event_rsvp_no').setLabel('No puedo').setStyle(ButtonStyle.Danger).setEmoji('✖️')
    );

    const rowAdmin = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('event_admin_manage').setLabel('Gestión Admin').setStyle(ButtonStyle.Secondary).setEmoji('⚙️')
    );

    await interaction.message.edit({ embeds: [embed], components: [rowRsvp, rowAdmin] }).catch(() => {});

    await interaction.reply({
        content: responseContent,
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}
