import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('club')
    .setDescription('Inicia el configurador de desafíos offline de GT Club')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: any) {
    // La interacción se delegará al enrutador general / clubactions
}
