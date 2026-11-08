import { 
    ButtonInteraction,
    ChannelSelectMenuInteraction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder,
    ChannelSelectMenuBuilder,
    FileUploadBuilder,
    LabelBuilder,
    ChannelType,
    ModalSubmitInteraction,
    TextChannel
} from 'discord.js';

import { buildModalImageAttachment } from '../../handlers/modalImageUpload';

// 1. Maneja el clic en el botón "Enviar mensaje" del panel
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
        .setLabel('Contenido del mensaje')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Escribe tu mensaje (ej: @miembro o @rol)...')
        .setRequired(true);

    const inputImagen = new TextInputBuilder()
        .setCustomId('input_msn_imagen')
        .setLabel('URL de imagen o archivo (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://ejemplo.com/imagen.png (opcional)')
        .setRequired(false);

    const inputArchivo = new FileUploadBuilder()
        .setCustomId('input_msn_archivo')
        .setMinValues(0)
        .setMaxValues(1)
        .setRequired(false);

    modal.addLabelComponents(
        new LabelBuilder()
            .setLabel('Contenido del mensaje')
            .setTextInputComponent(inputTexto),
        new LabelBuilder()
            .setLabel('URL de imagen (opcional)')
            .setDescription('Puedes dejarlo vacío si adjuntas una foto desde tu dispositivo.')
            .setTextInputComponent(inputImagen),
        new LabelBuilder()
            .setLabel('Foto desde la galería (opcional)')
            .setDescription('Selecciona una imagen de tu móvil o dispositivo. Máximo 1 imagen.')
            .setFileUploadComponent(inputArchivo)
    );

    await interaction.showModal(modal);
    return true;
}

// 3. Maneja el envío del Modal con conversión inteligente de menciones
export async function handleDashMsnModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('modal_msn_')) return false;

    const channelId = interaction.customId.replace('modal_msn_', '');
    let texto = interaction.fields.getTextInputValue('input_msn_texto');
    const archivoUrl = interaction.fields.getTextInputValue('input_msn_imagen').trim();
    const uploadedFile = interaction.fields.getUploadedFiles('input_msn_archivo')?.first() ?? null;

    const guild = interaction.guild;
    if (!guild) return false;

    const canalDestino = await guild.channels.fetch(channelId) as TextChannel;
    if (!canalDestino || !canalDestino.isTextBased()) {
        await interaction.reply({ content: '❌ No se pudo encontrar el canal de destino.', ephemeral: true });
        return true;
    }

    try {
        // 🔥 Auto-conversión de roles
        const roles = await guild.roles.fetch();
        roles.forEach(role => {
            if (!role || role.name === '@everyone') return;
            const escapedRoleName = role.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(`@${escapedRoleName}\\b`, 'gi');
            texto = texto.replace(regex, `<@&${role.id}>`);
        });

        // 🔥 Auto-conversión flexible de usuarios
        const members = await guild.members.fetch();
        const userMentionRegex = /@([a-zA-Z0-9_]+)/g;
        let match;

        while ((match = userMentionRegex.exec(texto)) !== null) {
            const query = match[1].toLowerCase();

            const foundMember = members.find(m => {
                const username = m.user.username.toLowerCase();
                const displayName = m.displayName.toLowerCase();
                return username.includes(query) || displayName.includes(query);
            });

            if (foundMember) {
                const fullMatch = `@${match[1]}`;
                texto = texto.replaceAll(fullMatch, `<@${foundMember.id}>`);
            }
        }

        const imagenAdjunta = await buildModalImageAttachment(uploadedFile);

        const opcionesEnvio: any = {
            content: texto,
            allowedMentions: {
                parse: ['users', 'roles', 'everyone']
            }
        };

        const archivos: any[] = [];
        if (imagenAdjunta) archivos.push(imagenAdjunta);
        if (archivoUrl && /^https?:\/\//i.test(archivoUrl)) {
            archivos.push({ attachment: archivoUrl });
        }
        if (archivos.length) opcionesEnvio.files = archivos;

        await canalDestino.send(opcionesEnvio);

        await interaction.reply({
            content: '✅ ¡Mensaje enviado con éxito y menciones procesadas!',
            ephemeral: true
        });
    } catch (error) {
        console.error('❌ Error al enviar mensaje MSN:', error);
        await interaction.reply({
            content: '❌ Hubo un error al enviar el mensaje o el archivo adjunto.',
            ephemeral: true
        });
    }

    return true;
}

// 4. Enrutador local del submódulo msn
export async function handleMsnInteractions(interaction: any): Promise<boolean> {
    if (interaction.isButton() && interaction.customId === 'dash_btn_msn_mensaje') {
        return await handleDashMsnButton(interaction);
    }
    if (interaction.isChannelSelectMenu() && interaction.customId === 'dash_select_msn_channel') {
        return await handleDashMsnChannelSelect(interaction);
    }
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_msn_')) {
        return await handleDashMsnModalSubmit(interaction);
    }
    return false;
}
