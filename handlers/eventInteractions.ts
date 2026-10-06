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
    TextChannel,
    EmbedBuilder
} from 'discord.js';
import { getEventsCollection } from './interactionRouter';

// Memoria temporal para la sesión de creación de eventos de cada usuario
export const eventSessions = new Map<string, any>();

// 🛡️ ENRUTADOR LOCAL DE EVENTOS
export async function handleEventInteraction(interaction: any): Promise<boolean> {
    try {
        // 1. Botones del flujo de eventos
        if (interaction.isButton()) {
            if (interaction.customId === 'dash_btn_event_create') return await handleDashEventButton(interaction);
            if (interaction.customId === 'event_publish_now') return await handleEventPublishNowButton(interaction);
            if (['event_rsvp_yes', 'event_rsvp_maybe', 'event_rsvp_no'].includes(interaction.customId)) return await handleEventRsvpButton(interaction);
        }
        
        // 2. Modales
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'modal_event_create') return await handleEventModalSubmit(interaction);
        }

        // 3. Menú de Canales
        if (interaction.isChannelSelectMenu()) {
            if (interaction.customId === 'event_select_channel') return await handleEventChannelSelect(interaction);
        }

        // 4. Menú de Roles
        if (interaction.isRoleSelectMenu()) {
            if (interaction.customId === 'event_select_role') return await handleEventRoleSelect(interaction);
        }

        return false;
    } catch (error) {
        console.error('❌ Error en el manejador de eventos:', error);
        return false;
    }
}

