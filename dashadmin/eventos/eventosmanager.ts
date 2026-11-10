import {
    ActionRowBuilder,
    ButtonStyle,
    ButtonBuilder,
    EmbedBuilder,
    Guild
} from 'discord.js';

/**
 * Resuelve los nombres visibles de los participantes.
 * En el listado del evento se muestran nombres, nunca menciones de Discord,
 * para que el resultado sea estable en escritorio y móvil.
 */
async function resolveParticipantNames(
    ids: string[],
    guild?: Guild | null
): Promise<Map<string, string>> {
    const uniqueIds = [...new Set(ids.filter(id => typeof id === 'string' && id.length > 0))];
    const names = new Map<string, string>();
    const pending: string[] = [];

    for (const id of uniqueIds) {
        const member = guild?.members.cache.get(id);

        if (member) {
            names.set(id, member.displayName || member.user.globalName || member.user.username);
        } else {
            pending.push(id);
        }
    }

    if (!guild || pending.length === 0) return names;

    let nextIndex = 0;

    const worker = async () => {
        while (nextIndex < pending.length) {
            const id = pending[nextIndex++];

            try {
                const member = await guild.members.fetch(id);
                names.set(id, member.displayName || member.user.globalName || member.user.username);
                continue;
            } catch {
                // Si no es miembro del servidor, intentamos obtener su nombre de usuario.
            }

            try {
                const user = await guild.client.users.fetch(id);
                names.set(id, user.globalName || user.username);
            } catch {
                // Si Discord no permite resolverlo, se mostrará un texto neutro.
            }
        }
    };

    await Promise.all(
        Array.from({ length: Math.min(4, pending.length) }, () => worker())
    );

    return names;
}

export async function buildEventEmbedAndRows(ev: any, guild?: Guild | null) {
    const rsvps = ev.rsvps || {};
    const yesList: string[] = Array.isArray(rsvps.yes) ? rsvps.yes : [];
    const reserveList: string[] = Array.isArray(rsvps.reserve) ? rsvps.reserve : [];
    const maybeList: string[] = Array.isArray(rsvps.maybe) ? rsvps.maybe : [];
    const noList: string[] = Array.isArray(rsvps.no) ? rsvps.no : [];

    const participantIds = [...yesList, ...reserveList, ...maybeList, ...noList];
    const participantNames = await resolveParticipantNames(participantIds, guild);

    const formatVerticalList = (ids: string[]) => {
        if (!ids || ids.length === 0) return 'Ninguno';

        return ids.map(id => participantNames.get(id) || 'Usuario no disponible').join('\\n');
    };

    const isClosed = ev.status === 'completed' || ev.status === 'cancelled';

    const updatedTime = new Intl.DateTimeFormat('es-ES', {
        timeZone: 'Europe/Madrid',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(new Date());

    const embed = new EmbedBuilder()
        .setColor(isClosed ? 0x808080 : 0x0055FF)
        .setTitle(isClosed ? `🔒 [FINALIZADO] ${ev.title}` : `🏁 ${ev.title}`)
        .setDescription(`📅 **Fecha:** ${ev.date || 'Por determinar'} a las ${ev.time || '00:00'} CET\n\n${ev.description || 'Sin descripción'}`);

    if (ev.image && typeof ev.image === 'string' && ev.image.startsWith('http')) {
        embed.setImage(ev.image);
    }

    embed.addFields(
        {
            name: '\u200B',
            value: `**🕒 ACTUALIZADO · HOY A LAS ${updatedTime}**`,
            inline: false
        },
        {
            name: `✅ Titulares (${yesList.length}/15)`,
            value: formatVerticalList(yesList),
            inline: false
        },
        {
            name: `🔃 Reservas (${reserveList.length}/11)`,
            value: formatVerticalList(reserveList),
            inline: false
        },
        {
            name: `❔ Duda (${maybeList.length})`,
            value: formatVerticalList(maybeList),
            inline: false
        },
        {
            name: `❌ No puedo (${noList.length})`,
            value: formatVerticalList(noList),
            inline: false
        }
    );

    const rowRsvp = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('event_rsvp_yes')
            .setLabel('Titulares')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅')
            .setDisabled(isClosed),

        new ButtonBuilder()
            .setCustomId('event_rsvp_reserve')
            .setLabel('Reserva')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔃')
            .setDisabled(isClosed),

        new ButtonBuilder()
            .setCustomId('event_rsvp_maybe')
            .setLabel('Duda')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❓')
            .setDisabled(isClosed),

        new ButtonBuilder()
            .setCustomId('event_rsvp_no')
            .setLabel('No puedo')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('✖️')
            .setDisabled(isClosed)
    );

    const rowAdmin = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('event_admin_manage')
            .setLabel('Gestión Admin')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⚙️')
            .setDisabled(isClosed)
    );

    return {
        embed,
        components: isClosed ? [rowRsvp] : [rowRsvp, rowAdmin]
    };
}
