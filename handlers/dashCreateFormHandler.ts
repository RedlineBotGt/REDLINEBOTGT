import { 
    ButtonInteraction, 
    ModalSubmitInteraction, 
    ActionRowBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} from 'discord.js';

// 1. Maneja el clic en el botón "Crear" del panel /dash (ahora abre directamente el modal del título)
export async function handleDashCreateFormButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_crear_form') return false;

    const modal = new ModalBuilder()
        .setCustomId('modal_dash_form_titulo')
        .setTitle('Título del Formulario');

    const inputTitulo = new TextInputBuilder()
        .setCustomId('input_dash_form_titulo_text')
        .setLabel('Título (Texto del botón azul)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: Inscripción de Equipos / Sanciones')
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(inputTitulo));

    await interaction.showModal(modal);
    return true;
}

// 2. Recoge el título y despliega el modal de 5 preguntas (p1 a p5)
export async function handleDashFormTituloModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_dash_form_titulo') return false;

    const titulo = interaction.fields.getTextInputValue('input_dash_form_titulo_text');

    // Nota: Ya no guardamos el canal aquí porque se asignará cuando se coloque el formulario.
    // El manejador final que procesa las preguntas (modal_crear_formulario_preguntas) 
    // recogerá el título y guardará la estructura limpia.

    // Desplegamos el modal de preguntas p1 a p5
    const modal = new ModalBuilder()
        .setCustomId('modal_crear_formulario_preguntas')
        .setTitle('Configurar Preguntas del Formulario');

    const p1 = new TextInputBuilder().setCustomId('p1').setLabel('Pregunta / Campo 1').setStyle(TextInputStyle.Short).setRequired(false);
    const p2 = new TextInputBuilder().setCustomId('p2').setLabel('Pregunta / Campo 2').setStyle(TextInputStyle.Short).setRequired(false);
    const p3 = new TextInputBuilder().setCustomId('p3').setLabel('Pregunta / Campo 3').setStyle(TextInputStyle.Short).setRequired(false);
    const p4 = new TextInputBuilder().setCustomId('p4').setLabel('Pregunta / Campo 4').setStyle(TextInputStyle.Short).setRequired(false);
    const p5 = new TextInputBuilder().setCustomId('p5').setLabel('Pregunta / Campo 5').setStyle(TextInputStyle.Short).setRequired(false);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(p1),
        new ActionRowBuilder<TextInputBuilder>().addComponents(p2),
        new ActionRowBuilder<TextInputBuilder>().addComponents(p3),
        new ActionRowBuilder<TextInputBuilder>().addComponents(p4),
        new ActionRowBuilder<TextInputBuilder>().addComponents(p5)
    );

    await interaction.showModal(modal);
    return true;
}