// --- PASO 1: Iniciar creación (Paso desde /dashstaff) ---
async function handleDashEventButton(interaction: ButtonInteraction): Promise<boolean> {
    eventSessions.set(interaction.user.id, {});

    const selectChannel = new ChannelSelectMenuBuilder()
        .setCustomId('event_select_channel')
        .setPlaceholder('📢 Selecciona el canal para publicar el evento...')
        .addChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectChannel);

    await interaction.reply({
        content: '📅 **Organizador de Eventos (1/3):** Selecciona el canal de destino:',
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// --- PASO 2: Canal seleccionado -> Pedir Rol obligatorio (`asistente`) ---
async function handleEventChannelSelect(interaction: any): Promise<boolean> {
    if (interaction.customId !== 'event_select_channel') return false;

    const channelId = interaction.values[0];
    const session = eventSessions.get(interaction.user.id);
    if (!session) {
        await interaction.update({ content: '❌ Sesión caducada.', components: [] });
        return true;
    }

    session.channelId = channelId;

    const selectRole = new RoleSelectMenuBuilder()
        .setCustomId('event_select_role')
        .setPlaceholder('🏷️ Selecciona el rol a mencionar en el evento...');

    const row = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(selectRole);

    await interaction.update({
        content: `📢 Canal seleccionado (<#${channelId}>).\n**Paso 2/3:** Selecciona el rol a mencionar:`,
        components: [row]
    });

    return true;
}

// --- PASO 3: Rol seleccionado -> Abrir Modal con las 5 preguntas ---
async function handleEventRoleSelect(interaction: any): Promise<boolean> {
    if (interaction.customId !== 'event_select_role') return false;

    const roleId = interaction.values[0];
    const session = eventSessions.get(interaction.user.id);
    if (!session) {
        await interaction.update({ content: '❌ Sesión caducada.', components: [] });
        return true;
    }

    session.roleId = roleId;

    const modal = new ModalBuilder()
        .setCustomId('modal_event_create')
        .setTitle('📅 Detalles del Evento (3/3)');

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
        .setLabel('Descripción')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Normativa, horarios, circuitos...')
        .setRequired(true);

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

// --- PASO 4: Recoger Modal y mostrar botón final de Envío ---
async function handleEventModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_event_create') return false;

    const date = interaction.fields.getTextInputValue('event_date').trim();
    const time = interaction.fields.getTextInputValue('event_time').trim();
    const title = interaction.fields.getTextInputValue('event_title').trim();
    const description = interaction.fields.getTextInputValue('event_desc').trim();
    const image = interaction.fields.getTextInputValue('event_image').trim();

    const session = eventSessions.get(interaction.user.id);
    if (!session) {
        await interaction.reply({ content: '❌ Sesión caducada.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    session.date = date;
    session.time = time;
    session.title = title;
    session.description = description;
    session.image = image || null;

    const rowPublish = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('event_publish_now')
            .setLabel('Enviar / Publicar')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🚀')
    );

    await interaction.reply({
        content: `📋 **Datos guardados correctamente.**\nHaz clic en el botón inferior para publicar el evento inmediatamente en <#${session.channelId}>:`,
        components: [rowPublish],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// --- PASO 5: Publicar el evento estilo Apollo con botones RSVP ---
async function handleEventPublishNowButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'event_publish_now') return false;

    const session = eventSessions.get(interaction.user.id);
    if (!session) {
        await interaction.reply({ content: '❌ Sesión caducada o ya publicada.', flags: [MessageFlags.Ephemeral] });
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

        // Listas verticales iniciales vacías
        embed.addFields(
            { name: '✔️ Asistiré (0)', value: 'Ninguno', inline: false },
            { name: '❔ Duda (0)', value: 'Ninguno', inline: false },
            { name: '✖️ No puedo (0)', value: 'Ninguno', inline: false }
        );

        const rowRsvp = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('event_rsvp_yes').setLabel('Asistiré').setStyle(ButtonStyle.Success).setEmoji('✔️'),
            new ButtonBuilder().setCustomId('event_rsvp_maybe').setLabel('Duda').setStyle(ButtonStyle.Secondary).setEmoji('❔'),
            new ButtonBuilder().setCustomId('event_rsvp_no').setLabel('No puedo').setStyle(ButtonStyle.Danger).setEmoji('✖️')
        );

        const contentToSend = `<@&${session.roleId}>`;

        const sentMessage = await channel.send({ 
            content: contentToSend, 
            embeds: [embed], 
            components: [rowRsvp] 
        });

        // Guardar en Base de Datos (MongoDB)
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
        await interaction.update({ content: '❌ Error al publicar el evento en el canal.', components: [] }).catch(() => {});
    }

    return true;
}

// --- PASO 6: Gestión de Botones RSVP y Roles de Asistente ---
async function handleEventRsvpButton(interaction: ButtonInteraction): Promise<boolean> {
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

    if (!eventDoc.rsvps) {
        eventDoc.rsvps = { yes: [], maybe: [], no: [] };
    }

    // Limpiar usuario de cualquier otra lista anterior
    eventDoc.rsvps.yes = eventDoc.rsvps.yes.filter((id: string) => id !== userId);
    eventDoc.rsvps.maybe = eventDoc.rsvps.maybe.filter((id: string) => id !== userId);
    eventDoc.rsvps.no = eventDoc.rsvps.no.filter((id: string) => id !== userId);

    // Buscar o crear automáticamente el rol "asistente" en minúscula
    let asistenteRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'asistente');
    if (!asistenteRole) {
        try {
            asistenteRole = await guild.roles.create({
                name: 'asistente',
                color: 0x00FF00,
                reason: 'Rol automático creado para gestor de asistencias de eventos.'
            });
        } catch (roleErr) {
            console.error('❌ Error creando rol asistente automáticamente:', roleErr);
        }
    }

    const member = await guild.members.fetch(userId).catch(() => null);
    let statusText = '';

    if (customId === 'event_rsvp_yes') {
        eventDoc.rsvps.yes.push(userId);
        statusText = 'Asistiré';
        if (asistenteRole && member) {
            await member.roles.add(asistenteRole).catch(() => {});
        }
    } else if (customId === 'event_rsvp_maybe') {
        eventDoc.rsvps.maybe.push(userId);
        statusText = 'Duda';
        if (asistenteRole && member) {
            await member.roles.add(asistenteRole).catch(() => {});
        }
    } else if (customId === 'event_rsvp_no') {
        eventDoc.rsvps.no.push(userId);
        statusText = 'No puedo';
        if (asistenteRole && member && member.roles.cache.has(asistenteRole.id)) {
            await member.roles.remove(asistenteRole).catch(() => {});
        }
    }

    // Actualizar registro en MongoDB
    await col.updateOne({ messageId }, { $set: { rsvps: eventDoc.rsvps } });

    // Reconstruir Embed con listas verticales (\n)
    const embed = new EmbedBuilder()
        .setColor(0x0055FF)
        .setTitle(`🏁 ${eventDoc.title}`)
        .setDescription(`📅 **Fecha:** ${eventDoc.date} a las ${eventDoc.time} CET\n\n${eventDoc.description}`)
        .setTimestamp();

    if (eventDoc.image) embed.setImage(eventDoc.image);

    // Listas verticales con salto de línea (\n)
    const formatVerticalList = (ids: string[]) => ids.length > 0 ? ids.map(id => `<@${id}>`).join('\n') : 'Ninguno';

    embed.addFields(
        { name: `✔️ Asistiré (${eventDoc.rsvps.yes.length})`, value: formatVerticalList(eventDoc.rsvps.yes), inline: false },
        { name: `❔ Duda (${eventDoc.rsvps.maybe.length})`, value: formatVerticalList(eventDoc.rsvps.maybe), inline: false },
        { name: `✖️ No puedo (${eventDoc.rsvps.no.length})`, value: formatVerticalList(eventDoc.rsvps.no), inline: false }
    );

    const rowRsvp = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('event_rsvp_yes').setLabel('Asistiré').setStyle(ButtonStyle.Success).setEmoji('✔️'),
        new ButtonBuilder().setCustomId('event_rsvp_maybe').setLabel('Duda').setStyle(ButtonStyle.Secondary).setEmoji('❔'),
        new ButtonBuilder().setCustomId('event_rsvp_no').setLabel('No puedo').setStyle(ButtonStyle.Danger).setEmoji('✖️')
    );

    await interaction.message.edit({ embeds: [embed], components: [rowRsvp] }).catch(() => {});

    await interaction.reply({
        content: `✅ ¡Tu asistencia (**${statusText}**) ha quedado registrada!`,
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}
