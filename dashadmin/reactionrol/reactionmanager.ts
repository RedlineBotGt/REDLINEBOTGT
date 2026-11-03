import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    StringSelectMenuBuilder,
    ChannelType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
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

// 1. Botón principal del Dashboard
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

// 2. Crear: seleccionar canal
export async function handleRrStartCreate(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'rr_flow_create') return false;

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('rr_step_channel')
        .setPlaceholder('Selecciona el canal donde se publicará')
        .addChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>()
        .addComponents(channelSelect);

    await interaction.update({
        content: '📋 **Paso 1/3:** Selecciona el canal de texto donde irá publicado el mensaje.',
        components: [row]
    });

    return true;
}

// 3. Gestionar paneles existentes
export async function handleRrManage(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'rr_flow_manage') return false;

    const col = await getReactionCollection();
    const configs = await col.find({ guildId: interaction.guildId }).toArray();

    if (configs.length === 0) {
        await interaction.update({
            content: '📂 No hay paneles de Reaction Roles activos en este servidor.',
            components: []
        });
        return true;
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('rr_select_existing_message')
        .setPlaceholder('Selecciona un mensaje para eliminar su configuración...');

    for (const cfg of configs.slice(0, 25)) {
        selectMenu.addOptions({
            label: `Canal: ${cfg.channelId.substring(0, 10)}... (Rol: ${cfg.roleId.substring(0, 10)}...)`,
            description: cfg.content ? cfg.content.substring(0, 50) : 'Sin texto',
            value: cfg.messageId
        });
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(selectMenu);

    await interaction.update({
        content: '📂 **Gestionar Reaction Roles:** Selecciona el panel que deseas eliminar:',
        components: [row]
    });

    return true;
}

// 4. Seleccionar canal
export async function handleRrChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'rr_step_channel') return false;

    const channelId = interaction.values[0];
    rrSessions.set(interaction.user.id, { channelId });

    const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId(`rr_step_role_${channelId}`)
        .setPlaceholder('Selecciona el rol que se entregará');

    const row = new ActionRowBuilder<RoleSelectMenuBuilder>()
        .addComponents(roleSelect);

    await interaction.update({
        content: '📋 **Paso 2/3:** Selecciona el rol que se asignará al pulsar el botón.',
        components: [row]
    });

    return true;
}

// 5. Seleccionar rol y abrir formulario
export async function handleRrRoleSelect(interaction: RoleSelectMenuInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('rr_step_role_')) return false;

    const channelId = interaction.customId.replace('rr_step_role_', '');
    const roleId = interaction.values[0];

    const session = rrSessions.get(interaction.user.id) || { channelId };
    session.roleId = roleId;
    rrSessions.set(interaction.user.id, session);

    const modal = new ModalBuilder()
        .setCustomId(`rr_step_modal_${channelId}_${roleId}`)
        .setTitle('Configurar Reaction Role');

    const contentInput = new TextInputBuilder()
        .setCustomId('rr_input_content')
        .setLabel('Texto del mensaje')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Ej: Pulsa el botón para reclamar tu rol.')
        .setRequired(true);

    const emojiInput = new TextInputBuilder()
        .setCustomId('rr_input_emoji')
        .setLabel('Icono / Emoji para el botón')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 🎮')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(contentInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(emojiInput)
    );

    await interaction.showModal(modal);

    return true;
}

// 6. Publicar mensaje de texto normal con mención del rol
export async function handleRrContentSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('rr_step_modal_')) return false;

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const parts = interaction.customId.replace('rr_step_modal_', '').split('_');
    const channelId = parts[0];
    const roleId = parts[1];

    const messageText = interaction.fields.getTextInputValue('rr_input_content');
    const emoji = interaction.fields.getTextInputValue('rr_input_emoji');

    const guild = interaction.guild;

    if (!guild) {
        await interaction.editReply({
            content: '❌ Acción no válida fuera de un servidor.'
        });
        return true;
    }

    try {
        const targetChannel = await guild.channels.fetch(channelId);
        const role = await guild.roles.fetch(roleId);

        if (!targetChannel || !targetChannel.isTextBased() || !('send' in targetChannel)) {
            await interaction.editReply({
                content: '❌ El canal seleccionado no es válido o ya no existe.'
            });
            return true;
        }

        if (!role) {
            await interaction.editReply({
                content: '❌ El rol seleccionado no existe en este servidor.'
            });
            return true;
        }

        const customButtonId = `rr_action_role_${roleId}_${Date.now()}`;

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(customButtonId)
                .setLabel(`Obtener ${role.name}`)
                .setStyle(ButtonStyle.Primary)
                .setEmoji(emoji)
        );

        // Un único mensaje normal, con mención real del rol.
        const message = await targetChannel.send({
            content: `<@&${role.id}>\n\n${messageText}`,
            components: [actionRow],
            allowedMentions: {
                roles: [role.id]
            }
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
            content: `✅ ¡Reaction Role creado y publicado correctamente en <#${channelId}>!`
        });

    } catch (error) {
        console.error('❌ Error al crear reaction role:', error);

        await interaction.editReply({
            content: '❌ Ocurrió un error al crear el Reaction Role. Comprueba los permisos del bot.'
        });
    }

    return true;
}

// 7. Eliminar configuración existente
export async function handleRrExistingSelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'rr_select_existing_message') return false;

    const messageId = interaction.values[0];
    const col = await getReactionCollection();

    await col.deleteOne({ messageId });

    await interaction.update({
        content: '🗑️ **Configuración de Reaction Role eliminada de la base de datos.**',
        components: []
    });

    return true;
}

// 8. Dar o retirar el rol al pulsar el botón
export async function handleRrRoleAction(interaction: ButtonInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('rr_action_role_')) return false;

    const parts = interaction.customId.split('_');
    const roleId = parts[3];

    const guild = interaction.guild;
    if (!guild) return true;

    const member = await guild.members.fetch(interaction.user.id).catch(() => null);

    if (!member) {
        await interaction.reply({
            content: '❌ No se pudo verificar tu usuario en el servidor.',
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    const role = await guild.roles.fetch(roleId);

    if (!role) {
        await interaction.reply({
            content: '❌ El rol asociado ya no existe en este servidor.',
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    try {
        if (member.roles.cache.has(roleId)) {
            await member.roles.remove(role);

            await interaction.reply({
                content: `❌ Se te ha retirado el rol **${role.name}**.`,
                flags: [MessageFlags.Ephemeral]
            });
        } else {
            await member.roles.add(role);

            await interaction.reply({
                content: `✅ ¡Se te ha otorgado el rol **${role.name}**!`,
                flags: [MessageFlags.Ephemeral]
            });
        }
    } catch (error) {
        console.error('❌ Error al gestionar el rol:', error);

        await interaction.reply({
            content: '❌ Hubo un error al modificar tus roles. Comprueba los permisos y la jerarquía de roles del bot.',
            flags: [MessageFlags.Ephemeral]
        });
    }

    return true;
}