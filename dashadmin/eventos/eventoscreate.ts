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
    TextChannel
} from 'discord.js';
import { getEventsCollection } from './eventosstorage';
import { parseMadridDateTime } from './eventosutils';
import { buildEventEmbedAndRows } from './eventosmanager';

// --- PASO 1 y 2: Botón Dash inicial -> Borrador en MongoDB con aislamiento por guildId ---
export async function handleDashEventButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_event_create') return false;

    const col = await getEventsCollection();
    await col.updateOne(
        { userId: interaction.user.id, guildId: interaction.guildId, status: 'draft' },
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
        { userId: interaction.user.id, guildId: interaction.guildId, status: 'draft' },
        { $set: { channelId: interaction.values[0] } }
    );
    await interaction.deferUpdate();
    return true;
}

export async function handleEventRoleSelect(interaction: any): Promise<boolean> {
    if (interaction.customId !== 'event_select_role') return false;
    const col = await getEventsCollection();
    await col.updateOne(
        { userId: interaction.user.id, guildId: interaction.guildId, status: 'draft' },
        { $set: { roleId: interaction.values[0] } }
    );
    await interaction.deferUpdate();
    return true;
}

// --- PASO 3: Abrir Modal con Datos del Evento ---
export async function handleEventProceedToModal(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'event_proceed_to_modal') return false;

    const col = await getEventsCollection();
    const session = await col.findOne({ userId: interaction.user.id, guildId: interaction.guildId, status: 'draft' });
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
    const session = await col.findOne({ userId: interaction.user.id, guildId: interaction.guildId, status: 'draft' });
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
            .setLabel('⚙️ Programar Publicación')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
        content: `📋 **Datos guardados.** ¿Cómo deseas proceder?\n• **Publicar Ya:** Se lanza al instante.\n• **Programar Publicación:** Permite fijar fecha/hora de envío y repeticiones opcionales.`,
        components: [rowFork],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// --- Publicar Inmediatamente ---
export async function handleEventPublishNowButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'event_publish_now') return false;

    const col = await getEventsCollection();
    const session = await col.findOne({ userId: interaction.user.id, guildId: interaction.guildId, status: 'draft' });
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
        const dummyEventDoc = {
            title: session.title,
            date: session.date,
            time: session.time,
            description: session.description,
            image: session.image,
            status: 'sent',
            rsvps: { yes: [], maybe: [], no: [] }
        };

        const { embed, components } = buildEventEmbedAndRows(dummyEventDoc);

        const sentMessage = await channel.send({ 
            content: `<@&${session.roleId}>`, 
            embeds: [embed], 
            components: components 
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

// --- Modal para Programación de Publicación y Repetición ---
export async function handleEventConfigRepeatButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'event_config_repeat') return false;

    const modal = new ModalBuilder()
        .setCustomId('modal_event_repeat')
        .setTitle('⚙️ Programar Publicación');

    const publishDateInput = new TextInputBuilder()
        .setCustomId('event_publish_date')
        .setLabel('Día de publicación (DD/MM/YYYY)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 25/06/2026')
        .setRequired(true);

    const publishTimeInput = new TextInputBuilder()
        .setCustomId('event_publish_time')
        .setLabel('Hora de publicación CET (HH:MM)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 10:00')
        .setRequired(true);

    const intervalInput = new TextInputBuilder()
        .setCustomId('event_interval_days')
        .setLabel('Repetir cada X días (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 7')
        .setRequired(false);

    const timesInput = new TextInputBuilder()
        .setCustomId('event_repeat_times')
        .setLabel('Nº total de envíos (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 4')
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(publishDateInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(publishTimeInput),
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
    const session = await col.findOne({ userId: interaction.user.id, guildId: interaction.guildId, status: 'draft' });
    if (!session) {
        await interaction.reply({ content: '❌ Sesión caducada.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const pubDate = interaction.fields.getTextInputValue('event_publish_date').trim();
    const pubTime = interaction.fields.getTextInputValue('event_publish_time').trim();
    const intervalRaw = interaction.fields.getTextInputValue('event_interval_days')?.trim() || '';
    const timesRaw = interaction.fields.getTextInputValue('event_repeat_times')?.trim() || '';

    const publishAt = parseMadridDateTime(pubDate, pubTime);
    if (!publishAt) {
        await interaction.reply({ 
            content: '❌ Formato de fecha u hora de publicación inválido (Usa DD/MM/YYYY y HH:MM).', 
            flags: [MessageFlags.Ephemeral] 
        });
        return true;
    }

    const intervalDays = intervalRaw ? parseInt(intervalRaw, 10) : 0;
    const totalTimes = timesRaw ? parseInt(timesRaw, 10) : 1;
    const repeats = intervalDays > 0 && totalTimes > 1;
    const intervalMs = intervalDays * 24 * 3600 * 1000;

    await col.updateOne(
        { _id: session._id },
        {
            $set: {
                publishAt,
                repeats,
                intervalMs,
                remainingTimes: repeats ? totalTimes : 1,
                status: 'pending_publish',
                rsvps: { yes: [], maybe: [], no: [] },
                createdAt: new Date()
            }
        }
    );
    let responseText = `✅ **¡Publicación programada con éxito!** El mensaje del evento se publicará automáticamente el **${pubDate}** a las **${pubTime} CET**.`;
    if (repeats) {
        responseText += `\n🔄 Se repetirá cada **${intervalDays} días** (**${totalTimes} envíos** en total).`;
    }

    await interaction.reply({
        content: responseText,
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}
