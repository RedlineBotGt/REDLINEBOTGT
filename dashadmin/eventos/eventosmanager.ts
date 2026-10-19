import { 
    ActionRowBuilder, 
    ButtonStyle, 
    ButtonBuilder, 
    EmbedBuilder 
} from 'discord.js';

// --- HELPER CENTRAL: CONSTRUCTOR ÚNICO DE EMBEDS Y COMPONENTES VISUALES ---
export function buildEventEmbedAndRows(ev: any) {
    const rsvps = ev.rsvps || { yes: [], maybe: [], no: [] };
    const formatVerticalList = (ids: string[]) => ids.length > 0 ? ids.map(id => `<@${id}>`).join('\n') : 'Ninguno';

    const isClosed = ev.status === 'completed' || ev.status === 'cancelled';

    const embed = new EmbedBuilder()
        .setColor(isClosed ? 0x808080 : 0x0055FF)
        .setTitle(isClosed ? `🔒 [FINALIZADO] ${ev.title}` : `🏁 ${ev.title}`)
        .setDescription(`📅 **Fecha:** ${ev.date} a las ${ev.time} CET\n\n${ev.description}`)
        .setTimestamp();

    if (ev.image) embed.setImage(ev.image);

    embed.addFields(
        { name: `✅ Asistiré (${rsvps.yes.length}/16)`, value: formatVerticalList(rsvps.yes), inline: false },
        { name: `❔ Duda (${rsvps.maybe.length})`, value: formatVerticalList(rsvps.maybe), inline: false },
        { name: `❌ No puedo (${rsvps.no.length})`, value: formatVerticalList(rsvps.no), inline: false }
    );

    const rowRsvp = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('event_rsvp_yes').setLabel('Asistiré').setStyle(ButtonStyle.Success).setEmoji('✅').setDisabled(isClosed),
        new ButtonBuilder().setCustomId('event_rsvp_maybe').setLabel('Duda').setStyle(ButtonStyle.Secondary).setEmoji('❓').setDisabled(isClosed),
        new ButtonBuilder().setCustomId('event_rsvp_no').setLabel('No puedo').setStyle(ButtonStyle.Danger).setEmoji('✖️').setDisabled(isClosed)
    );

    const rowAdmin = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('event_admin_manage').setLabel('Gestión Admin').setStyle(ButtonStyle.Secondary).setEmoji('⚙️').setDisabled(isClosed)
    );

    return { embed, components: isClosed ? [rowRsvp] : [rowRsvp, rowAdmin] };
}
