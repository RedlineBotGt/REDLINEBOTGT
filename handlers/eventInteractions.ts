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
    EmbedBuilder
} from 'discord.js';
import { getEventsCollection } from './interactionRouter';

// Memoria temporal para la sesión de creación de eventos de cada usuario
export const eventSessions = new Map<string, any>();

// 🛡 ENRUTADOR LOCAL DE EVENTOS (PARTE 1)
export async function handleEventInteraction(interaction: any): Promise<boolean> {
    try {
        // 1. Botones del flujo de eventos
        if (interaction.isButton()) {
            if (interaction.customId === 'dash_btn_event_create') return await handleDashEventButton(interaction);
            if (interaction.customId === 'event_proceed_to_modal') return await handleEventProceedToModal(interaction);
            if (interaction.customId === 'event_publish_now') return await handleEventPublishNowButton(interaction);
            if (interaction.customId === 'event_config_repeat') return await handleEventConfigRepeatButton(interaction);
            if (['event_rsvp_yes', 'event_rsvp_maybe', 'event_rsvp_no'].includes(interaction.customId)) return await handleEventRsvpButton(interaction);
        }

        // 2. Modales
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'modal_event_create') return await handleEventModalSubmit(interaction);
            if (interaction.customId === 'modal_event_repeat') return await handleEventRepeatModalSubmit(interaction);
        }

        // 3. Menú de Canales (Guardado silencioso en sesión)
        if (interaction.isChannelSelectMenu()) {
            if (interaction.customId === 'event_select_channel') {
                let session = eventSessions.get(interaction.user.id) || {};
                session.channelId = interaction.values[0];
                eventSessions.set(interaction.user.id, session);
                await interaction.deferUpdate();
                return true;
            }
        }

        // 4. Menú de Roles (Guardado silencioso en sesión)
        if (interaction.isRoleSelectMenu()) {
            if (interaction.customId === 'event_select_role') {
                let session = eventSessions.get(interaction.user.id) || {};
                session.roleId = interaction.values[0];
                eventSessions.set(interaction.user.id, session);
                await interaction.deferUpdate();
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error('❌ Error en el manejador de eventos:', error);
        return false;
    }
}

