import { 
    ChatInputCommandInteraction, 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder 
} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('dashsheet')
    .setDescription('Panel interactivo de consulta y publicación de datos desde Google Sheets');

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
        return interaction.reply({ content: 'Este comando solo puede usarse en un servidor.', ephemeral: true });
    }

    const guildName = interaction.guild.name;
    const guildIcon = interaction.guild.iconURL({ dynamic: true }) || undefined;

    // 1. Embed del Panel Principal
    const mainEmbed = new EmbedBuilder()
        .setAuthor({ name: guildName, iconURL: guildIcon })
        .setTitle('📊 REDLINE GT — Panel Google Sheets')
        .setDescription('Selecciona una opción para consultar los datos actualizados de la hoja de cálculo:')
        .setColor(0x1b1b1b) // Estética oscura racing
        .setFooter({ text: 'REDLINE GT', iconURL: guildIcon });

    // 2. Botonera Principal (4 opciones) con los customId exactos que espera el router
    const rowButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('sheets_clasificacion')
            .setLabel('Clasificación')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🏆'),
        new ButtonBuilder()
            .setCustomId('sheets_asistencia')
            .setLabel('Asistencia')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📋'),
        new ButtonBuilder()
            .setCustomId('sheets_vr')
            .setLabel('VR')
            .setStyle(ButtonStyle.Success)
            .setEmoji('⚡'),
        new ButtonBuilder()
            .setCustomId('sheets_pp')
            .setLabel('PP')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🎯')
    );

    await interaction.reply({
        embeds: [mainEmbed],
        components: [rowButtons],
        ephemeral: true
    });
}
