import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getSheetData } from '../dashsheet/sheetsService';

export const data = new SlashCommandBuilder()
  .setName('elo')
  .setDescription('Muestra el ranking de ELO actualizado');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    // 1. Buscamos el rol GtCup2 para obtener su mención
    const role = interaction.guild?.roles.cache.find(
      r => r.name.toLowerCase().trim() === 'gtcup2'
    );
    const roleMention = role ? `<@&${role.id}>` : '@GtCup2';

    // 2. Leemos las columnas P (Piloto) a R (ELO)
    const rows = await getSheetData('ELO!P2:R');

    if (!rows || rows.length === 0) {
      return await interaction.editReply('No se encontraron datos en la hoja de ELO.');
    }

    const rankingLines = rows
      .filter(row => row[0] && row[2])
      .map((row, index) => {
        const pos = `${index + 1}`.padStart(2, ' ');
        const driver = `${row[0]}`.padEnd(20, ' ');
        const eloPoints = `${row[2]}`.padStart(4, ' ');
        
        return `${pos} | ${driver} | ${eloPoints}`;
      });

    if (rankingLines.length === 0) {
      return await interaction.editReply('No se encontraron datos válidos en el ranking de ELO.');
    }

    // 3. Título con la mención al rol fuera del bloque de código
    const rankingText = `🏆 **RANKING ELO** — ${roleMention}\n\`\`\`text\n` + rankingLines.join('\n') + `\n\`\`\``;

    await interaction.editReply({ content: rankingText });

  } catch (error) {
    console.error('Error al obtener los datos de ELO:', error);
    await interaction.editReply('Hubo un error al intentar consultar el ELO desde Google Sheets.');
  }
}
