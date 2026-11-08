import {
    ActionRowBuilder,
    ButtonStyle,
    ButtonBuilder,
    EmbedBuilder,
    Guild
} from 'discord.js';

/**
 * Resuelve los nombres de los participantes sin modificar los IDs guardados.
 * Los miembros del servidor se mostrarán como menciones reales.
 * Si una cuenta ya no pertenece al servidor, se conserva su nombre como fallback.
 */
async function resolveParticipantNames(
    ids: string[],
    guild?: Guild | null
): Promise<{ names: Map<string, string>; memberIds: Set<string> }> {
    const uniqueIds = [...new Set(ids.filter(id => typeof id === 'string' && id.length > 0))];
    const names = new Map<string, string>();
    const memberIds = new Set<string>();
    const pending: string[] = [];

    for (const id of uniqueIds) {
        const member = guild?.members.cache.get(id);

        if (member) {
            names.set(id, member.displayName || member.user.username);
            memberIds.add(id);
        } else {
            pending.push(id);
        }
    }

    if (!guild || pending.length === 0) {
        return { names, memberIds };
    }

    // Limitar concurrencia para no generar una ráfaga de peticiones a Discord.
    let nextIndex = 0;

    const worker = async () => {
        while (nextIndex < pending.length) {
            const id = pending[nextIndex++];

            try {
                const member = await guild.members.fetch(id);
                names.set(id, member.displayName || member.user.username);
                memberIds.add(id);
                continue;
            } catch {
                // El usuario puede haber salido del servidor.
            }

            try {
                const user = await guild.client.users.fetch(id);
                names.set(id, user.globalName || user.username);
            } catch {
                // Se mantiene la mención como último recurso.
            }
        }
    };

    await Promise.all(
        Array.from({ length: Math.min(4, pending.length) }, () => worker())
    );

    return { names, memberIds };
}

export async function buildEventEmbedAndRows(ev: any, guild?: Guild | null) {
    const rsvps = ev.rsvps || {};
    const yesList: string[] = Array.isArray(rsvps.yes) ? rsvps.yes : [];
    const reserveList: string[] = Array.isArray(rsvps.reserve) ? rsvps.reserve : [];
    const maybeList: string[] = Array.isArray(rsvps.maybe) ? rsvps.maybe : [];
    const noList: string[] = Array.isArray(rsvps.no) ? rsvps.no : [];

    const participantIds = [...yesList, ...reserveList, ...maybeList, ...noList];
    const {
        names: participantNames,
        memberIds: guildMemberIds
    } = await resolveParticipantNames(participantIds, guild);

    const formatVerticalList = (ids: string[]) => {
        if (!ids || ids.length === 0) return 'Ninguno';

        return ids.map(id => {
            // Los miembros actuales se muestran con el formato nativo de mención de Discord.
            if (guildMemberIds.has(id)) return `<@${id}>`;

            // Si la cuenta ya no está en el servidor, mostramos el nombre como fallback.
            const name = participantNames.get(id);
            return name ? `**@${name}**` : `<@${id}>`;
        }).join('\n');
    };

    const isClosed = ev.status === 'completed' || ev.status === 'cancelled';

    const embed = new EmbedBuilder()
        .setColor(isClosed ? 0x808080 : 0x0055FF)
        .setTitle(isClosed ? `🔒 [FINALIZADO] ${ev.title}` : `🏁 ${ev.title}`)
        .setDescription(`📅 **Fecha:** ${ev.date || 'Por determinar'} a las ${ev.time || '00:00'} CET\n\n${ev.description || 'Sin descripción'}`)
        .setTimestamp();

    if (ev.image && typeof ev.image === 'string' && ev.image.startsWith('http')) {
        embed.setImage(ev.image);
    }

    embed.addFields(
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
