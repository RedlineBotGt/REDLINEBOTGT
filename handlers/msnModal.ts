import { 
    ModalSubmitInteraction, 
    TextChannel 
} from 'discord.js';

export async function handleMsnModalSubmit(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith('modal_msn_')) return false;

    // Recuperamos el ID del canal y del rol del customId
    const parts = interaction.customId.split('_');
    const canalId = parts[2];
    const rolId = parts[3]; // <-- ¡Aquí recogemos el rol!

    const guild = interaction.guild!;
    const texto = interaction.fields.getTextInputValue('input_msn_texto');
    const imagen = interaction.fields.getTextInputValue('input_msn_imagen').trim();

    // Respondemos de forma privada al emisor
    await interaction.reply({
        content: `✅ ¡Mensaje enviado con éxito al canal seleccionado!`,
        ephemeral: true
    });

    try {
        const canalDestino = await guild.channels.fetch(canalId) as TextChannel;
        if (canalDestino) {
            let mensajeFinal = texto;

            // Si se seleccionó un rol, lo inyectamos arriba de forma segura
            if (rolId && rolId !== 'none') {
                const mentionText = (rolId === guild.id) ? '@everyone' : `<@&${rolId}>`;
                mensajeFinal = `${mentionText}\n${texto}`;
            }

            if (imagen) {
                mensajeFinal += `\n${imagen}`;
            }

            await canalDestino.send({
                content: mensajeFinal
            });
        }
    } catch (error) {
        console.error('❌ Error al enviar el mensaje personalizado:', error);
    }

    return true;
}
