import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('dash')
    .setDescription('Muestra el panel de control de REDLINE GT');

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply({
        content: '🏁 **REDLINE GT** — Panel de control cargado correctamente.',
        ephemeral: true
    });
}
