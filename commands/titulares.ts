import { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('titulares')
    .setDescription('Sincroniza y asigna el rol Titular desde la hoja de Sheets (PQ2!K2:K16)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: CommandInteraction) {
    // La ejecución la gestiona el enrutador handlePQ2Interactions en generalinteraction.ts
}
