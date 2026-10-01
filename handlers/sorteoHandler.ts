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
    PermissionFlagsBits
} from 'discord.js';

const activeSorteoConfigs = new Map<string, { message: string; prize: string }>();

// 1. Muestra el modal al pulsar el botón en el /dash
export async function handleDashSorteoButton(interaction: ButtonInteraction) {
    const modal = new ModalBuilder()
        .setCustomId('modal_sorteo_config')
        .setTitle('🎁 Configuración del Sorteo');

    const messageInput = new TextInputBuilder()
        .setCustomId('sorteo_text_msg')
        .setLabel('Mensaje del Sorteo')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Ej: ¡Sorteo especial de temporada para celebrar la comunidad!')
        .setRequired(true);

    const prizeInput = new TextInputBuilder()
        .setCustomId('sorteo_text_prize')
        .setLabel('Regalo / Premio (Texto o URL de imagen)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: Cuenta VIP o Juego de Simracing / Enlace de imagen')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(messageInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(prizeInput)
    );

    await interaction.showModal(modal);
}

// 2. Recibe el Modal y pide Canal
export async function handleSorteoModalSubmit(interaction: ModalSubmitInteraction) {
    const textMsg = interaction.fields.getTextInputValue('sorteo_text_msg');
    const prize = interaction.fields.getTextInputValue('sorteo_text_prize');

    activeSorteoConfigs.set(interaction.user.id, { message: textMsg, prize });

    const channelSelectRow = new ActionRowBuilder<any>().addComponents(
        new (require('discord.js').ChannelSelectMenuBuilder)()
            .setCustomId('sorteo_select_channel')
            .setPlaceholder('📂 Selecciona el canal público para el sorteo')
            .addChannelTypes(require('discord.js').ChannelType.GuildText)
    );

    await interaction.reply({
        content: '⚙️ **Paso 2/3:** Ahora selecciona el canal donde se publicará el sorteo:',
        components: [channelSelectRow],
        ephemeral: true
    });
}

// 3. Recibe el canal y pide el rol
export async function handleSorteoChannelSelect(interaction: ChannelSelectMenuInteraction) {
    const channel = interaction.channels.first();
    if (!channel) {
        return interaction.update({ content: '❌ No se ha seleccionado ningún canal válido.', components: [] });
    }

    (global as any)[`sorteo_chan_${interaction.user.id}`] = channel.id;

    const roleSelectRow = new ActionRowBuilder<any>().addComponents(
        new (require('discord.js').RoleSelectMenuBuilder)()
            .setCustomId('sorteo_select_role')
            .setPlaceholder('🛡️ Selecciona el rol único participante')
    );

    await interaction.update({
        content: `✅ Canal seleccionado: <#${channel.id}>\n\n👥 Ahora selecciona el **rol único** que tiene acceso a participar:`,
        components: [roleSelectRow]
    });
}

// 4. Recibe el rol y publica el mensaje final con el botón de sorteo
export async function handleSorteoRoleSelect(interaction: RoleSelectMenuInteraction) {
    const role = interaction.roles.first();
    if (!role) {
        return interaction.update({ content: '❌ No se ha seleccionado ningún rol válido.', components: [] });
    }

    const config = activeSorteoConfigs.get(interaction.user.id);
    const channelId = (global as any)[`sorteo_chan_${interaction.user.id}`];

    if (!config || !channelId) {
        return interaction.update({ content: '❌ Error en los datos del sorteo. Vuelve a empezar desde el `/dash`.', components: [] });
    }

    const channel = interaction.guild?.channels.cache.get(channelId);
    if (!channel || channel.type !== require('discord.js').ChannelType.GuildText) {
        return interaction.update({ content: '❌ El canal seleccionado no es válido o no existe.', components: [] });
    }

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🎉 ¡NUEVO SORTEO ACTIVADO! 🎉')
        .setDescription(config.message)
        .addFields(
            { name: '🎁 Premio', value: config.prize, inline: false },
            { name: '🛡️ Rol Participante', value: `<@&${role.id}>`, inline: false },
            { name: '👑 Organizado por', value: `<@${interaction.user.id}>`, inline: false }
        )
        .setTimestamp();

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
    delete (global as any)[`sorteo_chan_${interaction.user.id}`];

    await interaction.update({
        content: `✅ ¡Sorteo publicado con éxito en <#${channelId}>!`,
        components: [],
        ephemeral: true
    });
}

// 5. Botón de 1 Click: 5 segundos de suspense y selección de ganador
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

    const suspenseSteps = [
        '🎲 Barajando participantes y preparando la tómbola... (1s)',
        '🎟️️ Analizando tickets y perfiles... (2s)',
        '⚡ ¡La tensión aumenta en el paddock!... (3s)',
        '🔥 Quedan pocos candidatos finales... (4s)',
        '🎯 ¡Seleccionando al campeón absoluto!... (5s)'
    ];

    for (const stepText of suspenseSteps) {
        await interaction.editReply({ content: stepText });
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

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
