import { StringSelectMenuInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { obtenerFormularioPorTitulo } from '../utils/formsStorage';

export async function handleDashEditFormSelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_select_editar_form') return false;

    if (!interaction.guildId) {
        await interaction.update({ content: '❌ Acción no válida fuera de un servidor.', components: [] });
        return true;
    }

    const tituloFormulario = interaction.values[0];
    const formulario = await obtenerFormularioPorTitulo(interaction.guildId, tituloFormulario);

    if (!formulario) {
        await interaction.update({ content: '❌ No se encontró el formulario seleccionado en este servidor.', components: [] });
        return true;
    }

    const modal = new ModalBuilder()
        .setCustomId(`modal_editar_form_${encodeURIComponent(tituloFormulario)}`)
        .setTitle(`Editar: ${tituloFormulario}`.substring(0, 45));

    // Campo de preguntas pre-llenado con las actuales (una por línea)
    const inputPreguntas = new TextInputBuilder()
        .setCustomId('input_edit_preguntas')
        .setLabel('📋 Preguntas (1 por línea)')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(formulario.preguntas.join('\n'))
        .setRequired(true);

    // Campo de canal pre-llenado con el ID actual
    const inputCanal = new TextInputBuilder()
        .setCustomId('input_edit_canal')
        .setLabel('📺 ID del Canal de Respuestas')
        .setStyle(TextInputStyle.Short)
        .setValue(formulario.canalRespuestas)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputPreguntas),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputCanal)
    );

    await interaction.showModal(modal);
    return true;
}
