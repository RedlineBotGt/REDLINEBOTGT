import {
    ActionRowBuilder,
    ButtonStyle,
    ButtonBuilder,
    EmbedBuilder,
    Guild
} from 'discord.js';

export async function buildEventEmbedAndRows(ev: any, guild?: Guild | null) {
    const rsvps = ev.rsvps || {};
    const yesList: string[] = Array.isArray(rsvps.yes) ? rsvps.yes : [];
    const reserveList: string[] = Array.isArray(rsvps.reserve) ? rsvps.reserve : [];
    const maybeList: string[] = Array.isArray(rsvps.maybe) ? rsvps.maybe : [];
    const noList: string[] = Array.isArray(rsvps.no) ? rsvps.no : [];

    // Discord resolverá cada mención y mostrará el nombre normal de la cuenta.
    // Las menciones dentro del embed no generan avisos individuales.
    const formatVerticalList = (ids: string[]) => {
        if (!ids || ids.length === 0) return 'Ninguno';
        return ids.map(id => `<@${id}>`).join('\\n');
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
        .setDescription(`📅 **Fecha:** ${ev.date || 'Por determinar'} a las ${ev.time || '00:00'} CET\\n\\n${ev.description || 'Sin descripción'}`);

    if (ev.image && typeof ev.image === 'string' && ev.image.startsWith('http')) {
        embed.setImage(ev.image);
    }

    embed.addFields(
        {
            name: '\\u200B',
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
