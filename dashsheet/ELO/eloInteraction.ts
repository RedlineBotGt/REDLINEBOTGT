import { Interaction, EmbedBuilder, ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';
import { getSheetData } from '../sheetsService';
import { procesarYActualizarEloGeneral } from './eloService';

/**
 * Manejador principal para todas las interacciones de componentes (botones, menús)
 * pertenecientes al módulo de ELO.
 */
export async function handleEloInteraction(interaction: Interaction): Promise<boolean> {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) {
        return false;
    }

    const customId = interaction.customId;

    // Comprobamos si la interacción pertenece al módulo ELO
    if (!customId.includes('elo')) {
        return false;
    }

    // 1. Botón para refrescar manualmente el ELO
    if (customId === 'btn_refrescar_elo') {
        const componentInteraction = interaction as ButtonInteraction;
        await componentInteraction.deferUpdate();

        try {
            // Volver a procesar todas las sesiones
            await procesarYActualizarEloGeneral();

            // Leer la tabla actualizada desde PQ2
            const sheetData = await getSheetData('PQ2!N2:P22') || [];

            const listaPilotos = sheetData
                .map(row => ({
                    mencion: row[0] ? row[0].toString().trim() : '',
                    elo: row[2] ? parseInt(row[2].toString(), 10) : 1200
                }))
                .filter(p => p.mencion.length > 0 && !isNaN(p.elo))
                .sort((a, b) => b.elo - a.elo);

            const medallas = ['🥇', '🥈', '🥉'];
            const descripcion = listaPilotos.map((p, index) => {
                const pos = index + 1;
                const prefijo = pos <= 3 ? medallas[index] : `**#${pos}**`;
                return `${prefijo} ${p.mencion} — **${p.elo} ELO**`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setTitle('🏆 Clasificación General de Elo - Temporada 2')
                .setColor(0xF1C40F)
                .setDescription(descripcion)
                .setTimestamp()
                .setFooter({ text: 'REDLINE GT CUP • Actualizado en vivo' });

            await componentInteraction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error al refrescar la interacción de ELO:', error);
            await componentInteraction.followUp({ content: '❌ Error al intentar refrescar la tabla de ELO.', ephemeral: true });
        }

        return true;
    }

    return false;
}
