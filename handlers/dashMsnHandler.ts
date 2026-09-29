import { 
    ButtonInteraction,
    ChannelSelectMenuInteraction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder,
    ChannelSelectMenuBuilder,
    ChannelType
} from 'discord.js';

// 1. Maneja el clic en el botón "Mensaje" del panel /dash
export async function handleDashMsnButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_msn_mensaje') return false;

    const selectMsnChannel = new ChannelSelectMenuBuilder()
        .setCustomId('dash_select_msn_channel')
        .setPlaceholder('📢 [MSN] Selecciona un canal para enviar anuncio...')
        .addChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectMsnChannel);

    await interaction.reply({
        content: '📢 **Sistema MSN:** Selecciona a continuación el canal de destino para el mensaje oficial:',
        components: [row],
        ephemeral: true
    });

    return true;
}

// 2. Maneja la selección del canal en el menú (Tu código original intacto)
export async function handleDashMsnChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_select_msn_channel') return false;

    const canalDestino = interaction.channels.first();
    if (!canalDestino) {
        await interaction.reply({ content: '❌ No se pudo determinar el canal seleccionado.', ephemeral: true });
        return true;
    }

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

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputTexto),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputImagen)
    );

    await interaction.showModal(modal);
    return true;
}
