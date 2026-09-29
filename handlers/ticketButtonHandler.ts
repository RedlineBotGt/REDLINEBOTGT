import { 
    ButtonInteraction, 
    ModalSubmitInteraction, 
    ChannelSelectMenuInteraction,
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ChannelSelectMenuBuilder,
    ChannelType,
    TextChannel,
    PermissionsBitField,
    MessageFlags
} from 'discord.js';

// Almacenamiento temporal en memoria para la configuración del ticket mientras se selecciona el canal
const tempTicketConfigs = new Map<string, {
    label: string;
    style: ButtonStyle;
    roleQuery: string;
    publicMsg: string;
    privateMsg: string;
}>();

// Almacén global para los botones de tickets desplegados
export const activeTicketButtons = new Map<string, {
    label: string;
    style: ButtonStyle;
    roleQuery: string;
    publicMsg: string;
    privateMsg: string;
}>();

// 1. Al hacer clic en "CrearBotón" en el dash, se abre el modal con los 5 campos
export async function handleDashCrearBotonButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_crear_boton') return false;

    const modal = new ModalBuilder()
        .setCustomId('modal_crear_ticket_config')
        .setTitle('Configurar Botón de Tickets');

    const inputLabel = new TextInputBuilder()
        .setCustomId('ticket_label')
        .setLabel('1. Texto del botón')
        .setPlaceholder('Ej: Soporte, Sugerencias, Comisarios...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const inputStyle = new TextInputBuilder()
        .setCustomId('ticket_style')
        .setLabel('2. Color (Primary, Success, Danger)')
        .setPlaceholder('Ej: Success, Danger, Primary...')
        .setStyle(TextInputStyle.Short)
        .setValue('Success')
        .setRequired(true);

    const inputRole = new TextInputBuilder()
        .setCustomId('ticket_role')
        .setLabel('3. Rol a mencionar (Nombre o ID)')
        .setPlaceholder('Ej: Comisarios, Staff o @rol')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const inputPublicMsg = new TextInputBuilder()
        .setCustomId('ticket_public_msg')
        .setLabel('4. Mensaje que acompaña al botón')
        .setPlaceholder('Mensaje que verá la gente en el canal principal...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    const inputPrivateMsg = new TextInputBuilder()
        .setCustomId('ticket_private_msg')
        .setLabel('5. Mensaje dentro del nuevo canal')
        .setPlaceholder('Mensaje inicial cuando se abra el ticket...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputLabel),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputStyle),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputRole),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputPublicMsg),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputPrivateMsg)
    );

    await interaction.showModal(modal);
    return true;
}

// 2. Al enviar el modal, guardamos los datos y pedimos el canal de ubicación mediante un desplegable
export async function handleTicketModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_crear_ticket_config') return false;

    const label = interaction.fields.getTextInputValue('ticket_label');
    const styleText = interaction.fields.getTextInputValue('ticket_style').toLowerCase();
    const roleQuery = interaction.fields.getTextInputValue('ticket_role');
    const publicMsg = interaction.fields.getTextInputValue('ticket_public_msg');
    const privateMsg = interaction.fields.getTextInputValue('ticket_private_msg');

    let style = ButtonStyle.Success;
    if (styleText.includes('primary') || styleText.includes('azul')) style = ButtonStyle.Primary;
    else if (styleText.includes('secondary') || styleText.includes('gris')) style = ButtonStyle.Secondary;
    else if (styleText.includes('danger') || styleText.includes('rojo')) style = ButtonStyle.Danger;

    const configId = `ticket_cfg_${Date.now()}`;
    tempTicketConfigs.set(configId, { label, style, roleQuery, publicMsg, privateMsg });

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId(`ticket_deploy_channel_${configId}`)
        .setChannelTypes(ChannelType.GuildText)
        .setPlaceholder('📺 Selecciona el canal donde se ubicará este botón...');

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);

    await interaction.reply({
        content: `✅ Configuración guardada.\nAhora selecciona en el desplegable **dónde deseas ubicar este botón**:`,
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// 3. Al seleccionar el canal de destino, se publica el mensaje con el botón interactivo
export async function handleTicketChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('ticket_deploy_channel_')) return false;

    if (!interaction.guildId || !interaction.guild) {
        await interaction.update({ content: '❌ Acción no válida.', components: [] });
        return true;
    }

    const configId = interaction.customId.replace('ticket_deploy_channel_', '');
    const config = tempTicketConfigs.get(configId);

    if (!config) {
        await interaction.update({ content: '❌ La configuración ha expirado. Por favor, vuelve a intentarlo.', components: [] });
        return true;
    }

    const canalId = interaction.channels.first()?.id;
    if (!canalId) {
        await interaction.update({ content: '❌ No se seleccionó ningún canal.', components: [] });
        return true;
    }

    const canalDestino = await interaction.guild.channels.fetch(canalId) as TextChannel;
    if (!canalDestino) {
        await interaction.update({ content: '❌ No se encontró el canal de destino.', components: [] });
        return true;
    }

    const uniqueTicketId = `open_ticket_${Date.now()}`;
    activeTicketButtons.set(uniqueTicketId, config);

    const button = new ButtonBuilder()
        .setCustomId(uniqueTicketId)
        .setLabel(config.label.substring(0, 80))
        .setStyle(config.style)
        .setEmoji('🎟️');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    await canalDestino.send({
        content: config.publicMsg,
        components: [row]
    });

    tempTicketConfigs.delete(configId);

    await interaction.update({
        content: `✅ ¡Botón **"${config.label}"** colocado con éxito en <#${canalId}>!`,
        components: []
    });

    return true;
}

