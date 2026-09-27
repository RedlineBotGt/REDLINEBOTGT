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

export const data = new SlashCommandBuilder()
    .setName('veredicto')
    .setDescription('Emite un veredicto oficial de carrera')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    // Desplegable de canal
    .addChannelOption(option =>
        option.setName('canal')
            .setDescription('Canal donde se enviará el veredicto')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
    )
    // Desplegable de rol
    .addRoleOption(option =>
        option.setName('rol')
            .setDescription('Rol a mencionar en el veredicto')
            .setRequired(true)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    // 1. Verificación de permisos (bloquea a "el pueblo")
    if (!interaction.memberPermissions || (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages) && !interaction.memberPermissions.has(PermissionFlagsBits.Administrator))) {
        await interaction.reply({
            content: '❌ No tienes permisos suficientes para ejecutar este comando.',
            ephemeral: true
        });
        return;
    }

    // 2. Capturamos el canal y el rol de los desplegables
    const canalDestino = interaction.options.getChannel('canal', true);
    const rolMencion = interaction.options.getRole('rol', true);

    // 3. Construimos el Modal guardando los IDs en el customId
    const modal = new ModalBuilder()
        .setCustomId(`modal_veredicto_${canalDestino.id}_${rolMencion.id}`)
        .setTitle('Formulario de Veredicto Oficial');

    const inputReportId = new TextInputBuilder()
        .setCustomId('input_verd_report_id')
        .setLabel('🆔 ID del Reporte')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 001')
        .setRequired(true);

    const inputReporta = new TextInputBuilder()
        .setCustomId('input_verd_reporta')
        .setLabel('Piloto que Reportó')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Nombre del denunciante')
        .setRequired(true);

    const inputDefendio = new TextInputBuilder()
        .setCustomId('input_verd_defendio')
        .setLabel('Piloto que Defendió')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Nombre del defendido')
        .setRequired(true);

    const inputResolucion = new TextInputBuilder()
        .setCustomId('input_verd_resolucion')
        .setLabel('Resolución')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Detalles de la decisión de los comisarios...')
        .setRequired(true);

    const inputSancion = new TextInputBuilder()
        .setCustomId('input_verd_sancion')
        .setLabel('Sanción / Medida aplicada')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: Sin sanción / 5 segundos')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputReportId),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputReporta),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputDefendio),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputResolucion),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputSancion)
    );

    await interaction.showModal(modal);
}
