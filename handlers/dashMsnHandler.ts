import { 
    ButtonInteraction,
    ChannelSelectMenuInteraction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder,
    ChannelSelectMenuBuilder,
    ChannelType,
    ModalSubmitInteraction,
    TextChannel
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

// 2. Maneja la selección del canal en el menú
export async function handleDashMsnChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_select_msn_channel') return false;

    const channelId = interaction.values[0];
    if (!channelId) {
        await interaction.reply({ content: '❌ No se pudo determinar el canal seleccionado.', ephemeral: true });
        return true;
    }

    const modal = new ModalBuilder()
        .setCustomId(`modal_msn_${channelId}`)
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

// 3. Maneja el envío del Modal y oculta la URL fea usando Markdown limpio
export async function handleDashMsnModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('modal_msn_')) return false;

    const channelId = interaction.customId.replace('modal_msn_', '');
    const texto = interaction.fields.getTextInputValue('input_msn_texto');
    const imagenUrl = interaction.fields.getTextInputValue('input_msn_imagen').trim();

    const guild = interaction.guild;
    if (!guild) return false;

    const canalDestino = await guild.channels.fetch(channelId) as TextChannel;
    if (!canalDestino || !canalDestino.isTextBased()) {
        await interaction.reply({ content: '❌ No se pudo encontrar el canal de destino.', ephemeral: true });
        return true;
    }

    // Estructuramos el contenido final aplicando Markdown para que el enlace no se expanda feo
    let contenidoFinal = texto;
    if (imagenUrl) {
        // Si pegan una URL válida, se convierte en un hipervínculo discreto y limpio
        if (imagenUrl.startsWith('http')) {
            contenidoFinal += `\n\n[📎 Ver imagen adjunta](${imagenUrl})`;
        } else {
            // Por si introducen texto plano alternativo o ID
            contenidoFinal += `\n\n📎 ${imagenUrl}`;
        }
    }

    await canalDestino.send({
        content: contenidoFinal
    });

    await interaction.reply({
        content: '✅ ¡Mensaje enviado con éxito y enlace optimizado!',
        ephemeral: true
    });

    return true;
}
