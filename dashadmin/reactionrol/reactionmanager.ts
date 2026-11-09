
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

// =====================================================
// 1. BOTÓN PRINCIPAL DEL DASHBOARD
// =====================================================

export async function handleDashRrButton(
    interaction: ButtonInteraction
): Promise<boolean> {

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

// =====================================================
// 2. CREAR: SELECCIONAR CANAL
// =====================================================

export async function handleRrStartCreate(
    interaction: ButtonInteraction
): Promise<boolean> {

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

// =====================================================
// 3. GESTIONAR PANELES EXISTENTES
// =====================================================

export async function handleRrManage(
    interaction: ButtonInteraction
): Promise<boolean> {

    if (interaction.customId !== 'rr_flow_manage') return false;

    const col = await getReactionCollection();

    const configs = await col.find({
        guildId: interaction.guildId
    }).toArray();

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

        const channelName = cfg.channelName || 'Canal sin nombre';

        const roleName = cfg.roleName || 'Rol';

        const label = `${channelName} | ${roleName}`.substring(0, 100);

        selectMenu.addOptions({
            label,
            description: cfg.content
                ? cfg.content.substring(0, 100)
                : 'Sin texto',
            value: cfg.messageId
        });
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(selectMenu);

    await interaction.update({
        content: '📂 **Gestionar Reaction Roles:** Selecciona el panel cuya configuración deseas eliminar:',
        components: [row]
    });

    return true;
}

// =====================================================
// 4. SELECCIONAR CANAL
// =====================================================

export async function handleRrChannelSelect(
    interaction: ChannelSelectMenuInteraction
): Promise<boolean> {

    if (interaction.customId !== 'rr_step_channel') return false;

    const channelId = interaction.values[0];

    rrSessions.set(interaction.user.id, {
        channelId
    });

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

// =====================================================
// 5. SELECCIONAR ROL Y ABRIR FORMULARIO
// =====================================================

export async function handleRrRoleSelect(
    interaction: RoleSelectMenuInteraction
): Promise<boolean> {

    if (!interaction.customId.startsWith('rr_step_role_')) {
        return false;
    }

    const channelId = interaction.customId.replace(
        'rr_step_role_',
        ''
    );

    const roleId = interaction.values[0];

    const session = rrSessions.get(interaction.user.id) || {
        channelId
    };

    session.roleId = roleId;

    rrSessions.set(interaction.user.id, session);

    const modal = new ModalBuilder()
        .setCustomId(`rr_step_modal_${channelId}_${roleId}`)
        .setTitle('Configurar Reaction Role');

    const contentInput = new TextInputBuilder()
        .setCustomId('rr_input_content')
        .setLabel('Texto del mensaje')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Ej: Si te interesa participar, responde a este mensaje mencionando @Comisario.')
        .setRequired(true);

    const emojiInput = new TextInputBuilder()
        .setCustomId('rr_input_emoji')
        .setLabel('Icono / Emoji para el botón')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 🎮')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>()
            .addComponents(contentInput),

        new ActionRowBuilder<TextInputBuilder>()
            .addComponents(emojiInput)
    );

    await interaction.showModal(modal);

    return true;
}

// =====================================================
// 6. PUBLICAR MENSAJE
// =====================================================

export async function handleRrContentSubmit(
    interaction: ModalSubmitInteraction
): Promise<boolean> {

    if (!interaction.customId.startsWith('rr_step_modal_')) {
        return false;
    }

    await interaction.deferReply({
        flags: [MessageFlags.Ephemeral]
    });

    const parts = interaction.customId
        .replace('rr_step_modal_', '')
        .split('_');

    const channelId = parts[0];
    const roleId = parts[1];

    const messageText = interaction.fields.getTextInputValue(
        'rr_input_content'
    );

    const emoji = interaction.fields.getTextInputValue(
        'rr_input_emoji'
    );

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

        if (
            !targetChannel ||
            !targetChannel.isTextBased() ||
            !('send' in targetChannel)
        ) {
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

        const col = await getReactionCollection();

        const customButtonId = `rr_action_role_${roleId}_${Date.now()}`;

        // Convertir las menciones escritas como @Nombre
        // en menciones reales de Discord.

        const escapedRoleName = role.name.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
        );

        const roleMentionPattern = new RegExp(
            `@${escapedRoleName}(?![\\w-])`,
            'gi'
        );

        const finalMessageText = messageText.replace(
            roleMentionPattern,
            `<@&${role.id}>`
        );

        const actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(customButtonId)
                    .setLabel(`Obtener ${role.name}`)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(emoji)
            );

        // No se añade ninguna mención automática al principio.
        // Solo se permiten menciones del rol seleccionado.

        const message = await targetChannel.send({
            content: finalMessageText,
            components: [actionRow],
            allowedMentions: {
                roles: [role.id],
                parse: []
            }
        });

        // Guardar configuración en MongoDB.

        await col.insertOne({
            guildId: guild.id,
            channelId: targetChannel.id,
            channelName: targetChannel.name,
            messageId: message.id,
            buttonId: customButtonId,
            roleId: role.id,
            roleName: role.name,
            content: finalMessageText,
            createdAt: new Date()
        });

        rrSessions.delete(interaction.user.id);

        await interaction.editReply({
            content: `✅ ¡Reaction Role creado y publicado correctamente en **#${targetChannel.name}**!`
        });

    } catch (error) {

        console.error(
            '❌ Error al crear reaction role:',
            error
        );

        await interaction.editReply({
            content: '❌ Ocurrió un error al crear el Reaction Role. Comprueba los permisos del bot.'
        });
    }

    return true;
}

