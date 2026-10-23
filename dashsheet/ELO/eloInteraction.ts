import { Interaction, EmbedBuilder, ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';
import { getSheetData } from '../sheetsService';
import { procesarYActualizarEloGeneral } from './eloService';

export async function handleEloInteraction(interaction: Interaction): Promise<boolean> {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) {
        return false;
    }

    const customId = interaction.customId;

    if (!customId.includes('elo')) {
        return false;
    }

    if (customId === 'btn_refrescar_elo') {
        const componentInteraction = interaction as ButtonInteraction;
        await componentInteraction.deferUpdate();

        try {
            await procesarYActualizarEloGeneral();

            // Leer N2:P22 (N=Nombre, O=Mención, P=Elo)
            const sheetData = await getSheetData('PQ2!N2:P22') || [];

            const listaPilotos = sheetData
                .map(row => {
                    const nombre = row[0] ? row[0].toString().trim() : '';
                    const mencion = row[1] ? row[1].toString().trim() : '';
                    const elo = row[2] ? parseInt(row[2].toString(), 10) : 1200;
                    return {
                        display: mencion || nombre,
                        elo
                    };
                })
                .filter(p => p.display.length > 0 && !isNaN(p.elo))
                .sort((a, b) => b.elo - a.elo);

            const medallas = ['🥇', '🥈', '🥉'];
            const descripcion = listaPilotos.map((p, index) => {
                const pos = index + 1;
                const prefijo = pos <= 3 ? medallas[index] : `**#${pos}**`;
                return `${prefijo} ${p.display} — **${p.elo} ELO**`;
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
