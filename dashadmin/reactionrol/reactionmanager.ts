import { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelSelectMenuBuilder, 
    RoleSelectMenuBuilder, 
    ChannelType, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    EmbedBuilder, 
    ButtonInteraction, 
    StringSelectMenuInteraction, 
    ChannelSelectMenuInteraction, 
    RoleSelectMenuInteraction, 
    ModalSubmitInteraction, 
    MessageFlags 
} from 'discord.js';
import { getReactionCollection } from './reactionstorage';

const rrSessions = new Map<string, {
    channelId?: string;
    roleId?: string;
}>();

// 1. Botón principal del Dashboard (/dash): Pregunta si Crear o Gestionar
export async function handleDashRrButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'rr_btn_create') return false;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('rr_flow_create')
            .setLabel('Crear Reaction Role')
            .setStyle(ButtonStyle.Success)
            .setEmoji('➕'),
        new ButtonBuilder()
            .setCustomId('rr_flow_manage')
            .setLabel('Gestionar / Ver Existentes')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📂')
    );

    await interaction.reply({
        content: '🎭 **Sistema de Reaction Roles**\n¿Qué deseas hacer?',
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });
    return true;
}

// 2. Opción "Crear": Paso 1 - Seleccionar Canal mediante Desplegable
export async function handleRrStartCreate(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'rr_flow_create') return false;

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('rr_step_channel')
        .setPlaceholder('Selecciona el canal donde se publicará')
        .addChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);

    await interaction.update({
        content: '📋 **Paso 1/3:** Selecciona el canal de texto donde irá publicado el mensaje de Reaction Role.',
        components: [row]
    });
    return true;
}

// Opción "Gestionar"
export async function handleRrManage(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'rr_flow_manage') return false;

    const col = await getReactionCollection();
    const configs = await col.find({ guildId: interaction.guildId }).toArray();

    if (configs.length === 0) {
        await interaction.update({
            content: '📂 No hay paneles de Reaction Roles activos almacenados en este servidor.',
            components: []
        });
        return true;
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('rr_select_existing_message')
        .setPlaceholder('🗑️ Selecciona un mensaje para eliminar su configuración...');

    for (const cfg of configs.slice(0, 25)) {
        selectMenu.addOptions({
            label: `Canal: ${cfg.channelId.substring(0, 10)}... (Rol: ${cfg.roleId.substring(0, 10)}...)`,
            description: cfg.content ? cfg.content.substring(0, 50) : 'Sin texto',
            value: cfg.messageId
        });
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.update({
        content: '📂 **Gestionar Reaction Roles:** Selecciona el panel que deseas eliminar de la base de datos:',
        components: [row]
    });
    return true;
}

// 3. Paso 2: Canal seleccionado -> Guardar canal y pedir Rol mediante Desplegable
export async function handleRrChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'rr_step_channel') return false;

    const channelId = interaction.values[0];
    rrSessions.set(interaction.user.id, { channelId });

    const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId(`rr_step_role_${channelId}`)
        .setPlaceholder('Selecciona el rol que se entregará');

    const row = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect);

    await interaction.update({
        content: '📋 **Paso 2/3:** Selecciona el rol que se asignará al pulsar el botón/emoji.',
        components: [row]
    });
    return true;
}

// 4. Paso 3: Rol seleccionado -> Mostrar Modal para Título, Texto e Icono/Botón
export async function handleRrRoleSelect(interaction: RoleSelectMenuInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('rr_step_role_')) return false;

    const channelId = interaction.customId.replace('rr_step_role_', '');
    const roleId = interaction.values[0];
    const session = rrSessions.get(interaction.user.id) || { channelId };

    session.roleId = roleId;
    rrSessions.set(interaction.user.id, session);

    const modal = new ModalBuilder()
        .setCustomId(`rr_step_modal_${channelId}_${roleId}`)
        .setTitle('Configurar Mensaje de Reaction Role');

    const titleInput = new TextInputBuilder()
        .setCustomId('rr_input_title')
        .setLabel('Título del Embed')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 🎭 Roles de Servidor')
        .setRequired(true);

    const contentInput = new TextInputBuilder()
        .setCustomId('rr_input_content')
        .setLabel('Texto del Mensaje (Soporta menciones)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Ej: Pulsa el botón inferior para reclamar tu rol.')
        .setRequired(true);

    const emojiInput = new TextInputBuilder()
        .setCustomId('rr_input_emoji')
        .setLabel('Icono / Emoji para el botón')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 🎮')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(contentInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(emojiInput)
    );

    await interaction.showModal(modal);
    return true;
}

// 5. Procesar envío del Modal: Creación final, envío al canal y guardado en BD
export async function handleRrContentSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('rr_step_modal_')) return false;

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const parts = interaction.customId.replace('rr_step_modal_', '').split('_');
    const channelId = parts[0];
    const roleId = parts[1];

    const title = interaction.fields.getTextInputValue('rr_input_title');
    const messageText = interaction.fields.getTextInputValue('rr_input_content');
    const emoji = interaction.fields.getTextInputValue('rr_input_emoji');

    const guild = interaction.guild;
    if (!guild) {
        await interaction.editReply({ content: '❌ Acción no válida fuera de un servidor.' });
        return true;
    }

    const targetChannel = await guild.channels.fetch(channelId);
    const role = await guild.roles.fetch(roleId);

    if (!targetChannel || !targetChannel.isTextBased()) {
        await interaction.editReply({ content: '❌ El canal seleccionado no es válido o ya no existe.' });
        return true;
    }

    if (!role) {
        await interaction.editReply({ content: '❌ El rol seleccionado no existe en el servidor.' });
        return true;
    }

    try {
        const customButtonId = `rr_action_role_${roleId}_${Date.now()}`;

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(messageText)
            .setColor(0x0055FF)
            .setFooter({ text: guild.name, iconURL: guild.iconURL() || undefined })
            .setTimestamp();

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(customButtonId)
                .setLabel(`Obtener ${role.name}`)
                .setStyle(ButtonStyle.Primary)
                .setEmoji(emoji)
        );

        const message = await targetChannel.send({
            content: messageText,
            embeds: [embed],
            components: [actionRow]
        });

        const col = await getReactionCollection();
        await col.insertOne({
            guildId: guild.id,
            channelId: targetChannel.id,
            messageId: message.id,
            buttonId: customButtonId,
            roleId: role.id,
            content: messageText
        });

        rrSessions.delete(interaction.user.id);

        await interaction.editReply({
            content: `✅ ¡Reaction Role creado y publicado con éxito en <#${channelId}>!`
        });
    } catch (error) {
        console.error('❌ Error al crear reaction role:', error);
        await interaction.editReply({ content: '❌ Ocurrió un error al crear el reaction role.' });
    }

    return true;
}

// 6. Manejar la eliminación de un panel existente seleccionado desde el menú
export async function handleRrExistingSelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'rr_select_existing_message') return false;

    const messageId = interaction.values[0];
    const col = await getReactionCollection();

    await col.deleteOne({ messageId });

    await interaction.update({
        content: '🗑️ **Configuración de autorol eliminada de la base de datos con éxito.**',
        components: []
    });

    return true;
}
