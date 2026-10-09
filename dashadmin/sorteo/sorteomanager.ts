import { 
    ButtonInteraction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ChannelSelectMenuInteraction, 
    RoleSelectMenuInteraction, 
    ModalSubmitInteraction,
    EmbedBuilder,
    ButtonStyle,
    ChannelType,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ButtonBuilder,
    MessageFlags
} from 'discord.js';

// Mapas temporales para almacenar las configuraciones mientras el admin completa los pasos
const activeSorteoConfigs = new Map<string, { message: string; prize: string }>();
const activeSorteoChannels = new Map<string, string>(); // userId -> channelId

// 1. Abre cái Modal al pulsar "Crear Sorteo" en el /dash
export async function handleDashSorteoButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_sorteo_create') return false; // ➔ Corregido para coincidir con el panel

    const modal = new ModalBuilder()
        .setCustomId('modal_sorteo_config')
        .setTitle('🎁 Configuración del Sorteo');

    const messageInput = new TextInputBuilder()
        .setCustomId('sorteo_text_msg')
        .setLabel('Mensaje del Sorteo')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Ej: ¡Sorteo especial en {server} para {member}!')
        .setRequired(true);

    const prizeInput = new TextInputBuilder()
        .setCustomId('sorteo_text_prize')
        .setLabel('Premio (Texto o enlace directo de imagen)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: https://i.imgur.com/... o Nombre del Premio')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(messageInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(prizeInput)
    );

    await interaction.showModal(modal);
    return true;
}

// 2. Recibe el Modal y pide el Canal público
export async function handleSorteoModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_sorteo_config') return false;

    const textMsg = interaction.fields.getTextInputValue('sorteo_text_msg');
    const prize = interaction.fields.getTextInputValue('sorteo_text_prize');

    activeSorteoConfigs.set(interaction.user.id, { message: textMsg, prize });

    const channelSelectRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('sorteo_select_channel')
            .setPlaceholder('📂 Selecciona el canal público para el sorteo')
            .addChannelTypes(ChannelType.GuildText)
    );

    await interaction.reply({
        content: '⚙️ **Paso 2/3:** Ahora selecciona el canal donde se publicará el sorteo:',
        components: [channelSelectRow],
        flags: [MessageFlags.Ephemeral]
    });
    return true;
}

// 3. Recibe el canal y pide el rol participante
export async function handleSorteoChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'sorteo_select_channel') return false;

    const channel = interaction.channels.first();
    if (!channel) {
        await interaction.update({ content: '❌ No se ha seleccionado ningún canal válido.', components: [] });
        return true;
    }

    activeSorteoChannels.set(interaction.user.id, channel.id);

    const roleSelectRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId('sorteo_select_role')
            .setPlaceholder('🛡 Selecciona el rol único participante')
    );

    await interaction.update({
        content: `✅ Canal seleccionado: <#${channel.id}>\n\n👥 Ahora selecciona el **rol único** que tiene acceso a participar:`,
        components: [roleSelectRow]
    });
    return true;
}

// 4. Recibe el rol, genera el mensaje público y el botón de participación
export async function handleSorteoRoleSelect(interaction: RoleSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'sorteo_select_role') return false;

    const role = interaction.roles.first();
    if (!role) {
        await interaction.update({ content: '❌ No se ha seleccionado ningún rol válido.', components: [] });
        return true;
    }

    const config = activeSorteoConfigs.get(interaction.user.id);
    const channelId = activeSorteoChannels.get(interaction.user.id);
    const guild = interaction.guild;

    if (!config || !channelId || !guild) {
        await interaction.update({ content: '❌ Error en los datos del sorteo. Vuelve a empezar desde el `/dash`.', components: [] });
        return true;
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.update({ content: '❌ El canal seleccionado no es válido o no existe.', components: [] });
        return true;
    }

    // Reemplazo inteligente de tags personalizados ({server} y {member})
    let formattedMessage = config.message
        .replace(/{server}/gi, guild.name)
        .replace(/{member}/gi, `<@&${role.id}>`);

    // Detección automática: convierte cualquier texto con formato @NombreDeRol en una mención real de Discord
    guild.roles.cache.forEach(r => {
        const regex = new RegExp(`@${r.name}`, 'gi');
        formattedMessage = formattedMessage.replace(regex, `<@&${r.id}>`);
    });

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🎉 ¡NUEVO SORTEO ACTIVADO! 🎉')
        .setDescription(formattedMessage)
        .addFields(
            { name: '🛡 Rol Participante', value: `<@&${role.id}>`, inline: false },
            { name: 'PREMIO', value: config.prize.startsWith('http') ? '\u200b' : config.prize, inline: false }
        )
        .setFooter({ 
            text: `Organizado por ${guild.name}`, 
            iconURL: guild.iconURL() || undefined 
        })
        .setTimestamp();

    if (config.prize.startsWith('http')) {
        embed.setImage(config.prize);
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`sorteo_launch_${role.id}`)
            .setLabel('🎲 Realizar Sorteo')
            .setStyle(ButtonStyle.Success)
    );

    await channel.send({
        embeds: [embed],
        components: [row]
    });

    activeSorteoConfigs.delete(interaction.user.id);
    activeSorteoChannels.delete(interaction.user.id);

    await interaction.update({
        content: `✅ ¡Sorteo publicado con éxito en <#${channelId}>!`,
        components: [],
        flags: [MessageFlags.Ephemeral]
    });
    return true;
}
