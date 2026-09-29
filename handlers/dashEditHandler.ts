import { ModalSubmitInteraction } from 'discord.js';
// Importa también tu función para guardar o actualizar el formulario, por ejemplo:
// import { actualizarFormulario } from '../utils/formsStorage';

// 3. Maneja el envío del modal con las modificaciones del formulario
export async function handleModalEditFormSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('modal_editar_form_')) return false;

    if (!interaction.guildId) {
        await interaction.reply({ content: '❌ Acción no válida fuera de un servidor.', ephemeral: true });
        return true;
    }

    // Extraer y decodificar el título del formulario desde el customId
    const encodedTitle = interaction.customId.replace('modal_editar_form_', '');
    const tituloFormulario = decodeURIComponent(encodedTitle);

    // Obtener los valores ingresados en el modal
    const preguntasTexto = interaction.fields.getTextInputValue('input_edit_preguntas');
    const canalRespuestas = interaction.fields.getTextInputValue('input_edit_canal');

    // Convertir el texto plano en un array de preguntas (separadas por salto de línea, ignorando vacías)
    const preguntas = preguntasTexto
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);

    // TODO: Llama a tu función de guardado aquí
    // Ejemplo:
    // await actualizarFormulario(interaction.guildId, tituloFormulario, {
    //     preguntas,
    //     canalRespuestas
    // });

    await interaction.reply({
        content: `✅ ¡El formulario **"${tituloFormulario}"** se ha actualizado correctamente!\n\n` +
                 `📋 **Total de preguntas:** ${preguntas.length}\n` +
                 `📺 **Canal de Respuestas ID:** ${canalRespuestas}`,
        ephemeral: true
    });

    return true;
}
