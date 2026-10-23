import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getSheetData } from '../dashsheet/sheetsService';

export const data = new SlashCommandBuilder()
  .setName('elo')
  .setDescription('Muestra el ranking de ELO actualizado');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const rows = await getSheetData('ELO!Q2:R');

    if (!rows || rows.length === 0) {
      return await interaction.editReply('No se encontraron datos en la hoja de ELO.');
    }

    const rankingLines = rows
      .filter(row => row[0] && row[1])
      .map((row, index) => {
        const pos = `${index + 1}`.padStart(2, ' ');
        const driverName = `${row[0]}`.padEnd(18, ' '); // Anoratra ny anaran'ny mpamily mivantana
        const eloPoints = `${row[1]}`.padStart(4, ' ');
        return `${pos} | ${driverName} | ${eloPoints}`;
      });

    if (rankingLines.length === 0) {
      return await interaction.editReply('No se encontraron datos válidos en el ranking de ELO.');
    }

    const rankingText = `🏆 **RANKING ELO**\n\`\`\`text\n` + rankingLines.join('\n') + `\n\`\`\``;

    await interaction.editReply({ content: rankingText });

  } catch (error) {
    console.error('Error al obtener los datos de ELO:', error);
    await interaction.editReply('Hubo un error al intentar consultar el ELO desde Google Sheets.');
  }
}
