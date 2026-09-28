import { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ChatInputCommandInteraction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ChannelType 
} from 'discord.js';

// Añadimos guildId para saber en qué servidor se inició la creación
export const pendingFormCreations = new Map<string, { guildId: string, titulo: string, canalRespuestasId: string }>();

export const data = new SlashCommandBuilder()
    .setName('forms')
    .setDescription('Crea un nuevo formulario personalizado (Solo Administradores)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
        option.setName('titulo')
            .setDescription('Título del formulario (será el texto del botón azul)')
            .setRequired(true)
    )
    .addChannelOption(option =>
        option.setName('canal_respuestas')
            .setDescription('Canal donde el bot enviará las respuestas rellenadas')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
        await interaction.reply({ content: '❌ Este comando solo se puede usar dentro de un servidor.', ephemeral: true });
        return;
    }

    const titulo = interaction.options.getString('titulo', true);
    const canalRespuestas = interaction.options.getChannel('canal_respuestas', true);

    // Guardamos temporalmente el guildId junto al título y canal
    pendingFormCreations.set(interaction.user.id, {
        guildId: interaction.guildId,
        titulo,
        canalRespuestasId: canalRespuestas.id
    });

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
}
