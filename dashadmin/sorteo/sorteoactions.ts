import { 
    ButtonInteraction, 
    EmbedBuilder,
    PermissionFlagsBits,
    MessageFlags
} from 'discord.js';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

    try {
        const fetchedMembers = await guild.members.fetch({ role: roleId });
        const eligibleMembers = fetchedMembers.filter(member => !member.user.bot);

        if (eligibleMembers.size === 0) {
            await interaction.editReply({
                content: '❌ No hay ningún usuario con ese rol en el servidor para realizar el sorteo.'
            });
            return true;
        }

        const membersArray = Array.from(eligibleMembers.values());
        const winningMember = membersArray[Math.floor(Math.random() * membersArray.length)];

        // Tiempos de animación progresivos (simulando inercia y frenado)
        const delais = [250, 250, 300, 350, 450, 600, 850, 1200];
        const getRandomMember = () => membersArray[Math.floor(Math.random() * membersArray.length)];

        for (let i = 0; i < delais.length; i++) {
            const topMember = getRandomMember();
            const midMember = (i === delais.length - 1) ? winningMember : getRandomMember();
            const botMember = getRandomMember();

            const statusText = i > delais.length - 3 ? '⏳ *Frenando la ruleta...*' : '🌀 *Girando a máxima velocidad...*';

            const embedRuleta = new EmbedBuilder()
                .setColor(i > delais.length - 3 ? 0xFFAA00 : 0x0055FF)
                .setTitle('🎰 Girando la Ruleta REDLINE GT')
                .setDescription(
                    '```text\n' +
                    '┌───────────────────────────┐\n' +
                    '│   ░░░  @' + topMember.user.username.slice(0, 10).padEnd(10) + '  ░░░   │\n' +
                    '│ ⚙️ ─────────────── ⚙️ │\n' +
                    '│ ►  @' + midMember.user.username.slice(0, 10).padEnd(10) + '  ◄ │ ◀─── [GIRANDO]\n' +
                    '│ ⚙️ ─────────────── ⚙️ │\n' +
                    '│   ░░░  @' + botMember.user.username.slice(0, 10).padEnd(10) + '  ░░░   │\n' +
                    '└───────────────────────────┘\n' +
                    '```\n' +
                    statusText
                )
                .setFooter({ text: 'REDLINE GT • Sorteos en directo' });

            await interaction.editReply({ content: '🎰 **¡RULETA DE SORTEOS EN DIRECTO!** 🎰', embeds: [embedRuleta] }).catch(() => {});
            await delay(delais[i]);
        }

        // Ganador final
        const originalEmbed = interaction.message.embeds[0];
        const winningEmbed = EmbedBuilder.from(originalEmbed)
            .setColor(0x00FF00)
            .addFields({ 
                name: '🏆 ¡CAMPEÓN DEL SORTEO!', 
                value: `¡Felicidades <@${winningMember.id}> (${winningMember.user.username})! 🥳`, 
                inline: false 
            });

        await interaction.editReply({
            content: `✨ **¡Sorteo finalizado con éxito!** ✨\n\n¡Enhorabuena <@${winningMember.id}>! 🥳`,
            embeds: [winningEmbed],
            components: []
        });

    } catch (error) {
        console.error('❌ Error al realizar el sorteo:', error);
        await interaction.editReply({
            content: '❌ Hubo un error al obtener los miembros. Recuerda activar el "Server Members Intent" en el portal de desarrolladores de Discord.'
        });
    }

    return true;
}
