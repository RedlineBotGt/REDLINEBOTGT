import { 
    ModalSubmitInteraction, 
    TextChannel 
} from 'discord.js';
import { obtenerFormularioPorTitulo } from '../utils/formsStorage'; // Ajusta la ruta según tu estructura

export async function handleFormSubmitModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('submit_form_')) return false;

    const tituloFormulario = decodeURIComponent(interaction.customId.replace('submit_form_', ''));
    const formulario = obtenerFormularioPorTitulo(tituloFormulario);

    if (!formulario) {
        await interaction.reply({
            content: '❌ Error: No se encontró la configuración de este formulario en la base de datos.',
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

    // Pie de página exclusivo con {Server}
    const serverFooter = "{Server}";
    resumen += `— *${serverFooter}*`;

    // Buscamos el canal de respuestas configurado al crear el formulario
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

    return true;
}
