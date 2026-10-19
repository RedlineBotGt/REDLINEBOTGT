import { ObjectId } from 'mongodb';
import { 
    ButtonInteraction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ModalSubmitInteraction, 
    MessageFlags,
    ButtonStyle,
    ButtonBuilder,
    TextChannel,
    StringSelectMenuBuilder
} from 'discord.js';
import { getEventsCollection } from './eventosstorage';
import { parseMadridDateTime } from './eventosutils';
import { buildEventEmbedAndRows } from './eventosmanager';

// --- GESTIÓN DE BD EVENTOS (Listar eventos activos filtrados por servidor) ---
export async function handleBdEventosButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_bd_eventos') return false;

    const col = await getEventsCollection();
    // 🔒 Blindaje multiserver: Solo muestra eventos del guild actual
    const events = await col.find({ 
        guildId: interaction.guildId, 
        status: { $in: ['pending', 'sent', 'pending_publish'] } 
    }).toArray();

    if (events.length === 0) {
        await interaction.reply({
            content: '📭 No hay eventos activos o programados en la base de datos de este servidor.',
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
    // 🔒 Verificación de seguridad por guildId
    const ev = await col.findOne({ _id: new ObjectId(eventId), guildId: interaction.guildId });

    if (!ev) {
        await interaction.update({ content: '❌ El evento seleccionado ya no existe o no pertenece a este servidor.', components: [] });
        return true;
    }

    const rowActions = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`bd_event_edit_${ev._id}`)
            .setLabel('Editar Evento')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✏️'),
        new ButtonBuilder()
            .setCustomId(`bd_event_cancel_${ev._id}`)
            .setLabel('Cancelar Evento')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('✖️')
    );

    const pubInfo = ev.publishAt ? new Date(ev.publishAt).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) : 'Inmediato';

    await interaction.update({
        content: `⚙️ **Administrando Evento:**\n> **Título:** ${ev.title}\n> **Fecha del evento:**${ev.date} a las ${ev.time}\n> **Publicación:** ${pubInfo}\n> **Estado actual:** \`${ev.status}\``,
        components: [rowActions]
    });

    return true;
}

// --- EJECUTAR CANCELACIÓN DESDE LA BD ---
export async function handleBdEventosCancelAction(interaction: ButtonInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('bd_event_cancel_')) return false;

    const eventId = interaction.customId.replace('bd_event_cancel_', '');
    const col = await getEventsCollection();

    // 🔒 Verificación estricta por guildId antes de cancelar
    const updateResult = await col.updateOne(
        { _id: new ObjectId(eventId), guildId: interaction.guildId },
        { $set: { status: 'cancelled' } }
    );

    if (updateResult.matchedCount === 0) {
        await interaction.reply({ content: '❌ No se pudo encontrar el evento en este servidor.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    await interaction.update({
        content: '✅ **El evento ha sido cancelado con éxito** en la base de datos. El worker dejará de procesarlo y enviar avisos.',
        components: []
    });

    return true;
}

