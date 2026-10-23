import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getSheetData } from '../dashsheet/sheetsService';
import { procesarYActualizarEloGeneral } from '../dashsheet/ELO/eloService';

export const data = new SlashCommandBuilder()
    .setName('elo')
    .setDescription('Muestra la clasificación actual de Elo de los pilotos.');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    try {
        // 1. Recalcular Elo con los datos actuales de Ingreso2
        await procesarYActualizarEloGeneral();

        // 2. Leer N2:P22 (N=Nombre, O=Mención, P=Elo)
        const sheetData = await getSheetData('PQ2!N2:P22') || [];

        if (sheetData.length === 0) {
            await interaction.editReply('❌ No se encontraron datos de Elo en la hoja PQ2.');
            return;
        }

        // 3. Mapear datos respetando que O es la mención y P es el Elo
        const listaPilotos = sheetData
            .map(row => {
                const nombre = row[0] ? row[0].toString().trim() : '';
                const mencion = row[1] ? row[1].toString().trim() : ''; // Columna O: Mención
                const elo = row[2] ? parseInt(row[2].toString(), 10) : 1200; // Columna P: Elo
                return {
                    display: mencion || nombre, // Usa la mención de Discord si existe, si no el nombre
                    elo
                };
            })
            .filter(item => item.display.length > 0 && !isNaN(item.elo));

        // 4. Ordenar de mayor a menor Elo
        listaPilotos.sort((a, b) => b.elo - a.elo);

        if (listaPilotos.length === 0) {
            await interaction.editReply('⚠️ No hay pilotos registrados con Elo válido.');
            return;
        }

        // 5. Construir embed
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

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error al ejecutar el comando /elo:', error);
        await interaction.editReply('❌ Hubo un error al procesar la clasificación de Elo.');
    }
}
