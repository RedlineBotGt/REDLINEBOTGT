import { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ChatInputCommandInteraction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ChannelType,
    FileUploadBuilder,
    LabelBuilder 
} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('msn')
    .setDescription('Envía un mensaje personalizado a un canal (Solo Staff/Comisarios)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    // Desplegable nativo de canal con buscador
    .addChannelOption(option =>
        option.setName('canal')
            .setDescription('Canal de destino del mensaje')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    // Verificación de seguridad de permisos
    if (!interaction.memberPermissions || (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages) && !interaction.memberPermissions.has(PermissionFlagsBits.Administrator))) {
        await interaction.reply({
            content: '❌ No tienes permisos suficientes para ejecutar este comando.',
            ephemeral: true
        });
        return;
    }

    const canalDestino = interaction.options.getChannel('canal', true);

    // Construimos el Modal guardando únicamente el ID del canal en el customId
    const modal = new ModalBuilder()
        .setCustomId(`modal_msn_${canalDestino.id}`)
        .setTitle('Enviar Mensaje Oficial');

    const inputTexto = new TextInputBuilder()
        .setCustomId('input_msn_texto')
        .setLabel('💬 Contenido del mensaje')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Escribe aquí tu mensaje (admite emojis y Markdown)...')
        .setRequired(true);

    const inputImagen = new TextInputBuilder()
        .setCustomId('input_msn_imagen')
        .setLabel('🖼️ ID / URL de la imagen (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Pega aquí el enlace o ID de la imagen si procede...')
        .setRequired(false);

    const inputArchivo = new FileUploadBuilder()
        .setCustomId('input_msn_archivo')
        .setMinValues(0)
        .setMaxValues(1)
        .setFileTypes('image');

    modal.addLabelComponents(
        new LabelBuilder()
            .setLabel('💬 Contenido del mensaje')
            .setTextInputComponent(inputTexto),
        new LabelBuilder()
            .setLabel('🖼️ URL de imagen (opcional)')
            .setDescription('Puedes dejarlo vacío si adjuntas una foto desde tu dispositivo.')
            .setTextInputComponent(inputImagen),
        new LabelBuilder()
            .setLabel('📷 Foto desde la galería (opcional)')
            .setDescription('Selecciona una imagen de tu móvil o dispositivo. Máximo 1 imagen.')
            .setFileUploadComponent(inputArchivo)
    );

    await interaction.showModal(modal);
}
