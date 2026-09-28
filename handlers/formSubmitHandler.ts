import { 
    ModalSubmitInteraction, 
    TextChannel 
} from 'discord.js';
import { obtenerFormularioPorTitulo } from '../utils/formsStorage';

export async function handleFormSubmitModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('submit_form_')) return false;

    if (!interaction.guildId) {
        await interaction.reply({ content: '❌ Este formulario solo se puede enviar dentro de un servidor.', ephemeral: true });
        return true;
    }

    const tituloFormulario = decodeURIComponent(interaction.customId.replace('submit_form_', ''));
    
    // Pasamos el guildId para buscar el formulario exclusivo de este servidor
    const formulario = await obtenerFormularioPorTitulo(interaction.guildId, tituloFormulario);

    if (!formulario) {
        await interaction.reply({
            content: '❌ Error: No se encontró la configuración de este formulario en la base de datos de este servidor.',
            ephemeral: true
        });
        return true;
    }

    // Construimos el resumen con las respuestas del usuario
    let resumen = `📥 **Nueva Respuesta de Formulario**\n`;
    resumen += `📋 **Formulario:** *${formulario.titulo}*\n`;
    resumen += `👤 **Usuario:** <@${interaction.user.id}>\n\n`;

    formulario.preguntas.forEach((pregunta, index) => {
        const respuesta = interaction.fields.getTextInputValue(`p_${index}`);
        resumen += `> **${pregunta}**\n${respuesta}\n\n`;
    });

    // Pie de página dinámico con el nombre del servidor
    const serverName = interaction.guild?.name || 'Servidor';
    resumen += `— *${serverName}*`;

    try {
        // Buscamos el canal de respuestas asegurando que pertenece a este servidor
        const canalRespuestas = await interaction.guild?.channels.fetch(formulario.canalRespuestas) as TextChannel;

        if (canalRespuestas) {
            await canalRespuestas.send({ content: resumen });
            await interaction.reply({
                content: '✅ ¡Tus respuestas se han enviado correctamente al staff!',
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: '❌ Las respuestas se han procesado, pero no se pudo encontrar el canal de respuestas configurado.',
                ephemeral: true
            });
        }
    } catch (error) {
        console.error('❌ Error al enviar la respuesta al canal:', error);
        await interaction.reply({
            content: '❌ Las respuestas se procesaron, pero ocurrió un error al enviarlas al canal (es posible que el canal haya sido eliminado o el bot no tenga permisos).',
            ephemeral: true
        });
    }

    return true;
}
