import { 
    ButtonInteraction, 
    EmbedBuilder,
    PermissionFlagsBits,
    MessageFlags
} from 'discord.js';

// El botón de 1 Click: 5 segundos de suspense y selección de ganador al azar
export async function handleSorteoLaunchButton(interaction: ButtonInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('sorteo_launch_')) return false;

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: '❌ Solo los administradores pueden iniciar el sorteo.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const roleId = interaction.customId.split('_')[2];
    const guild = interaction.guild;
    if (!guild) {
        await interaction.reply({ content: '❌ Acción no válida fuera de un servidor.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

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
        return true;
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

    const originalEmbed = interaction.message.embeds[0];

    const winningEmbed = EmbedBuilder.from(originalEmbed)
        .setColor(0x00FF00)
        .addFields({ 
            name: '🏆 ¡CAMPEÓN DEL SORTEO!', 
            value: `¡Felicidades <@${winner.id}> (${winner.user.username})! 🥳`, 
            inline: false 
        });

    await interaction.editReply({
        content: `✨ **¡Sorteo finalizado con éxito!** ✨\n\n¡Felicidades <@${winner.id}>! 🥳`,
        embeds: [winningEmbed],
        components: []
    });

    return true;
}