// --- ABRIR MODAL DE EDICIÓN COMPLETA DEL EVENTO ---
export async function handleBdEventosEditButton(interaction: ButtonInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('bd_event_edit_')) return false;

    const eventId = interaction.customId.replace('bd_event_edit_', '');
    const col = await getEventsCollection();
    // 🔒 Validación por guildId
    const ev = await col.findOne({ _id: new ObjectId(eventId), guildId: interaction.guildId });

    if (!ev) {
        await interaction.reply({ content: '❌ El evento ya no existe en este servidor.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const existingPub = ev.publishAt ? new Date(ev.publishAt) : new Date();
    const pubDateStr = existingPub.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' });
    const pubTimeStr = existingPub.toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false });

    const modal = new ModalBuilder()
        .setCustomId(`modal_event_edit_${eventId}`)
        .setTitle('✏️ Edición Completa del Evento');

    const titleInput = new TextInputBuilder()
        .setCustomId('edit_title')
        .setLabel('Título del Evento')
        .setStyle(TextInputStyle.Short)
        .setValue(ev.title || '')
        .setRequired(true);

    const eventDtInput = new TextInputBuilder()
        .setCustomId('edit_event_dt')
        .setLabel('Fecha y Hora del Evento (DD/MM/YYYY HH:MM)')
        .setStyle(TextInputStyle.Short)
        .setValue(`${ev.date || ''} ${ev.time || ''}`.trim())
        .setRequired(true);

    const pubDtInput = new TextInputBuilder()
        .setCustomId('edit_pub_dt')
        .setLabel('Publicar Tarjeta (DD/MM/YYYY HH:MM)')
        .setStyle(TextInputStyle.Short)
        .setValue(`${pubDateStr} ${pubTimeStr}`)
        .setRequired(true);

    const intervalInput = new TextInputBuilder()
        .setCustomId('edit_interval')
        .setLabel('Repetir cada X días (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setValue(ev.intervalMs ? String(ev.intervalMs / (24 * 3600 * 1000)) : '')
        .setRequired(false);

    const timesInput = new TextInputBuilder()
        .setCustomId('edit_times')
        .setLabel('Nº total de envíos (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setValue(ev.remainingTimes ? String(ev.remainingTimes) : '')
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(eventDtInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(pubDtInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(intervalInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(timesInput)
    );

    await interaction.showModal(modal);
    return true;
}

// --- GUARDAR CAMBIOS DE EDICIÓN COMPLETA Y ACTUALIZAR MENSAJE ---
export async function handleBdEventosEditModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('modal_event_edit_')) return false;

    const eventId = interaction.customId.replace('modal_event_edit_', '');
    const col = await getEventsCollection();
    // 🔒 Validación por guildId
    const ev = await col.findOne({ _id: new ObjectId(eventId), guildId: interaction.guildId });

    if (!ev) {
        await interaction.reply({ content: '❌ El evento ya no existe en este servidor.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const title = interaction.fields.getTextInputValue('edit_title').trim();
    const eventDtRaw = interaction.fields.getTextInputValue('edit_event_dt').trim();
    const pubDtRaw = interaction.fields.getTextInputValue('edit_pub_dt').trim();
    const intervalRaw = interaction.fields.getTextInputValue('edit_interval')?.trim() || '';
    const timesRaw = interaction.fields.getTextInputValue('edit_times')?.trim() || '';

    const [eventDateStr, eventTimeStr] = eventDtRaw.split(' ');
    const scheduledAt = parseMadridDateTime(eventDateStr, eventTimeStr);
    if (!scheduledAt) {
        await interaction.reply({ content: '❌ Formato de fecha u hora del evento inválido (Usa DD/MM/YYYY HH:MM).', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const [pubDateStr, pubTimeStr] = pubDtRaw.split(' ');
    const publishAt = parseMadridDateTime(pubDateStr, pubTimeStr);
    if (!publishAt) {
        await interaction.reply({ content: '❌ Formato de fecha u hora de publicación inválido (Usa DD/MM/YYYY HH:MM).', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const intervalDays = intervalRaw ? parseInt(intervalRaw, 10) : 0;
    const totalTimes = timesRaw ? parseInt(timesRaw, 10) : 1;
    const repeats = intervalDays > 0 && totalTimes > 1;
    const intervalMs = intervalDays * 24 * 3600 * 1000;

    await col.updateOne(
        { _id: new ObjectId(eventId), guildId: interaction.guildId },
        { 
            $set: { 
                title,
                date: eventDateStr,
                time: eventTimeStr,
                scheduledAt,
                publishAt,
                repeats,
                intervalMs,
                remainingTimes: repeats ? totalTimes : 1,
                reminderSent: false,
                updatedAt: new Date() 
            } 
        }
    );

    if (ev.status === 'sent' && ev.channelId && ev.messageId) {
        const guild = interaction.guild;
        if (guild) {
            const channel = await guild.channels.fetch(ev.channelId).catch(() => null) as TextChannel;
            if (channel && channel.isTextBased()) {
                const message = await channel.messages.fetch(ev.messageId).catch(() => null);
                if (message) {
                    const updatedEv = await col.findOne({ _id: new ObjectId(eventId), guildId: interaction.guildId });
                    const { embed, components } = buildEventEmbedAndRows(updatedEv);
                    await message.edit({ embeds: [embed], components }).catch(() => {});
                }
            }
        }
    }

    await interaction.reply({
        content: `✅ **¡Evento y programación actualizados con éxito de principio a fin!**`,
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}
