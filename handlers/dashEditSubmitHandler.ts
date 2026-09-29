import { ModalSubmitInteraction } from 'discord.js';
import { guardarFormulario, obtenerFormularioPorTitulo } from '../utils/formsStorage';

export async function handleDashEditSubmitModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('modal_editar_form_')) return false;

    if (!interaction.guildId) {
        await interaction.reply({ content: '❌ Acción no válida fuera de un servidor.', ephemeral: true });
        return true;
    }

    const tituloFormulario = decodeURIComponent(interaction.customId.replace('modal_editar_form_', ''));
    const formularioActual = await obtenerFormularioPorTitulo(interaction.guildId, tituloFormulario);

    if (!formularioActual) {
        await interaction.reply({ content: '❌ El formulario ya no existe en este servidor.', ephemeral: true });
        return true;
    }

    const textoPreguntas = interaction.fields.getTextInputValue('input_edit_preguntas');
    const nuevoCanalRespuestas = interaction.fields.getTextInputValue('input_edit_canal').trim();

    // Convertimos el texto de nuevo en un array de preguntas limpias
    const nuevasPreguntas = textoPreguntas
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);

    if (nuevasPreguntas.length === 0) {
        await interaction.reply({ content: '❌ El formulario debe tener al menos una pregunta válida.', ephemeral: true });
        return true;
    }

    // Guardamos los cambios actualizando el documento en MongoDB (Orden correcto: canalRespuestas, luego preguntas)
    await guardarFormulario(interaction.guildId, tituloFormulario, nuevoCanalRespuestas, nuevasPreguntas);

    await interaction.reply({
        content: `✅ ¡Formulario **"${tituloFormulario}"** actualizado con éxito!\n• **Preguntas:** ${nuevasPreguntas.length} configuradas\n• **Canal de respuestas:** <#${nuevoCanalRespuestas}>`,
        ephemeral: true
    });

    return true;
}
