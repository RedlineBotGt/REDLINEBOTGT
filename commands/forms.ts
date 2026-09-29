import { 
    ButtonInteraction, 
    ModalSubmitInteraction, 
    ActionRowBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle 
} from 'discord.js';

// Importamos el mapa compartido desde el archivo del comando /forms usando la ruta correcta
import { pendingFormCreations } from '../commands/forms';

// 1. Maneja el clic en el botón "Crear" del panel /dash (abre el modal del título)
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

// 2. Recoge el título del modal del botón, lo guarda en el mapa compartido y muestra el botón intermedio
export async function handleDashFormTituloModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_dash_form_titulo') return false;

    const titulo = interaction.fields.getTextInputValue('input_dash_form_titulo_text');
    const guildId = interaction.guildId;

    if (!guildId) {
        await interaction.reply({ content: '❌ Este comando solo se puede usar dentro de un servidor.', ephemeral: true });
        return true;
    }

    // Guardamos los datos exactamente igual que lo hace /forms
    pendingFormCreations.set(interaction.user.id, { guildId, titulo });

    // NOTA TÉCNICA: Discord prohíbe abrir un modal directamente desde otro modal.
    // Por eso, aquí mandamos un mensaje efímero con un botón para abrir el modal de preguntas.
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('dash_btn_abrir_preguntas')
            .setLabel('Continuar con las Preguntas')
            .setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({
        content: `✅ Título guardado: **${titulo}**. Haz clic en el botón de abajo para configurar las preguntas:`,
        components: [row],
        ephemeral: true
    });

    return true;
}

// 3. Maneja el clic en el botón intermedio para abrir por fin el modal de preguntas (p1 a p5)
export async function handleDashOpenPreguntasButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_abrir_preguntas') return false;

    if (!pendingFormCreations.has(interaction.user.id)) {
        await interaction.reply({ content: '❌ No se encontró ningún título pendiente. Empieza de nuevo.', ephemeral: true });
        return true;
    }

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
