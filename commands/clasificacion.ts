import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder
} from 'discord.js';
import { getSheetData } from '../utils/sheetsService';

export const data = new SlashCommandBuilder()
    .setName('clasificacion')
    .setDescription('Muestra la clasificación general de REDLINE GT');

const numberOrZero = (value: unknown): string => {
    const text = String(value ?? '').trim();
    return text || '0';
};

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
        await interaction.reply({
            content: 'Este comando solo puede usarse en un servidor.',
            ephemeral: true
        });
        return;
    }

    await interaction.deferReply();

    try {
        // Tabla2: B=posición, C=piloto, K=PP, L=VR, M=sanciones, N=puntos.
        const rawData = (await getSheetData('Tabla2!B8:N')) || [];

        const pilots = rawData
            .filter(row =>
                row &&
                String(row[0] ?? '').trim() !== '' &&
                String(row[0]).trim().toUpperCase() !== 'POS' &&
                String(row[1] ?? '').trim() !== ''
            )
            .map(row => ({
                position: String(row[0]).trim(),
                pilot: String(row[1]).trim(),
                pp: numberOrZero(row[9]),
                vr: numberOrZero(row[10]),
                sanctions: numberOrZero(row[11]),
                points: numberOrZero(row[12])
            }));

        if (pilots.length === 0) {
            await interaction.editReply('No hay datos de clasificación disponibles.');
            return;
        }

        // Tabla monoespaciada: las columnas se mantienen alineadas en Discord.
        // Se limita el nombre para evitar que una fila ensanche demasiado el bloque en móvil.
        const columnWidth = 18;
        const lines = [
            `${'POS'.padEnd(4)}${'PILOTO'.padEnd(columnWidth + 1)}${'PTS'.padStart(5)}  ${'VR'.padStart(2)}  ${'PP'.padStart(2)}  ${'SAN'.padStart(3)}`,
            ...pilots.map((pilot, index) => {
                const position = pilot.position || String(index + 1);
                const medal = position === '1' ? '🥇' : position === '2' ? '🥈' : position === '3' ? '🥉' : `${position}.`;
                const pilotName = pilot.pilot.length > columnWidth
                    ? `${pilot.pilot.slice(0, columnWidth - 1)}…`
                    : pilot.pilot;

                return `${medal.padEnd(4)}${pilotName.padEnd(columnWidth + 1)}${pilot.points.padStart(5)}  ${pilot.vr.padStart(2)}  ${pilot.pp.padStart(2)}  ${pilot.sanctions.padStart(3)}`;
            })
        ];

        const embed = new EmbedBuilder()
            .setColor(0x7027C8)
            .setAuthor({
                name: 'REDLINE BOT GT',
                iconURL: interaction.guild.iconURL({ dynamic: true }) || undefined
            })
            .setTitle('🏆 Clasificación General')
            .setDescription(
                '**REDLINE GTCUP · 2ª Temporada**\n\n' +
                '```text\n' + lines.join('\n') + '\n```'
            )
            .setFooter({ text: 'REDLINE GT · Clasificación' });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('❌ Error al cargar /clasificacion:', error);
        await interaction.editReply('No se ha podido cargar la clasificación. Inténtalo de nuevo más tarde.');
    }
}
