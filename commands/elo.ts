import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getSheetData } from '../dashsheet/sheetsService';
import { procesarYActualizarEloGeneral } from '../dashsheet/ELO/eloService';

export const data = new SlashCommandBuilder()
    .setName('elo')
    .setDescription('Muestra la clasificación actual de Elo de los pilotos.');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // 1. Diferir la respuesta para dar tiempo a procesar los datos de Google Sheets
    await interaction.deferReply();

    try {
        // 2. Ejecutar el recálculo acumulado por si hay nuevos datos en Ingreso2
        await procesarYActualizarEloGeneral();

        // 3. Leer la lista de pilotos (Mención) y Elo actualizado desde PQ2 (N2:P22)
        // Columna N: Mención de Discord (<@ID>)
        // Columna P: Elo recalculado
        const sheetData = await getSheetData('PQ2!N2:P22') || [];

        if (sheetData.length === 0) {
            await interaction.editReply('❌ No se encontraron datos de Elo en la hoja PQ2.');
            return;
        }

        // 4. Mapear y filtrar filas válidas
        const listaPilotos = sheetData
            .map(row => {
                const mencion = row[0] ? row[0].toString().trim() : '';
                const elo = row[2] ? parseInt(row[2].toString(), 10) : 1200;
                return { mencion, elo };
            })
            .filter(item => item.mencion.length > 0 && !isNaN(item.elo));

        // 5. Ordenar de mayor a menor Elo
        listaPilotos.sort((a, b) => b.elo - a.elo);

        if (listaPilotos.length === 0) {
            await interaction.editReply('⚠️ No hay pilotos registrados con Elo válido.');
            return;
        }

        // 6. Construir el mensaje / Embed
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
            .setFooter({ text: 'REDLINE GT CUP • Actualizado tras última sesión' });

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error al ejecutar el comando /elo:', error);
        await interaction.editReply('❌ Hubo un error al procesar la clasificación de Elo.');
    }
}
