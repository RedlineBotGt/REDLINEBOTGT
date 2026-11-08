import {
    ButtonInteraction,
    ActionRowBuilder,
    MessageFlags,
    ButtonStyle,
    ButtonBuilder,
    TextChannel,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
    GuildMember
} from 'discord.js';

import { getEventsCollection } from './eventosstorage';
import { buildEventEmbedAndRows } from './eventosmanager';

const MAX_PILOTOS = 15;

export const adminAdminSessions = new Map<string, {
    targetUserId?: string;
    status?: string;
    eventMessageId: string
}>();

/**
 * Si el evento ya ha llegado a T-30 y un titular causa baja,
 * promociona al primer reserva disponible.
 *
 * Devuelve el ID del piloto promocionado o null si no hay reserva.
 */
async function promocionarPrimerReserva(
    eventDoc: any,
    guild: any
): Promise<string | null> {
    try {
        if (!eventDoc.reminderSent) return null;

        const scheduledAt = new Date(eventDoc.scheduledAt).getTime();

        // No promocionar después de la hora de comienzo.
        if (!Number.isFinite(scheduledAt) || scheduledAt <= Date.now()) {
            return null;
        }

        if (!eventDoc.rsvps || !Array.isArray(eventDoc.rsvps.reserve)) {
            return null;
        }

        if (!Array.isArray(eventDoc.rsvps.yes)) {
            eventDoc.rsvps.yes = [];
        }

        if (eventDoc.rsvps.yes.length >= MAX_PILOTOS) {
            return null;
        }

        // La primera reserva siempre tiene prioridad.
        let promotedUserId: string | null = null;

        while (eventDoc.rsvps.reserve.length > 0) {
            const candidateId = eventDoc.rsvps.reserve.shift();

            if (
                typeof candidateId === 'string' &&
                candidateId.length > 0 &&
                !eventDoc.rsvps.yes.includes(candidateId)
            ) {
                promotedUserId = candidateId;
                break;
            }
        }

        if (!promotedUserId) return null;

        eventDoc.rsvps.yes.push(promotedUserId);

        // Mantener el rol asistente del piloto promocionado.
        const member = await guild.members.fetch(promotedUserId).catch(() => null);

        if (member) {
            let asistenteRole = guild.roles.cache.find(
                (role: any) => role.name.toLowerCase() === 'asistente'
            );

            if (!asistenteRole) {
                asistenteRole = await guild.roles.create({
                    name: 'asistente',
                    color: 0x00FF00,
                    mentionable: true,
                    reason: 'Rol automático para piloto promocionado de reserva.'
                });
            }

            if (asistenteRole && !member.roles.cache.has(asistenteRole.id)) {
                await member.roles.add(asistenteRole).catch(() => {});
            }
        }

        console.log(
            `🔃 [RSVP] Reserva ${promotedUserId} promocionada a titular para "${eventDoc.title}".`
        );

        return promotedUserId;

    } catch (error) {
        console.error('❌ Error promocionando reserva:', error);
        return null;
    }
}

/**
 * Avisa individualmente al piloto que acaba de entrar en titulares.
 */
