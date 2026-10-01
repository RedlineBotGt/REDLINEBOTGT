import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('dashstaff')
    .setDescription('Panel operativo del Staff');

export async function execute(interaction) {
    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setDescription('### ⚡ Panel Operativo\nSelecciona una acción disponible para el staff:');

    // Usamos los mismos customId que ya gestiona el interactionRouter
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('dash_btn_event_create')
            .setLabel('Crear evento')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📅'),
        new ButtonBuilder()
            .setCustomId('dash_btn_colocar_form')
            .setLabel('Formulario')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📋'),
        new ButtonBuilder()
            .setCustomId('dash_btn_msn_mensaje')
            .setLabel('Enviar mensaje')
            .setStyle(ButtonStyle.Success)
            .setEmoji('💬'),
        new ButtonBuilder()
            .setCustomId('dash_btn_veredicto')
            .setLabel('Veredicto')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⚖️')
    );

    await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
    });
}
