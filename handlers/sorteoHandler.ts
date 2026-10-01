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
    PermissionFlagsBits,
    ChannelType,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ButtonBuilder
} from 'discord.js';

// Mapas temporales para almacenar las configuraciones mientras el admin completa los pasos
const activeSorteoConfigs = new Map<string, { message: string; prize: string }>();
const activeSorteoChannels = new Map<string, string>(); // userId -> channelId

// 1. Abre el Modal al pulsar "Crear Sorteo" en el /dash
export async function handleDashSorteoButton(interaction: ButtonInteraction) {
    const modal = new ModalBuilder()
        .setCustomId('modal_sorteo_config')
        .setTitle('🎁 Configuración del Sorteo');

    const messageInput = new TextInputBuilder()
        .setCustomId('sorteo_text_msg')
        .setLabel('Mensaje del Sorteo')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Ej: PRIMER Pre Sorteo de {server}\nUn premio para el @Staff\nDe todos los {member}....')
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
}

// 2. Recibe el Modal y pide el Canal público
export async function handleSorteoModalSubmit(interaction: ModalSubmitInteraction) {
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
        ephemeral: true
    });
}

// 3. Recibe el canal y pide el rol participante
export async function handleSorteoChannelSelect(interaction: ChannelSelectMenuInteraction) {
    const channel = interaction.channels.first();
    if (!channel) {
        return interaction.update({ content: '❌ No se ha seleccionado ningún canal válido.', components: [] });
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
}

// 4. Recibe el rol, genera el mensaje público y el botón de participación
export async function handleSorteoRoleSelect(interaction: RoleSelectMenuInteraction) {
    const role = interaction.roles.first();
    if (!role) {
        return interaction.update({ content: '❌ No se ha seleccionado ningún rol válido.', components: [] });
    }

    const config = activeSorteoConfigs.get(interaction.user.id);
    const channelId = activeSorteoChannels.get(interaction.user.id);
    const guild = interaction.guild;

    if (!config || !channelId || !guild) {
        return interaction.update({ content: '❌ Error en los datos del sorteo. Vuelve a empezar desde el `/dash`.', components: [] });
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
        return interaction.update({ content: '❌ El canal seleccionado no es válido o no existe.', components: [] });
    }

    // Reemplazo inteligente de tags como {server} y {member}
    let formattedMessage = config.message
        .replace(/{server}/gi, guild.name)
        .replace(/{member}/gi, `<@&${role.id}>`);

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🎉 ¡NUEVO SORTEO ACTIVADO! 🎉')
        .setDescription(formattedMessage)
        .addFields(
            { name: '🎁 Premio', value: config.prize.startsWith('http') ? '¡Mira la imagen adjunta abajo!' : config.prize, inline: false },
            { name: '🛡️ Rol Participante', value: `<@&${role.id}>`, inline: false }
        )
        .setFooter({ 
            text: `Organizado por ${guild.name}`, 
            iconURL: guild.iconURL() || undefined 
        })
        .setTimestamp();

    // Si el premio es un enlace directo de imagen, lo mostramos limpio con setImage (sin texto de enlace)
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

    // Limpieza de memoria temporal
    activeSorteoConfigs.delete(interaction.user.id);
    activeSorteoChannels.delete(interaction.user.id);

    await interaction.update({
        content: `✅ ¡Sorteo publicado con éxito en <#${channelId}>!`,
        components: [],
        ephemeral: true
    });
}

// 5. El botón de 1 Click: 5 segundos de suspense y selección de ganador al azar
export async function handleSorteoLaunchButton(interaction: ButtonInteraction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: '❌ Solo los administradores pueden iniciar el sorteo.', ephemeral: true });
        return;
    }

    const roleId = interaction.customId.split('_')[2];
    const guild = interaction.guild;
    if (!guild) return;

    await interaction.update({
        content: '🔄 Buscando participantes elegibles con el rol...',
        components: []
    });

    await guild.members.fetch();
    const eligibleMembers = guild.members.cache.filter(
        member => member.roles.cache.has(roleId) && !member.user.bot
    );

    if (eligibleMembers.size === 0) {
        await interaction.editReply({
            content: '❌ No hay ningún usuario con ese rol en el servidor para realizar el sorteo.'
        });
        return;
    }

    const membersArray = Array.from(eligibleMembers.values());

    // Efecto de suspense de 5 segundos
    const suspenseSteps = [
        '🎲 Barajando participantes y preparando la tómbola... (1s)',
        '🎟 Analizando tickets y perfiles... (2s)',
        '⚡ ¡La tensión aumenta en el paddock!... (3s)',
        '🔥 Quedan pocos candidatos finales... (4s)',
        '🎯 ¡Seleccionando al campeón absoluto!... (5s)'
    ];

    for (const stepText of suspenseSteps) {
        await interaction.editReply({ content: stepText });
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Ganador aleatorio
    const winner = membersArray[Math.floor(Math.random() * membersArray.length)];

    const winningEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(0x00FF00)
        .addFields({ name: '🏆 ¡CAMPEÓN DEL SORTEO!', value: `¡Felicidades <@${winner.id}>! 🥳`, inline: false });

    await interaction.editReply({
        content: '✨ **¡Sorteo finalizado con éxito!** ✨',
        embeds: [winningEmbed],
        components: []
    });
}