async function avisarReservaPromocionada(
    eventDoc: any,
    guild: any,
    userId: string
): Promise<void> {
    try {
        const channel = await guild.channels.fetch(eventDoc.channelId).catch(() => null) as TextChannel;

        if (!channel || !channel.isTextBased()) return;

        await channel.send({
            content:
                `🎉 <@${userId}> **¡Has conseguido plaza como TITULAR!**\n` +
                `Se ha producido una baja en el evento **"${eventDoc.title}"** y entras por orden de reserva.\n` +
                `¡Te esperamos en pista!`,
            allowedMentions: {
                users: [userId]
            }
        });

    } catch (error) {
        console.error('❌ Error avisando al reserva promocionado:', error);
    }
}

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
            { label: '🔃 Reserva', value: 'reserve', description: 'Añadir a lista de reservas' },
            { label: '❔ Duda', value: 'maybe', description: 'Añadir a lista de duda' },
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
        await interaction.reply({
            content: '❌ Sesión caducada. Vuelve a abrir el panel de gestión.',
            flags: [MessageFlags.Ephemeral]
        });
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
        await interaction.reply({
            content: '❌ Sesión caducada. Vuelve a abrir el panel de gestión.',
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    session.status = interaction.values[0];
    adminAdminSessions.set(sessionId, session);

    const statusNames: Record<string, string> = {
        yes: 'Asistiré',
        reserve: 'Reserva',
        maybe: 'Duda',
        no: 'No puedo'
    };

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
        await interaction.reply({
            content: '❌ Debes seleccionar tanto un **usuario** como un **estado** antes de confirmar.',
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    const targetUserId = session.targetUserId;
    const targetStatus = session.status;
    const messageId = session.eventMessageId;

    adminAdminSessions.delete(sessionId);

    const guild = interaction.guild;
    if (!guild) return true;

    const col = await getEventsCollection();
    const eventDoc = await col.findOne({
        messageId,
        guildId: interaction.guildId
    });

    if (!eventDoc || eventDoc.status === 'completed' || eventDoc.status === 'cancelled') {
        await interaction.update({
            content: '❌ Este evento ya no está activo en este servidor.',
            components: []
        });
        return true;
    }

    if (!eventDoc.rsvps) {
        eventDoc.rsvps = { yes: [], reserve: [], maybe: [], no: [] };
    }

    if (!Array.isArray(eventDoc.rsvps.yes)) eventDoc.rsvps.yes = [];
    if (!Array.isArray(eventDoc.rsvps.reserve)) eventDoc.rsvps.reserve = [];
    if (!Array.isArray(eventDoc.rsvps.maybe)) eventDoc.rsvps.maybe = [];
    if (!Array.isArray(eventDoc.rsvps.no)) eventDoc.rsvps.no = [];

    const yaEraTitular = eventDoc.rsvps.yes.includes(targetUserId);

    if (
        targetStatus === 'yes' &&
        !yaEraTitular &&
        eventDoc.rsvps.yes.length >= MAX_PILOTOS
    ) {
        await interaction.update({
            content: `❌ No se puede añadir a <@${targetUserId}> como titular. Ya están ocupadas las **${MAX_PILOTOS} plazas de titulares**. Las reservas no cuentan para este límite.`,
            components: []
        });
        return true;
    }

    // Limpiar todos los estados anteriores.
    eventDoc.rsvps.yes = eventDoc.rsvps.yes.filter((id: string) => id !== targetUserId);
    eventDoc.rsvps.reserve = eventDoc.rsvps.reserve.filter((id: string) => id !== targetUserId);
    eventDoc.rsvps.maybe = eventDoc.rsvps.maybe.filter((id: string) => id !== targetUserId);
    eventDoc.rsvps.no = eventDoc.rsvps.no.filter((id: string) => id !== targetUserId);

    let asistenteRole = guild.roles.cache.find(
        r => r.name.toLowerCase() === 'asistente'
    );

    if (!asistenteRole) {
        try {
            asistenteRole = await guild.roles.create({
                name: 'asistente',
                color: 0x00FF00,
                mentionable: true,
                reason: 'Rol automático creado para gestión de asistencias.'
            });
        } catch (e) {
            console.error('❌ Error creando rol asistente:', e);
        }
    }

    const member = await guild.members.fetch(targetUserId).catch(() => null);

    if (targetStatus === 'yes') {
        eventDoc.rsvps.yes.push(targetUserId);
        if (asistenteRole && member) {
            await member.roles.add(asistenteRole).catch(() => {});
        }
    } else if (targetStatus === 'reserve') {
        eventDoc.rsvps.reserve.push(targetUserId);
        if (asistenteRole && member) {
            await member.roles.add(asistenteRole).catch(() => {});
        }
    } else if (targetStatus === 'maybe') {
        eventDoc.rsvps.maybe.push(targetUserId);
        if (asistenteRole && member) {
            await member.roles.add(asistenteRole).catch(() => {});
        }
    } else if (targetStatus === 'no') {
        eventDoc.rsvps.no.push(targetUserId);

        if (asistenteRole && member && member.roles.cache.has(asistenteRole.id)) {
            await member.roles.remove(asistenteRole).catch(() => {});
        }
    }

    // Si el administrador da de baja a un titular, cubrir la plaza.
    let promotedUserId: string | null = null;

    if (targetStatus === 'no' && yaEraTitular) {
        promotedUserId = await promocionarPrimerReserva(eventDoc, guild);
    }

    await col.updateOne(
        { messageId, guildId: interaction.guildId },
        { $set: { rsvps: eventDoc.rsvps } }
    );

    const channel = await guild.channels.fetch(eventDoc.channelId).catch(() => null) as TextChannel;

    if (channel) {
        const message = await channel.messages.fetch(messageId).catch(() => null);

        if (message) {
            const { embed, components } = await buildEventEmbedAndRows(eventDoc, guild);
            await message.edit({ embeds: [embed], components }).catch(() => {});
        }
    }

    if (promotedUserId) {
        await avisarReservaPromocionada(eventDoc, guild, promotedUserId);
    }

    let confirmation =
        `✅ Asistencia actualizada correctamente para el usuario <@${targetUserId}> como **${targetStatus}**.`;

    if (promotedUserId) {
        confirmation += `\n🔃 <@${promotedUserId}> ha sido promocionado automáticamente de reserva a titular.`;
    }

    await interaction.update({
        content: confirmation,
        components: []
    });

    return true;
}

// --- 5. GESTIÓN DE RSVP Y RESTRICCIÓN ESTRICTA DE ROLES ---
export async function handleEventRsvpButton(interaction: ButtonInteraction): Promise<boolean> {
    const customId = interaction.customId;

    if (![
        'event_rsvp_yes',
        'event_rsvp_reserve',
        'event_rsvp_maybe',
        'event_rsvp_no'
    ].includes(customId)) return false;

    const userId = interaction.user.id;
    const messageId = interaction.message.id;
    const guild = interaction.guild;

    if (!guild) return true;

    const member = interaction.member as GuildMember;
    if (!member) return true;

    // Detectar roles por nombre.
    const isTitular = member.roles.cache.some(
        r => r.name.toLowerCase().includes('titular')
    );

    const isReserva = member.roles.cache.some(
        r => r.name.toLowerCase().includes('reserva')
    );

    // Restricción 1: Botón Reserva.
    if (customId === 'event_rsvp_reserve') {
        if (isTitular) {
            await interaction.reply({
                content: '❌ Como **Piloto Titular**, no puedes apuntarte en la lista de reservas.',
                flags: [MessageFlags.Ephemeral]
            });
            return true;
        }

        if (!isReserva) {
            await interaction.reply({
                content: '❌ Necesitas tener el rol de **Reserva** para poder apuntarte en esta lista.',
                flags: [MessageFlags.Ephemeral]
            });
            return true;
        }
    }

    // Restricción 2: Botón Asistiré.
    if (customId === 'event_rsvp_yes') {
        if (isReserva) {
            await interaction.reply({
                content: '❌ Como **Piloto Reserva**, no puedes confirmarte directamente en verde. Pulsa el botón 🔃 **Reserva**.',
                flags: [MessageFlags.Ephemeral]
            });
            return true;
        }

        if (!isTitular) {
            await interaction.reply({
                content: '❌ Necesitas tener el rol de **Titular** para confirmar asistencia en verde.',
                flags: [MessageFlags.Ephemeral]
            });
            return true;
        }
    }

    const col = await getEventsCollection();
    const eventDoc = await col.findOne({
        messageId,
        guildId: interaction.guildId
    });

    if (!eventDoc || eventDoc.status === 'completed' || eventDoc.status === 'cancelled') {
        await interaction.reply({
            content: '❌ Este evento ya ha finalizado o no está activo. No se aceptan más cambios de asistencia.',
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    if (!eventDoc.rsvps) {
        eventDoc.rsvps = { yes: [], reserve: [], maybe: [], no: [] };
    }

    if (!Array.isArray(eventDoc.rsvps.yes)) eventDoc.rsvps.yes = [];
    if (!Array.isArray(eventDoc.rsvps.reserve)) eventDoc.rsvps.reserve = [];
    if (!Array.isArray(eventDoc.rsvps.maybe)) eventDoc.rsvps.maybe = [];
    if (!Array.isArray(eventDoc.rsvps.no)) eventDoc.rsvps.no = [];

    const yaEraTitular = eventDoc.rsvps.yes.includes(userId);

    if (
        customId === 'event_rsvp_yes' &&
        !yaEraTitular &&
        eventDoc.rsvps.yes.length >= MAX_PILOTOS
    ) {
        await interaction.reply({
            content: `❌ Ya están ocupadas las **${MAX_PILOTOS} plazas de titulares**. Puedes seguir apuntándote como reserva si tienes el rol correspondiente.`,
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    // Limpiar todos los estados anteriores.
    eventDoc.rsvps.yes = eventDoc.rsvps.yes.filter((id: string) => id !== userId);
    eventDoc.rsvps.reserve = eventDoc.rsvps.reserve.filter((id: string) => id !== userId);
    eventDoc.rsvps.maybe = eventDoc.rsvps.maybe.filter((id: string) => id !== userId);
    eventDoc.rsvps.no = eventDoc.rsvps.no.filter((id: string) => id !== userId);

    let asistenteRole = guild.roles.cache.find(
        r => r.name.toLowerCase() === 'asistente'
    );

    if (!asistenteRole) {
        try {
            asistenteRole = await guild.roles.create({
                name: 'asistente',
                color: 0x00FF00,
                mentionable: true,
                reason: 'Rol automático creado para gestión de asistencias.'
            });
        } catch (e) {
            console.error('❌ Error creando rol asistente:', e);
        }
    }

    let responseContent = '';

    if (customId === 'event_rsvp_yes') {
        eventDoc.rsvps.yes.push(userId);
        responseContent = '✅ ¡Tu asistencia (**Asistiré**) ha quedado registrada!';

        if (asistenteRole && !member.roles.cache.has(asistenteRole.id)) {
            await member.roles.add(asistenteRole).catch(() => {});
        }

    } else if (customId === 'event_rsvp_reserve') {
        eventDoc.rsvps.reserve.push(userId);
        responseContent = '🔃 ¡Te has registrado correctamente en la lista de **Reservas**!';

        if (asistenteRole && !member.roles.cache.has(asistenteRole.id)) {
            await member.roles.add(asistenteRole).catch(() => {});
        }

    } else if (customId === 'event_rsvp_maybe') {
        eventDoc.rsvps.maybe.push(userId);
        responseContent = '❓ Tu estado (**Duda**) ha quedado registrado.';

        if (asistenteRole && !member.roles.cache.has(asistenteRole.id)) {
            await member.roles.add(asistenteRole).catch(() => {});
        }

    } else if (customId === 'event_rsvp_no') {
        eventDoc.rsvps.no.push(userId);
        responseContent = '❌ Tu asistencia ha sido marcada como **No puedo**.';

        if (asistenteRole && member.roles.cache.has(asistenteRole.id)) {
            await member.roles.remove(asistenteRole).catch(() => {});
        }
    }

    // Si un titular causa baja después de T-30, promocionar al primero de la reserva.
    let promotedUserId: string | null = null;

    if (customId === 'event_rsvp_no' && yaEraTitular) {
        promotedUserId = await promocionarPrimerReserva(eventDoc, guild);
    }

    await col.updateOne(
        { messageId, guildId: interaction.guildId },
        { $set: { rsvps: eventDoc.rsvps } }
    );

    const { embed, components } = await buildEventEmbedAndRows(eventDoc, guild);
    await interaction.message.edit({ embeds: [embed], components }).catch(() => {});

    if (promotedUserId) {
        await avisarReservaPromocionada(eventDoc, guild, promotedUserId);
        responseContent += `\n🔃 <@${promotedUserId}> ha entrado automáticamente como titular.`;
    }

    await interaction.reply({
        content: responseContent,
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}