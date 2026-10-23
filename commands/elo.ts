import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getSheetData } from '../utils/sheetsService';

export const data = new SlashCommandBuilder()
  .setName('elo')
  .setDescription('Muestra el ranking de ELO actualizado');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const role = interaction.guild?.roles.cache.find(
      r => r.name.toLowerCase().trim() === 'gtcup2'
    );
    const roleMention = role ? `<@&${role.id}>` : '@GtCup2';

    // Rango desde la columna P hasta la Y
    const rows = await getSheetData('ELO!P2:Y');

    if (!rows || rows.length === 0) {
      return await interaction.editReply('No se encontraron datos en la hoja de ELO.');
    }

    const rankingLines = rows
      .filter(row => row[0] && row[9]) // row[0] es la P (Piloto) y row[9] es la Y (ELO)
      .map((row, index) => {
        const pos = `${index + 1}`.padStart(2, ' ');
        
        // Limpiamos menciones o caracteres extraños para no descuadrar la tabla
        const rawDriver = `${row[0]}`.replace(/<@!?\d+>/g, '').trim();
        const driver = rawDriver.padEnd(20, ' ').substring(0, 20);
        
        const eloPoints = `${row[9]}`.padStart(4, ' '); // Puntos de Elo desde la columna Y
        
        return `${pos} | ${driver} | ${eloPoints}`;
      });

    if (rankingLines.length === 0) {
      return await interaction.editReply('No se encontraron datos válidos en el ranking de ELO.');
    }

    const rankingText = `🏆 **RANKING ELO** — ${roleMention}\n\`\`\`text\n` + rankingLines.join('\n') + `\n\`\`\``;

    await interaction.editReply({ 
      content: rankingText,
      allowedMentions: { roles: role ? [role.id] : [] }
    });

  } catch (error) {
    console.error('Error al obtener los datos de ELO:', error);
    await interaction.editReply('Hubo un error al intentar consultar el ELO desde Google Sheets.');
  }
}
