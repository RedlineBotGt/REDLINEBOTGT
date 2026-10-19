import { 
    ButtonInteraction, 
    ActionRowBuilder, 
    MessageFlags,
    ButtonStyle,
    ButtonBuilder,
    TextChannel,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder
} from 'discord.js';
import { getEventsCollection } from './eventosstorage';
import { buildEventEmbedAndRows } from './eventosmanager';

export const adminAdminSessions = new Map<string, { targetUserId?: string; status?: string; eventMessageId: string }>();

// --- 1. ABRIR PANEL ADMIN DE PILOTOS ---
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
    // 🔒 Verificación multiserver por guildId
    const eventDoc = await col.findOne({ messageId, guildId: interaction.guildId });

    if (!eventDoc || eventDoc.status === 'completed' || eventDoc.status === 'cancelled') {
        await interaction.update({ content: '❌ Este evento ya no está activo en este servidor.', components: [] });
        return true;
    }

    if (!eventDoc.rsvps) eventDoc.rsvps = { yes: [], maybe: [], no: [] };

    // Limpieza estricta de todos los estados previos
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

    await col.updateOne({ messageId, guildId: interaction.guildId }, { $set: { rsvps: eventDoc.rsvps } });

    const channel = await guild.channels.fetch(eventDoc.channelId).catch(() => null) as TextChannel;
    if (channel) {
        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (message) {
            const { embed, components } = buildEventEmbedAndRows(eventDoc);
            await message.edit({ embeds: [embed], components }).catch(() => {});
        }
    }

    await interaction.update({
        content: `✅ Asistencia actualizada correctamente para el usuario <@${targetUserId}> como **${targetStatus}**.`,
        components: []
    });

    return true;
}

// --- GESTIÓN DE RSVP Y LÍMITE DE 16 PLAZAS (SIN PROMOCIÓN AUTOMÁTICA) ---
export async function handleEventRsvpButton(interaction: ButtonInteraction): Promise<boolean> {
    const customId = interaction.customId;
    if (!['event_rsvp_yes', 'event_rsvp_maybe', 'event_rsvp_no'].includes(customId)) return false;

    const userId = interaction.user.id;
    const messageId = interaction.message.id;
    const guild = interaction.guild;

    if (!guild) return true;

    const col = await getEventsCollection();
    // 🔒 Verificación multiserver por guildId
    const eventDoc = await col.findOne({ messageId, guildId: interaction.guildId });

    if (!eventDoc || eventDoc.status === 'completed' || eventDoc.status === 'cancelled') {
        await interaction.reply({ 
            content: '❌ Este evento ya ha finalizado o no está activo. No se aceptan más cambios de asistencia.', 
            flags: [MessageFlags.Ephemeral] 
        });
        return true;
    }

    if (!eventDoc.rsvps) eventDoc.rsvps = { yes: [], maybe: [], no: [] };

    // Limpieza previa garantizada de todas las listas
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

    await col.updateOne({ messageId, guildId: interaction.guildId }, { $set: { rsvps: eventDoc.rsvps } });

    const { embed, components } = buildEventEmbedAndRows(eventDoc);
    await interaction.message.edit({ embeds: [embed], components }).catch(() => {});

    await interaction.reply({
        content: responseContent,
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}
