import { 
    ActionRowBuilder, 
    ButtonStyle, 
    ButtonBuilder, 
    EmbedBuilder 
} from 'discord.js';

export function buildEventEmbedAndRows(ev: any) {
    const rsvps = ev.rsvps || {};
    const yesList: string[] = Array.isArray(rsvps.yes) ? rsvps.yes : [];
    const reserveList: string[] = Array.isArray(rsvps.reserve) ? rsvps.reserve : [];
    const maybeList: string[] = Array.isArray(rsvps.maybe) ? rsvps.maybe : [];
    const noList: string[] = Array.isArray(rsvps.no) ? rsvps.no : [];

    const formatVerticalList = (ids: string[]) => {
        if (!ids || ids.length === 0) return 'Ninguno';
        return ids.map(id => `<@${id}>`).join('\n');
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
        { name: `✅ Asistiré (${yesList.length}/15)`, value: formatVerticalList(yesList), inline: false }, // 👈 Cambiado a /15
        { name: `🔃 Reserva (${reserveList.length})`, value: formatVerticalList(reserveList), inline: false },
        { name: `❔ Duda (${maybeList.length})`, value: formatVerticalList(maybeList), inline: false },
        { name: `❌ No puedo (${noList.length})`, value: formatVerticalList(noList), inline: false }
    );

    // 🖲️ Botón con emoji '🔃' totalmente compatible con la API de Discord
    const rowRsvp = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('event_rsvp_yes').setLabel('Asistiré').setStyle(ButtonStyle.Success).setEmoji('✅').setDisabled(isClosed),
        new ButtonBuilder().setCustomId('event_rsvp_reserve').setLabel('Reserva').setStyle(ButtonStyle.Primary).setEmoji('🔃').setDisabled(isClosed),
        new ButtonBuilder().setCustomId('event_rsvp_maybe').setLabel('Duda').setStyle(ButtonStyle.Secondary).setEmoji('❓').setDisabled(isClosed),
        new ButtonBuilder().setCustomId('event_rsvp_no').setLabel('No puedo').setStyle(ButtonStyle.Danger).setEmoji('✖️').setDisabled(isClosed)
    );

    const rowAdmin = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('event_admin_manage').setLabel('Gestión Admin').setStyle(ButtonStyle.Secondary).setEmoji('⚙️').setDisabled(isClosed)
    );

    return { embed, components: isClosed ? [rowRsvp] : [rowRsvp, rowAdmin] };
}
