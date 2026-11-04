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
