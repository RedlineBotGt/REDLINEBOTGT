import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getSheetData } from '../sheetsService'; // O la ruta relativa correcta desde commands/ hacia sheetsService

export const data = new SlashCommandBuilder()
  .setName('elo')
  .setDescription('Muestra el ranking de ELO actualizado');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    // 1. Usar el mismo servicio de lectura que ya usa el resto del bot
    const rows = await getSheetData('ELO!Q2:R24');

    if (!rows || rows.length === 0) {
      return await interaction.editReply('No se encontraron datos en la hoja de ELO.');
    }

    // 2. Formatear las filas (Q = ID/Mención de Discord, R = ELO)
    const rankingText = rows
      .filter(row => row[0] && row[1])
      .map((row, index) => {
        const userIdMention = row[0]; // Mención <@ID>
        const eloPoints = row[1];     // Valor de ELO
        return `**${index + 1}.** ${userIdMention} — **${eloPoints} pts**`;
      })
      .join('\n');

    // 3. Crear Embed para Discord
    const embed = new EmbedBuilder()
      .setTitle('🏆 RANKING ELO')
      .setColor('#FF0000')
      .setDescription(rankingText)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error al obtener los datos de ELO:', error);
    await interaction.editReply('Hubo un error al intentar consultar el ELO desde Google Sheets.');
  }
}
