// 1. Iniciar encuesta desde el botón del dashstaff -> Pide Título y Descripción (Modal 1)
export async function handleEncuestaStart(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_encuesta_create') return false;

    encuestaSessions.set(interaction.user.id, { options: [] });

    const modal = new ModalBuilder()
        .setCustomId('modal_encuesta_step1')
        .setTitle('📊 Crear Encuesta (1/3)');

    const titleInput = new TextInputBuilder()
        .setCustomId('encuesta_title')
        .setLabel('Título de la encuesta')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: ¿Qué circuito corremos la próxima semana?')
        .setRequired(true);

    const descInput = new TextInputBuilder()
        .setCustomId('encuesta_desc')
        .setLabel('Descripción / Pregunta detallada')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Escribe los detalles o contexto de la votación...')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(descInput)
    );

    await interaction.showModal(modal);
    return true;
}
