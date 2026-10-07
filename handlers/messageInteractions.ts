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
        .setLabel('Contenido del mensaje')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Escribe tu mensaje (ej: @NombreDeUsuario o @Rol)...')
        .setRequired(true);

    const inputImagen = new TextInputBuilder()
        .setCustomId('input_msn_imagen')
        .setLabel('URL de imagen o archivo (Opcional)')
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

// 3. Maneja el envío del Modal con conversión automática de roles y usuarios
export async function handleDashMsnModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('modal_msn_')) return false;

    const channelId = interaction.customId.replace('modal_msn_', '');
    let texto = interaction.fields.getTextInputValue('input_msn_texto');
    const archivoUrl = interaction.fields.getTextInputValue('input_msn_imagen').trim();

    const guild = interaction.guild;
    if (!guild) return false;

    const canalDestino = await guild.channels.fetch(channelId) as TextChannel;
    if (!canalDestino || !canalDestino.isTextBased()) {
        await interaction.reply({ content: '❌ No se pudo encontrar el canal de destino.', ephemeral: true });
        return true;
    }

    try {
        // 🔥 1. AUTO-CONVERSIÓN DE ROLES (@NombreDelRol -> <@&ID>)
        const roles = await guild.roles.fetch();
        roles.forEach(role => {
            if (!role) return;
            const patronRole = `@${role.name}`;
            if (texto.includes(patronRole)) {
                texto = texto.replaceAll(patronRole, `<@&${role.id}>`);
            }
        });

        // 🔥 2. AUTO-CONVERSIÓN DE USUARIOS (@Username o @DisplayName -> <@ID>)
        const members = await guild.members.fetch();
        members.forEach(member => {
            if (!member) return;
            const patronUsername = `@${member.user.username}`;
            const patronDisplayName = `@${member.displayName}`;

            if (texto.includes(patronUsername)) {
                texto = texto.replaceAll(patronUsername, `<@${member.id}>`);
            }
            if (texto.includes(patronDisplayName) && patronDisplayName !== patronUsername) {
                texto = texto.replaceAll(patronDisplayName, `<@${member.id}>`);
            }
        });

        const opcionesEnvio: any = {
            content: texto,
            allowedMentions: {
                parse: ['users', 'roles', 'everyone'] // Permite notificar a usuarios, roles y everyone
            }
        };

        if (archivoUrl && archivoUrl.startsWith('http')) {
            opcionesEnvio.files = [{ attachment: archivoUrl }];
        }

        await canalDestino.send(opcionesEnvio);

        await interaction.reply({
            content: '✅ ¡Mensaje enviado con éxito y menciones convertidas correctamente!',
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
