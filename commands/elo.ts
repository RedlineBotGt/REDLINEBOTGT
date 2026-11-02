
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';

import { getSheetData } from '../utils/sheetsService';

const ROLE_ID = '1561657316284309534';

export const data = new SlashCommandBuilder()
  .setName('elo')
  .setDescription('Muestra el ranking de ELO actualizado');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    // Buscar la última jornada con datos en todo el rango G2:N
    const journeyData = await getSheetData('ELO!G2:N');

    let lastColumnIndex = -1;

    if (journeyData && journeyData.length > 0) {
      for (const row of journeyData) {
        for (let i = 0; i < 8; i++) {
          const value = String(row[i] ?? '').trim();

          if (value !== '') {
            lastColumnIndex = Math.max(lastColumnIndex, i);
          }
        }
      }
    }

    // Obtener el encabezado correspondiente de G1:N1
    const headers = await getSheetData('ELO!G1:N1');
    const headerRow = headers?.[0] ?? [];

    const weekName =
      lastColumnIndex >= 0
        ? String(headerRow[lastColumnIndex] ?? '').trim() || 'GENERAL'
        : 'GENERAL';

    // Obtener el ranking ordenado por ELO total
    const pilots = await getSheetData('ELO!Q2:AA');

    if (!pilots || pilots.length === 0) {
      await interaction.editReply(
        '⚠️ No hay datos disponibles en el ranking ELO.'
      );
      return;
    }

    // Filtrar filas con piloto y ELO total
    const validPilots = pilots.filter(row => {
      const driver = String(row[0] ?? '').trim();
      const elo = String(row[10] ?? '').trim();

      return driver !== '' && elo !== '';
    });

    if (validPilots.length === 0) {
      await interaction.editReply(
        '⚠️ No hay pilotos disponibles en el ranking ELO.'
      );
      return;
    }

    // Crear las líneas del ranking
    const lines = validPilots.map((row, index) => {
      const position = String(index + 1).padStart(2, ' ');
      const driver = String(row[0]).trim();
      const elo = String(row[10]).trim().padStart(4, ' ');

      return `${position} | ${driver} | ${elo}`;
    });

    // Crear Embed limpio, sin variaciones ni flechas
    const embed = new EmbedBuilder()
      .setColor(0xD71920)
      .setTitle(`🏆 RANKING ELO | ${weekName}`)
      .setDescription([
        '```text',
        ...lines,
        '```'
      ].join('\n'))
      .setFooter({
        text: 'REDLINE GT • Clasificación ELO'
      })
      .setTimestamp();

    // Publicar ranking y mencionar el rol
    await interaction.editReply({
      content: `<@&${ROLE_ID}>`,
      embeds: [embed],
      allowedMentions: {
        roles: [ROLE_ID]
      }
    });

  } catch (error) {
    console.error('[ELO] Error:', error);

    await interaction.editReply(
      '❌ Error al obtener el ranking ELO de Google Sheets.'
    );
  }
}
