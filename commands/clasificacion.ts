import {
    ChatInputCommandInteraction,
    SlashCommandBuilder
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

        // Tabla monoespaciada en mensaje normal para aprovechar todo el ancho disponible.
        // Se mantienen las columnas separadas y se ocultan los contadores con valor cero.
        const pad = (value: string, width: number) => value.length > width
            ? value.slice(0, width - 1) + '…'
            : value.padEnd(width, ' ');

        const lines = pilots.map((pilot, index) => {
            const position = pilot.position || String(index + 1);
            const name = pad(pilot.pilot, 18);
            const points = pad(pilot.points, 5);
            const vr = pad(Number(pilot.vr) > 0 ? `🟣 ${pilot.vr}` : '', 7);
            const pp = pad(Number(pilot.pp) > 0 ? `🟡 ${pilot.pp}` : '', 7);
            const sanctions = Number(pilot.sanctions) > 0 ? `🔴 ${pilot.sanctions}` : '';

            return `${pad(position, 3)}  ${name}  ${points}  ${vr}  ${pp}  ${sanctions}`.trimEnd();
        });

        const message = [
            '**REDLINE GTCUP · 2ª Temporada**',
            '',
            '```',
            ...lines,
            '```'
        ].join('\\n');

        await interaction.editReply(message);
    } catch (error) {
        console.error('❌ Error al cargar /clasificacion:', error);
        await interaction.editReply('No se ha podido cargar la clasificación. Inténtalo de nuevo más tarde.');
    }
}
