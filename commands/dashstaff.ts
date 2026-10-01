const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dashstaff')
        .setDescription('Panel operativo del Staff'),
    
    async execute(interaction) {
        // Embed minimalista
        const embed = new EmbedBuilder()
            .setColor(0x2b2d31) // Color oscuro neutro
            .setDescription('### ⚡ Panel Operativo\nSelecciona una acción disponible para el staff:');

        // Botones organizados en una fila
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('dashstaff_event')
                    .setLabel('Crear evento')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📅'),
                new ButtonBuilder()
                    .setCustomId('dashstaff_form')
                    .setLabel('Formulario')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📋'),
                new ButtonBuilder()
                    .setCustomId('dashstaff_msg')
                    .setLabel('Enviar mensaje')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('💬'),
                new ButtonBuilder()
                    .setCustomId('dashstaff_verdict')
                    .setLabel('Veredicto')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('⚖️')
            );

        await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true // Solo visible para quien ejecuta el comando (o ajústalo según prefieras)
        });
    },
};
