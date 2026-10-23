import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getSheetData } from '../dashsheet/sheetsService';

export const data = new SlashCommandBuilder()
  .setName('elo')
  .setDescription('Muestra el ranking de ELO actualizado');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    // Leemos de la P a la R para coger Piloto (P) y Puntos (R)
    const rows = await getSheetData('ELO!P2:R');

    if (!rows || rows.length === 0) {
      return await interaction.editReply('No se encontraron datos en la hoja de ELO.');
    }

    const rankingLines = rows
      .filter(row => row[0] && row[2]) // row[0] es la P (Piloto) y row[2] es la R (ELO)
      .map((row, index) => {
        const pos = `${index + 1}`.padStart(2, ' ');
        const driver = `${row[0]}`.padEnd(20, ' '); // Ajusta espacio para el nombre
        const eloPoints = `${row[2]}`.padStart(4, ' ');
        
        return `${pos} | ${driver} | ${eloPoints}`;
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