// --- PASO 1 y 2: Desplegables apilados (Canal + Rol) ---
async function handleDashEventButton(interaction: ButtonInteraction): Promise<boolean> {
    eventSessions.set(interaction.user.id, {});

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

// --- Validación y apertura del Modal Principal (5 preguntas) ---
async function handleEventProceedToModal(interaction: ButtonInteraction): Promise<boolean> {
    const session = eventSessions.get(interaction.user.id);
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
        .setLabel('ID o URL de la imagen (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://... o ID')
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

// --- Procesar Modal y ofrecer Bifurcación ---
async function handleEventModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_event_create') return false;

    const session = eventSessions.get(interaction.user.id);
    if (!session) {
        await interaction.reply({ content: '❌ Sesión caducada.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    session.date = interaction.fields.getTextInputValue('event_date').trim();
    session.time = interaction.fields.getTextInputValue('event_time').trim();
    session.title = interaction.fields.getTextInputValue('event_title').trim();
    session.description = interaction.fields.getTextInputValue('event_desc').trim() || 'Sin descripción detallada.';
    session.image = interaction.fields.getTextInputValue('event_image').trim() || null;

    const rowFork = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('event_publish_now')
            .setLabel('🚀 Publicar Ya (Ipso Facto)')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('event_config_repeat')
            .setLabel('⚙️ Configurar Repetición / Programación')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
        content: `📋 **Datos guardados.** ¿Cómo deseas proceder?\n• **Publicar Ya:** Se lanza al instante al canal seleccionado.\n• **Programar:** Añade opciones de recurrencia y primer envío.`,
        components: [rowFork],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}
// --- Publicar Inmediatamente (Estilo Apollo) (PARTE 2) ---
async function handleEventPublishNowButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'event_publish_now') return false;

    const session = eventSessions.get(interaction.user.id);
    if (!session) {
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
            { name: '✔️ Asistiré (0/16)', value: 'Ninguno', inline: false },
            { name: '❔ Duda (0)', value: 'Ninguno', inline: false },
            { name: '❌ No puedo (0)', value: 'Ninguno', inline: false }
        );

        const rowRsvp = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('event_rsvp_yes').setLabel('Asistiré').setStyle(ButtonStyle.Success).setEmoji('✔️️'),
            new ButtonBuilder().setCustomId('event_rsvp_maybe').setLabel('Duda').setStyle(ButtonStyle.Secondary).setEmoji('❔'),
            new ButtonBuilder().setCustomId('event_rsvp_no').setLabel('No puedo').setStyle(ButtonStyle.Danger).setEmoji('✖️')
        );

        const sentMessage = await channel.send({ 
            content: `<@&${session.roleId}>`, 
            embeds: [embed], 
            components: [rowRsvp] 
        });

        const col = await getEventsCollection();
        await col.insertOne({
            guildId: guild.id,
            userId: interaction.user.id,
            title: session.title,
            description: session.description,
            date: session.date,
            time: session.time,
            image: session.image,
            channelId: session.channelId,
            roleId: session.roleId,
            messageId: sentMessage.id,
            status: 'sent',
            rsvps: { yes: [], maybe: [], no: [] },
            createdAt: new Date()
        });

        eventSessions.delete(interaction.user.id);
        await interaction.update({ content: `🚀 **¡Evento publicado con éxito en <#${session.channelId}>!**`, components: [] });
    } catch (error) {
        console.error('❌ Error publicando evento:', error);
        await interaction.update({ content: '❌ Error al publicar el evento.', components: [] }).catch(() => {});
    }

    return true;
}

// --- Segundo Modal para Opciones Opcionales (Repetición / Programación) ---
async function handleEventConfigRepeatButton(interaction: ButtonInteraction): Promise<boolean> {
    const modal = new ModalBuilder()
        .setCustomId('modal_event_repeat')
        .setTitle('⚙️ Opciones de Repetición y Programación');

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('event_repeat_days').setLabel('Días de intervalo entre repeticiones').setStyle(TextInputStyle.Short).setPlaceholder('Ej: 7 (Opcional)').setRequired(false)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('event_repeat_times').setLabel('Nº de veces (2 a 10)').setStyle(TextInputStyle.Short).setPlaceholder('Ej: 4 (Opcional)').setRequired(false)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('event_first_send_date').setLabel('Primer envío: Día (DD/MM/YYYY)').setStyle(TextInputStyle.Short).setPlaceholder('Ej: 26/06/2026 (Opcional)').setRequired(false)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('event_first_send_time').setLabel('Primer envío: Hora (HH:MM)').setStyle(TextInputStyle.Short).setPlaceholder('Ej: 20:00 (Opcional)').setRequired(false)
        )
    );

    await interaction.showModal(modal);
    return true;
}

