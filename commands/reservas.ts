import { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('reservas')
    .setDescription('Sincroniza y asigna el rol Reserva desde la hoja de Sheets (PQ2!K22:K37)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: CommandInteraction) {
    // La ejecución la gestiona el enrutador handlePQ2Interactions en generalinteraction.ts
}
