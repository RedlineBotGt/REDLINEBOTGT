import { 
    Interaction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder,
    GuildMember
} from 'discord.js';

export async function handleRolReactionInteraction(interaction: Interaction): Promise<boolean> {
    try {
        // 1. Botón principal del Dashboard (/dash) para abrir el formulario de creación
        if (interaction.isButton() && interaction.customId === 'rr_btn_create') {
            const modal = new ModalBuilder()
                .setCustomId('rr_modal_setup')
                .setTitle('Configurar Reaction Role');

            const titleInput = new TextInputBuilder()
                .setCustomId('rr_input_title')
                .setLabel('Título del Embed')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ej: 🎭 Roles de Notificaciones')
                .setRequired(true);

            const descInput = new TextInputBuilder()
                .setCustomId('rr_input_desc')
                .setLabel('Descripción del Mensaje')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Ej: Pulsa el botón de abajo para obtener tu rol.')
                .setRequired(true);

            const roleInput = new TextInputBuilder()
                .setCustomId('rr_input_role')
                .setLabel('ID del Rol (Rol ID de Discord)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ej: 123456789012345678')
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(roleInput)
            );

            await interaction.showModal(modal);
            return true;
        }

        // 2. Procesar el envío del Modal para generar el mensaje de autoroles en el canal
        if (interaction.isModalSubmit() && interaction.customId === 'rr_modal_setup') {
            await interaction.deferReply({ ephemeral: true });

            const title = interaction.fields.getTextInputValue('rr_input_title');
            const description = interaction.fields.getTextInputValue('rr_input_desc');
            const roleId = interaction.fields.getTextInputValue('rr_input_role');

            // Validar que el rol exista en el servidor
            const role = interaction.guild?.roles.cache.get(roleId);
            if (!role) {
                await interaction.editReply({
                    content: `❌ No se ha encontrado ningún rol con el ID \`${roleId}\` en este servidor. Comprueba que el ID sea correcto.`
                });
                return true;
            }

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor(0x0055FF);

            // Botón con el ID del rol incrustado en su customId
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`rr_role_${roleId}`)
                    .setLabel(`Obtener ${role.name}`)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎭')
            );

            if (interaction.channel && 'send' in interaction.channel) {
                await interaction.channel.send({
                    embeds: [embed],
                    components: [row]
                });

                await interaction.editReply({
                    content: '✅ ¡Reaction Role creado y publicado con éxito en este canal!'
                });
            } else {
                await interaction.editReply({
                    content: '❌ No se pudo enviar el mensaje al canal actual.'
                });
            }
            return true;
        }

        // 3. Cuando un usuario pulsa el botón del autorol para asignárselo o quitárselo
        if (interaction.isButton() && interaction.customId.startsWith('rr_role_')) {
            const roleId = interaction.customId.replace('rr_role_', '');
            const member = interaction.member as GuildMember;

            if (!member || !interaction.guild) {
                await interaction.reply({
                    content: '❌ Error al procesar la asignación del rol.',
                    ephemeral: true
                });
                return true;
            }

            const role = interaction.guild.roles.cache.get(roleId);
            if (!role) {
                await interaction.reply({
                    content: '❌ El rol configurado ya no existe en este servidor.',
                    ephemeral: true
                });
                return true;
            }

            // Validar que el bot tenga jerarquía suficiente para asignar el rol
            const botMember = interaction.guild.members.me;
            if (botMember && role.position >= botMember.roles.highest.position) {
                await interaction.reply({
                    content: '❌ No tengo permisos suficientes para asignar este rol (está por encima de mi rol más alto en la jerarquía del servidor).',
                    ephemeral: true
                });
                return true;
            }

            // Alternar rol (Si lo tiene se lo quita, si no lo tiene se lo pone)
            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(roleId);
                await interaction.reply({
                    content: `❌ Se te ha **retirado** el rol **${role.name}**.`,
                    ephemeral: true
                });
            } else {
                await member.roles.add(roleId);
                await interaction.reply({
                    content: `✅ ¡Se te ha **asignado** el rol **${role.name}** correctamente!`,
                    ephemeral: true
                });
            }
            return true;
        }

        // Si la interacción no pertenece a este módulo
        return false;

    } catch (error) {
        console.error('❌ Error en handleRolReactionInteraction:', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ Ocurrió un error inesperado al gestionar el reaction role.',
                ephemeral: true
            }).catch(() => {});
        }
        return true;
    }
}
