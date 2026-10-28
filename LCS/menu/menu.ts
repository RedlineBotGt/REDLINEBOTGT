import { 
    SlashCommandBuilder, 
    CommandInteraction, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    TextChannel 
} from 'discord.js';

const LCS_GUILD_ID = '1564967606295732304';
const LCS_MENU_CHANNEL_ID = '1564986136323956857';

export const data = new SlashCommandBuilder()
    .setName('menu')
    .setDescription('Despliega el panel de control principal de LCS');

export async function execute(interaction: CommandInteraction) {
    // 🛡️ Restricción estricta de servidor
    if (interaction.guildId !== LCS_GUILD_ID) {
        return interaction.reply({ 
            content: '❌ Este comando es exclusivo y solo se puede usar en el servidor autorizado de LCS.', 
            ephemeral: true 
        });
    }

    // 🛡️ Restricción de canal (solo se puede invocar en tu canal designado)
    if (interaction.channelId !== LCS_MENU_CHANNEL_ID) {
        return interaction.reply({ 
            content: '❌ Este comando del menú solo se puede utilizar en su canal oficial designado.', 
            ephemeral: true 
        });
    }

    // 🎨 Diseño del Embed principal del Menú / Dash
    const embed = new EmbedBuilder()
        .setTitle('🎛️ Panel de Control - LCS')
        .setDescription(
            'Bienvenido a tu centro de mandos privado.\n\n' +
            'Utiliza los botones inferiores para gestionar las herramientas, alarmas y configuraciones activas del servidor.'
        )
        .setColor('#2b2d31')
        .setFooter({ text: 'DISCORDBOT' })
        .setTimestamp();

    // 🎮 Botones interactivos iniciales para el menú
    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('lcs_menu_alarma')
                .setLabel('⏰ Gestionar Alarmas')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('lcs_menu_refrescar')
                .setLabel('🔄 Actualizar Panel')
                .setStyle(ButtonStyle.Secondary)
        );

    // Responder enviando el menú fijo al canal público
    await interaction.reply({ 
        content: '✅ Panel de control inicializado correctamente.', 
        ephemeral: true 
    });

    // Enviar el mensaje fijo interactivo al canal
    const channel = interaction.channel as TextChannel;
    if (channel) {
        await channel.send({ 
            embeds: [embed], 
            components: [row] 
        });
    }
}
