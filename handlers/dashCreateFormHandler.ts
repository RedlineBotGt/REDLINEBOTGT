import { 
    ButtonInteraction, 
    ChannelSelectMenuInteraction, 
    ModalSubmitInteraction, 
    ActionRowBuilder, 
    ChannelSelectMenuBuilder, 
    ChannelType, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} from 'discord.js';
import { pendingFormCreations } from '../commands/forms';

const formCreateSessions = new Map<string, { channelId: string }>();

// 1. Maneja el clic en el botón "Crear" del panel /dash
export async function handleDashCreateFormButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_crear_form') return false;

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('dash_select_form_create_channel')
        .setPlaceholder('📢 1. Selecciona el canal de respuestas...')
        .addChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);

    await interaction.reply({
        content: '📝 **Crear Formulario:** Selecciona el canal donde el bot enviará las respuestas rellenadas:',
        components: [row],
        ephemeral: true
    });

    return true;
}

// 2. Maneja la selección del canal de respuestas
export async function handleDashCreateFormChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_select_form_create_channel') return false;

    const channelId = interaction.values[0];
    formCreateSessions.set(interaction.user.id, { channelId });

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

// 3. Recoge el título, lo almacena y despliega el modal idéntico de 5 preguntas (p1 a p5) como /forms
export async function handleDashFormTituloModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_dash_form_titulo') return false;

    const session = formCreateSessions.get(interaction.user.id);
    if (!session) {
        await interaction.reply({ content: '❌ La sesión ha expirado. Vuelve a iniciar la creación desde el Dash.', ephemeral: true });
        return true;
    }

    const titulo = interaction.fields.getTextInputValue('input_dash_form_titulo_text');
    const channelId = session.channelId;
    formCreateSessions.delete(interaction.user.id);

    // Guardamos en el Map del comando /forms original
    pendingFormCreations.set(interaction.user.id, {
        guildId: interaction.guildId!,
        titulo,
        canalRespuestasId: channelId
    });

    // Desplegamos el modal idéntico de preguntas p1 a p5
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
