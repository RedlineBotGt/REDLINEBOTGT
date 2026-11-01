
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';

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

    // Obtener ranking ELO: columnas Q a AA
    const rows = await getSheetData('ELO!Q2:AA');

    if (!rows || rows.length === 0) {
      return await interaction.editReply(
        'No se encontraron datos en la hoja de ELO.'
      );
    }

    // Buscar la última jornada publicada en H2:N2
    const headers = await getSheetData('ELO!H1:N1');
    const deltas = await getSheetData('ELO!H2:N2');

    const headerRow = headers?.[0] || [];
    const deltaRow = deltas?.[0] || [];

    let lastDeltaIndex = -1;

    // Buscar de derecha a izquierda la última celda con contenido
    for (let i = 6; i >= 0; i--) {
      if (`${deltaRow[i] ?? ''}`.trim() !== '') {
        lastDeltaIndex = i;
        break;
      }
    }

    // Recuperar el encabezado de esa misma columna
    const lastWeek = lastDeltaIndex >= 0 &&
      headerRow[lastDeltaIndex]
      ? ` | ${headerRow[lastDeltaIndex]}`
      : '';

    // Preparar líneas del ranking
    const rankingLines = rows
      .filter(row => row[0] && row[10])
      .map((row, index) => {
        const pos = `${index + 1}`.padStart(2, ' ');

        // Limpiar menciones y caracteres extraños
        const rawDriver = `${row[0]}`
          .replace(/<@!?\d+>/g, '')
          .trim();

        const driver = rawDriver
          .padEnd(20, ' ')
          .substring(0, 20);

        const eloPoints = `${row[10]}`.padStart(4, ' ');

        return `${pos} | ${driver} | ${eloPoints}`;
      });

    if (rankingLines.length === 0) {
      return await interaction.editReply(
        'No se encontraron datos válidos en el ranking de ELO.'
      );
    }

    // Crear Embed
    const embed = new EmbedBuilder()
      .setTitle(`🏆 RANKING ELO ${roleMention}${lastWeek}`)
      .setDescription(
        `\`\`\`text\n${rankingLines.join('\n')}\n\`\`\``
      )
      .setColor(0xF1C40F);

    await interaction.editReply({
      embeds: [embed],
      allowedMentions: {
        roles: role ? [role.id] : []
      }
    });

  } catch (error) {
    console.error('Error al obtener los datos de ELO:', error);

    await interaction.editReply(
      'Hubo un error al intentar consultar el ELO desde Google Sheets.'
    );
  }
}