// =====================================================
// 7. ELIMINAR CONFIGURACIÓN EXISTENTE
// =====================================================

export async function handleRrExistingSelect(
    interaction: StringSelectMenuInteraction
): Promise<boolean> {

    if (interaction.customId !== 'rr_select_existing_message') {
        return false;
    }

    const messageId = interaction.values[0];

    const col = await getReactionCollection();

    const result = await col.deleteOne({
        guildId: interaction.guildId,
        messageId
    });

    await interaction.update({
        content: result.deletedCount > 0
            ? '🗑️ **Configuración de Reaction Role eliminada de MongoDB. El botón ya no podrá utilizarse.**'
            : '⚠️ No se encontró la configuración de ese mensaje.',
        components: []
    });

    return true;
}

// =====================================================
// 8. ASIGNAR O RETIRAR ROL
// =====================================================

export async function handleRrRoleAction(
    interaction: ButtonInteraction
): Promise<boolean> {

    if (!interaction.customId.startsWith('rr_action_role_')) {
        return false;
    }

    // Buscar la configuración exacta del botón.
    // No hay fallback por roleId: cada botón es independiente.

    const col = await getReactionCollection();

    const config = await col.findOne({
        guildId: interaction.guildId,
        messageId: interaction.message.id,
        buttonId: interaction.customId
    });

    // Si se eliminó la configuración, el botón queda bloqueado.

    if (!config) {

        await interaction.reply({
            content: '⚠️ Este botón ya no está activo. Su configuración ha sido eliminada.',
            flags: [MessageFlags.Ephemeral]
        });

        return true;
    }

    await interaction.deferReply({
        flags: [MessageFlags.Ephemeral]
    });

    try {

        const guild = interaction.guild;

        if (!guild) {
            await interaction.editReply({
                content: '❌ Acción no válida fuera de un servidor.'
            });

            return true;
        }

        const member = await guild.members.fetch(
            interaction.user.id
        );

        const role = await guild.roles.fetch(config.roleId);

        if (!role) {
            await interaction.editReply({
                content: '❌ El rol configurado ya no existe en este servidor.'
            });

            return true;
        }

        const botMember = guild.members.me;

        if (
            botMember &&
            role.position >= botMember.roles.highest.position
        ) {
            await interaction.editReply({
                content: '❌ No tengo permisos suficientes para gestionar este rol. Está por encima de mi rol más alto.'
            });

            return true;
        }

        if (member.roles.cache.has(config.roleId)) {

            await member.roles.remove(config.roleId);

            await interaction.editReply({
                content: `❌ Se te ha **retirado** el rol **${role.name}**.`
            });

        } else {

            await member.roles.add(config.roleId, `Reaction Role · Canal ID: ${interaction.channelId}`);

            await interaction.editReply({
                content: `✅ ¡Se te ha **asignado** el rol **${role.name}** correctamente!`
            });
        }

    } catch (error) {

        console.error(
            '❌ Error al gestionar rol por botón:',
            error
        );

        await interaction.editReply({
            content: '❌ Ocurrió un error al intentar asignar o quitar el rol.'
        });
    }

    return true;
}
