import { 
    ModalSubmitInteraction, 
    EmbedBuilder, 
    TextChannel 
} from 'discord.js';

export async function handleVeredictoModalSubmit(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith('modal_veredicto_')) return false;

    // Recuperamos el ID del canal y del rol que guardamos en el customId
    const parts = interaction.customId.split('_');
    const canalId = parts[2];
    const rolId = parts[3];

    const guild = interaction.guild!;
    const serverName = guild.name;

    // Capturamos los 5 campos del formulario
    const reportId = interaction.fields.getTextInputValue('input_verd_report_id').trim();
    const pilotoReporta = interaction.fields.getTextInputValue('input_verd_reporta');
    const pilotoDefendio = interaction.fields.getTextInputValue('input_verd_defendio');
    const resolucion = interaction.fields.getTextInputValue('input_verd_resolucion');
    const sancion = interaction.fields.getTextInputValue('input_verd_sancion');

    // Respondemos de forma privada al usuario al instante
    await interaction.reply({
        content: `✅ ¡Veredicto registrado con éxito para el reporte **🆔 ${reportId}**!`,
        ephemeral: true
    });

    // Comprobación de seguridad: Si el rol seleccionado es @everyone (su ID es el ID del servidor),
    // lo adaptamos para que no pete la API de Discord. Si es un rol normal, usamos la mención de rol.
    const mentionText = (rolId === guild.id) ? '@everyone' : `<@&${rolId}>`;

    // Construimos el Embed Verde oficial de Veredicto
    const embedVeredicto = new EmbedBuilder()
        .setTitle(`⚖️ VEREDICTO OFICIAL - 🆔 ${reportId}`)
        .setColor(0x00FF00) // Verde
        .addFields(
            { name: '👤 Reportó', value: pilotoReporta, inline: true },
            { name: '🛡️ Defendió', value: pilotoDefendio, inline: true },
            { name: '📋 Resolución', value: resolucion, inline: false },
            { name: '⚠️ Sanción / Medida', value: sancion, inline: false }
        )
        .setFooter({ text: serverName })
        .setTimestamp();

    // Enviamos el resultado al canal elegido con la mención correspondiente
    try {
        const canalDestino = await guild.channels.fetch(canalId) as TextChannel;
        if (canalDestino) {
            await canalDestino.send({
                content: `📢 ${mentionText} Nuevo veredicto oficial emitido para el reporte **🆔 ${reportId}**.`,
                embeds: [embedVeredicto]
            });
        }
    } catch (error) {
        console.error('❌ Error al enviar el veredicto al canal de destino:', error);
    }

    return true;
}
