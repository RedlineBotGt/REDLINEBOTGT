
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';

import { getSheetData } from '../utils/sheetsService';

export const data = new SlashCommandBuilder()
  .setName('elo')
  .setDescription('Muestra el ranking de ELO actualizado');

const ROLE_ID = '1561657316284309534';
const SHEET = 'ELO';

const PILOT_COL = 0;       // A: nombre del piloto
const WEEK_START = 6;      // G
const WEEK_END = 13;       // N

const RANK_NAME_COL = 0;   // Q
const RANK_TOTAL_COL = 10; // AA

function numberValue(value: unknown): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const parsed = Number(String(value).replace(',', '.'));

  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanName(value: unknown): string {
  return String(value ?? '').trim();
}

function shortName(name: string, max = 17): string {
  const chars = Array.from(name);

  if (chars.length <= max) return name;

  return chars.slice(0, max - 1).join('') + '…';
}

export async function execute(
  interaction: ChatInputCommandInteraction
) {
  await interaction.deferReply();

  try {
    // Tabla original con variaciones semanales
    const original = await getSheetData(
      `${SHEET}!A2:N`
    );

    // Encabezados de las jornadas G:N
    const headers = await getSheetData(
      `${SHEET}!G1:N1`
    );

    // Tabla ordenada por ELO total
    const ranking = await getSheetData(
      `${SHEET}!Q2:AA`
    );

    if (!ranking || ranking.length === 0) {
      await interaction.editReply(
        'No hay datos disponibles para el ranking ELO.'
      );
      return;
    }

    // Localizar última jornada con datos
    let lastWeek = -1;

    for (let col = WEEK_END; col >= WEEK_START; col--) {
      const weekIndex = col - WEEK_START;
      const header = headers?.[0]?.[weekIndex];

      if (!header) continue;

      const hasData = original.some(row =>
        row[col] !== undefined &&
        row[col] !== null &&
        String(row[col]).trim() !== ''
      );

      if (hasData) {
        lastWeek = col;
        break;
      }
    }

    if (lastWeek === -1) {
      await interaction.editReply(
        'No se ha encontrado ninguna jornada con variaciones.'
      );
      return;
    }

    const weekIndex = lastWeek - WEEK_START;
    const weekName = String(headers[0][weekIndex]);

    // Variaciones de cada piloto en la última jornada
    const variations = new Map<string, number>();

    for (const row of original) {
      const name = cleanName(row[PILOT_COL]);

      if (!name) continue;

      const raw = row[lastWeek];

      if (
        raw === undefined ||
        raw === null ||
        String(raw).trim() === ''
      ) {
        continue;
      }

      variations.set(name, numberValue(raw));
    }

    // Clasificación actual
    const pilots = ranking
      .filter(row => cleanName(row[RANK_NAME_COL]))
      .map(row => {
        const name = cleanName(row[RANK_NAME_COL]);
        const elo = numberValue(row[RANK_TOTAL_COL]);

        const participated = variations.has(name);
        const variation = variations.get(name) ?? 0;

        return {
          name,
          elo,
          previousElo: elo - variation,
          participated
        };
      });

    // Reconstruir clasificación anterior
    const previousRanking = [...pilots].sort(
      (a, b) => b.previousElo - a.previousElo
    );

    const previousPositions = new Map<string, number>();

    previousRanking.forEach((pilot, index) => {
      previousPositions.set(pilot.name, index + 1);
    });

    // Crear líneas del ranking
    const lines = pilots.map((pilot, index) => {
      const position = index + 1;

      const previousPosition =
        previousPositions.get(pilot.name) ?? position;

      let movement = '⏸';

      if (pilot.participated) {
        const difference = previousPosition - position;

        if (difference > 0) {
          movement = `▲${difference}`;
        } else if (difference < 0) {
          movement = `▼${Math.abs(difference)}`;
        } else {
          movement = '━';
        }
      }

      const pos = String(position).padStart(2, ' ');
      const name = shortName(pilot.name).padEnd(17, ' ');
      const elo = String(pilot.elo).padStart(4, ' ');

      return `${pos}  ${name} ${elo}  ${movement}`;
    });

    const description = [
      '```text',
      ' #  PILOTO             ELO  MOV',
      ...lines,
      '```',
      '',
      '▲ Sube  ▼ Baja  ━ Igual  ⏸ Sin participar'
    ].join('\n');

    const embed = new EmbedBuilder()
      .setColor(0xD71920)
      .setTitle(`🏆 RANKING ELO | ${weekName}`)
      .setDescription(description)
      .setFooter({
        text: 'REDLINE GT • Clasificación ELO'
      })
      .setTimestamp();

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
