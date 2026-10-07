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

// 1. Maneja el clic en el botón "Enviar mensaje" del panel /dashstaff
export async function handleDashMsnButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_msn_mensaje') return false;

    const selectMsnChannel = new ChannelSelectMenuBuilder()
        .setCustomId('dash_select_msn_channel')
        .setPlaceholder('📢 Selecciona un canal para enviar el mensaje...')
        .addChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectMsnChannel);

    await interaction.reply({
        content: '📢 **Sistema de Mensajes:** Selecciona a continuación el canal de destino:',
        components: [row],
        ephemeral: true
    });

    return true;
}

// 2. Maneja la selección del canal en el menú desplegable del Dash
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
        .setPlaceholder('Escribe tu mensaje con Markdown, menciones, emojis...')
        .setRequired(true);

    const inputImagen = new TextInputBuilder()
        .setCustomId('input_msn_imagen')
        .setLabel('🖼️ URL de imagen o archivo adjunto (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://ejemplo.com/imagen.png (opcional)')
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputTexto),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputImagen)
    );

    await interaction.showModal(modal);
    return true;
}

// 3. Maneja el envío del Modal (Funciona tanto para /msn como para el botón del Dash)
export async function handleDashMsnModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('modal_msn_')) return false;

    const channelId = interaction.customId.replace('modal_msn_', '');
    const texto = interaction.fields.getTextInputValue('input_msn_texto');
    const archivoUrl = interaction.fields.getTextInputValue('input_msn_imagen').trim();

    const guild = interaction.guild;
    if (!guild) return false;

    const canalDestino = await guild.channels.fetch(channelId) as TextChannel;
    if (!canalDestino || !canalDestino.isTextBased()) {
        await interaction.reply({ content: '❌ No se pudo encontrar el canal de destino.', ephemeral: true });
        return true;
    }

    try {
        // Preparamos el mensaje igual que un usuario normal
        const opcionesEnvio: any = {
            content: texto
        };

        // Si se proporciona una URL de imagen/archivo, Discord lo adjunta de forma nativa
        if (archivoUrl && archivoUrl.startsWith('http')) {
            opcionesEnvio.files = [{ attachment: archivoUrl }];
        }

        await canalDestino.send(opcionesEnvio);

        await interaction.reply({
            content: '✅ ¡Mensaje enviado con éxito como usuario normal!',
            ephemeral: true
        });
    } catch (error) {
        console.error('❌ Error al enviar mensaje MSN:', error);
        await interaction.reply({
            content: '❌ Hubo un error al enviar el mensaje o el archivo adjunto (verifica que la URL sea válida y accesible).',
            ephemeral: true
        });
    }

    return true;
}

// 4. Enrutador del módulo de mensajes
export async function handleMsnInteraction(interaction: any): Promise<boolean> {
    if (interaction.isButton()) {
        if (await handleDashMsnButton(interaction)) return true;
    }
    if (interaction.isChannelSelectMenu()) {
        if (await handleDashMsnChannelSelect(interaction)) return true;
    }
    if (interaction.isModalSubmit()) {
        if (await handleDashMsnModalSubmit(interaction)) return true;
    }
    return false;
}