// --- Guardar Programación ---
async function handleEventRepeatModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    const session = eventSessions.get(interaction.user.id);
    if (!session) {
        await interaction.reply({ content: '❌ Sesión caducada.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    session.repeatDays = interaction.fields.getTextInputValue('event_repeat_days').trim();
    session.repeatTimes = interaction.fields.getTextInputValue('event_repeat_times').trim();
    session.firstSendDate = interaction.fields.getTextInputValue('event_first_send_date').trim();
    session.firstSendTime = interaction.fields.getTextInputValue('event_first_send_time').trim();

    const col = await getEventsCollection();
    await col.insertOne({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        title: session.title,
        description: session.description,
        date: session.date,
        time: session.time,
        image: session.image,
        channelId: session.channelId,
        roleId: session.roleId,
        repeatDays: session.repeatDays || null,
        repeatTimes: session.repeatTimes || null,
        firstSendDate: session.firstSendDate || null,
        firstSendTime: session.firstSendTime || null,
        status: 'scheduled',
        rsvps: { yes: [], maybe: [], no: [] },
        createdAt: new Date()
    });

    eventSessions.delete(interaction.user.id);
    await interaction.reply({
        content: '📅 **¡Evento programado con éxito!** Quedará pendiente para su envío automático.',
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// --- GESTIÓN DE RSVP, LÍMITE DE 16 PLAZAS Y AUTO-PROMOCIÓN DESDE DUDA ---
async function handleEventRsvpButton(interaction: ButtonInteraction): Promise<boolean> {
    const customId = interaction.customId;
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

    // Detectar si el usuario estaba previamente en 'yes'
    const wasInYes = eventDoc.rsvps.yes.includes(userId);

    // Limpiar usuario de cualquier otra lista anterior
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
    let statusText = '';
    let responseContent = '';

    if (customId === 'event_rsvp_yes') {
        // Comprobar si hay hueco (máximo 16 plazas)
        if (eventDoc.rsvps.yes.length < 16) {
            eventDoc.rsvps.yes.push(userId);
            statusText = 'Asistiré';
            responseContent = '✅ ¡Tu asistencia (**Asistiré**) ha quedado registrada!';
            if (asistenteRole && member) await member.roles.add(asistenteRole).catch(() => {});
        } else {
            // Si está lleno, va automáticamente a Duda (lista de espera)
            eventDoc.rsvps.maybe.push(userId);
            statusText = 'Duda (Parrilla llena)';
            responseContent = '⚠️ La parrilla titular (16 plazas) está llena. Has sido colocado automáticamente en **Duda** (en lista de espera).';
            if (asistenteRole && member) await member.roles.add(asistenteRole).catch(() => {});
        }
    } else if (customId === 'event_rsvp_maybe') {
        eventDoc.rsvps.maybe.push(userId);
        statusText = 'Duda';
        responseContent = '✅ ¡Tu estado (**Duda**) ha quedado registrado!';
        if (asistenteRole && member) await member.roles.add(asistenteRole).catch(() => {});
    } else if (customId === 'event_rsvp_no') {
        eventDoc.rsvps.no.push(userId);
        statusText = 'No puedo';
        responseContent = '❌ Tu asistencia ha sido marcada como **No puedo**.';
        if (asistenteRole && member && member.roles.cache.has(asistenteRole.id)) {
            await member.roles.remove(asistenteRole).catch(() => {});
        }
    }

    // Efecto Cascada / Auto-Promoción: Si alguien estaba en 'yes' y se ha salido (o cambiado), y hay hueco, sube el primer 'duda'
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
        { name: `✔️ Asistiré (${eventDoc.rsvps.yes.length}/16)`, value: formatVerticalList(eventDoc.rsvps.yes), inline: false },
        { name: `❔ Duda (${eventDoc.rsvps.maybe.length})`, value: formatVerticalList(eventDoc.rsvps.maybe), inline: false },
        { name: `✖️ No puedo (${eventDoc.rsvps.no.length})`, value: formatVerticalList(eventDoc.rsvps.no), inline: false }
    );

    const rowRsvp = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('event_rsvp_yes').setLabel('Asistiré').setStyle(ButtonStyle.Success).setEmoji('✔️️'),
        new ButtonBuilder().setCustomId('event_rsvp_maybe').setLabel('Duda').setStyle(ButtonStyle.Secondary).setEmoji('❔'),
        new ButtonBuilder().setCustomId('event_rsvp_no').setLabel('No puedo').setStyle(ButtonStyle.Danger).setEmoji('✖️')
    );

    await interaction.message.edit({ embeds: [embed], components: [rowRsvp] }).catch(() => {});

    await interaction.reply({
        content: responseContent,
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}