// 4. Cuando un usuario pulsa el botón desplegado, se abre el canal privado con su botón de cerrar
export async function handleTicketButtonClick(interaction: ButtonInteraction): Promise<boolean> {
    const config = activeTicketButtons.get(interaction.customId);
    if (!config) return false;

    if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({ content: '❌ Error fuera de un servidor.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    try {
        const guild = interaction.guild;
        const member = interaction.member;

        await guild.roles.fetch();

        const roleQueryLower = config.roleQuery.toLowerCase().replace('@', '').trim();
        const role = guild.roles.cache.find(r => 
            r.id === config.roleQuery || 
            r.name.toLowerCase() === roleQueryLower
        );

        const roleMention = role ? `<@&${role.id}>` : `@${config.roleQuery}`;
        const username = member && 'user' in member ? member.user.username : 'usuario';
        const channelName = `ticket-${username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
        
        const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: interaction.client.user.id,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel, 
                        PermissionsBitField.Flags.SendMessages, 
                        PermissionsBitField.Flags.ReadMessageHistory,
                        PermissionsBitField.Flags.ManageChannels
                    ],
                },
                {
                    id: interaction.user.id,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                },
                ...(role ? [{
                    id: role.id,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                }] : [])
            ]
        });

        // Creamos el botón de cerrar ticket
        const closeButton = new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Cerrar Ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒');

        const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton);

        // Enviamos el mensaje inicial junto con el botón de cierre
        await ticketChannel.send({
            content: `Hola <@${interaction.user.id}>, bienvenido.\n${roleMention}\n\n${config.privateMsg}`,
            components: [closeRow]
        });

        await interaction.editReply({
            content: `✅ ¡Tu ticket ha sido creado con éxito! Accede aquí: <#${ticketChannel.id}>`
        });

    } catch (error) {
        console.error('❌ Error detallado al crear el canal de ticket:', error);
        await interaction.editReply({
            content: '❌ Hubo un error al intentar crear el canal del ticket. Revisa la consola.'
        });
    }

    return true;
}

// 5. Cuando se pulsa el botón de cerrar ticket dentro del canal privado
export async function handleCloseTicketButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'close_ticket') return false;

    if (!interaction.guildId || !interaction.channel || !(interaction.channel instanceof TextChannel)) {
        await interaction.reply({ content: '❌ Esta acción solo se puede realizar en un canal de texto.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    await interaction.reply({
        content: `🔒 **Ticket cerrado por <@${interaction.user.id}>.** Este canal se eliminará en 3 segundos...`
    });

    setTimeout(async () => {
        try {
            await interaction.channel?.delete();
        } catch (error) {
            console.error('❌ Error al eliminar el canal del ticket:', error);
        }
    }, 3000);

    return true;
}
