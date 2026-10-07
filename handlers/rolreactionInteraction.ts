import { 
    Interaction, 
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
    GuildMember,
    MessageFlags
} from 'discord.js';

export async function handleRolReactionInteraction(interaction: Interaction): Promise<boolean> {
    try {
        // 1. Botón principal del Dashboard (/dash): Pregunta si Crear o Gestionar
        if (interaction.isButton() && interaction.customId === 'rr_btn_create') {
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
        if (interaction.isButton() && interaction.customId === 'rr_flow_create') {
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
        if (interaction.isButton() && interaction.customId === 'rr_flow_manage') {
            await interaction.update({
                content: '📂 Actualmente no hay paneles de Reaction Roles activos almacenados localmente. Utiliza **Crear** para añadir uno nuevo.',
                components: []
            });
            return true;
        }

        // 3. Paso 2: Canal seleccionado -> Guardar canal y pedir Rol mediante Desplegable
        if (interaction.isChannelSelectMenu() && interaction.customId === 'rr_step_channel') {
            const channelId = interaction.values[0];

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

        // 4. Paso 3: Rol seleccionado -> Mostrar Modal para Título, Texto e Icono
        if (interaction.isRoleSelectMenu() && interaction.customId.startsWith('rr_step_role_')) {
            const channelId = interaction.customId.replace('rr_step_role_', '');
            const roleId = interaction.values[0];

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
                .setPlaceholder('Ej: 🎮 o un emoji personalizado')
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(contentInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(emojiInput)
            );

            await interaction.showModal(modal);
            return true;
        }
        // 5. Procesar envío del Modal: Creación final, envío al canal y guardado
        if (interaction.isModalSubmit() && interaction.customId.startsWith('rr_step_modal_')) {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            const parts = interaction.customId.replace('rr_step_modal_', '').split('_');
            const channelId = parts[0];
            const roleId = parts[1];

            const title = interaction.fields.getTextInputValue('rr_input_title');
            const messageText = interaction.fields.getTextInputValue('rr_input_content');
            const emoji = interaction.fields.getTextInputValue('rr_input_emoji');

            const targetChannel = interaction.guild?.channels.cache.get(channelId);
            const role = interaction.guild?.roles.cache.get(roleId);

            if (!targetChannel || !targetChannel.isTextBased()) {
                await interaction.editReply({ content: '❌ El canal seleccionado no es válido o ya no existe.' });
                return true;
            }

            if (!role) {
                await interaction.editReply({ content: '❌ El rol seleccionado no existe en el servidor.' });
                return true;
            }

            // Construir Embed y Botón interactivo
            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(messageText)
                .setColor(0x0055FF);

            const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`rr_action_role_${roleId}`)
                    .setLabel(`Obtener ${role.name}`)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(emoji)
            );

            // Enviar mensaje al canal configurado
            await targetChannel.send({
                content: messageText, 
                embeds: [embed],
                components: [actionRow]
            });

            await interaction.editReply({
                content: `✅ ¡Reaction Role creado y publicado con éxito en <#${channelId}>!`
            });
            return true;
        }

        // 6. Asignación / Retirada de Rol cuando los usuarios pulsan el botón publicado
        if (interaction.isButton() && interaction.customId.startsWith('rr_action_role_')) {
            const roleId = interaction.customId.replace('rr_action_role_', '');
            const member = interaction.member as GuildMember;

            if (!member || !interaction.guild) {
                await interaction.reply({ content: '❌ Error al procesar la asignación del rol.', flags: [MessageFlags.Ephemeral] });
                return true;
            }

            const role = interaction.guild.roles.cache.get(roleId);
            if (!role) {
                await interaction.reply({ content: '❌ El rol configurado ya no existe en este servidor.', flags: [MessageFlags.Ephemeral] });
                return true;
            }

            const botMember = interaction.guild.members.me;
            if (botMember && role.position >= botMember.roles.highest.position) {
                await interaction.reply({ content: '❌ No tengo permisos suficientes para gestionar este rol (está por encima de mi rol más alto).', flags: [MessageFlags.Ephemeral] });
                return true;
            }

            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(roleId);
                await interaction.reply({ content: `❌ Se te ha **retirado** el rol **${role.name}**.`, flags: [MessageFlags.Ephemeral] });
            } else {
                await member.roles.add(roleId);
                await interaction.reply({ content: `✅ ¡Se te ha **asignado** el rol **${role.name}** correctamente!`, flags: [MessageFlags.Ephemeral] });
            }
            return true;
        }

        return false;

    } catch (error) {
        console.error('❌ Error en handleRolReactionInteraction:', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Ocurrió un error inesperado al procesar esta acción.', flags: [MessageFlags.Ephemeral] }).catch(() => {});
        }
        return true;
    }
}
