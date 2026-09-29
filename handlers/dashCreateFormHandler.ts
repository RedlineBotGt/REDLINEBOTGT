import { 
    ButtonInteraction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder 
} from 'discord.js';

export async function handleDashCreateFormButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_crear_form') return false;

    // Construimos el modal utilizando el customId que ya procesa tu handleFormCreateModal
    const modal = new ModalBuilder()
        .setCustomId('modal_crear_formulario_preguntas')
        .setTitle('Crear Nuevo Formulario');

    const inputTitulo = new TextInputBuilder()
        .setCustomId('input_form_titulo')
        .setLabel('Título del Formulario')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: Inscripción de Equipos / Sanciones')
        .setRequired(true);

    const inputPreguntas = new TextInputBuilder()
        .setCustomId('input_form_preguntas')
        .setLabel('Preguntas o Campos del Formulario')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Introduce las preguntas separadas por líneas...')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputTitulo),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputPreguntas)
    );

    await interaction.showModal(modal);
    return true;
}
