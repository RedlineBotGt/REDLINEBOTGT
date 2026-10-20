import { StringSelectMenuInteraction, MessageFlags } from 'discord.js';
import { updateSheetData } from '../sheetsService'; 
import { pendingIngresoCache } from './octservice';

export async function handleIngresoJornadaSelect(interaction: StringSelectMenuInteraction) {
    if (!interaction.guild) return;

    if (!interaction.deferred && !interaction.replied) {
        try {
            await interaction.deferUpdate();
        } catch (err) {
            console.error('❌ Error al diferir la interacción de ingreso:', err);
            return;
        }
    }

    const customId = interaction.customId;
    const parts = customId.split('_');
    const sesion = parts[3] ? parts[3].toUpperCase() : 'Q1';
    const numJornada = parseInt(interaction.values[0], 10);

    if (isNaN(numJornada)) {
        return interaction.followUp({
            content: '❌ Error al identificar la jornada seleccionada.',
            flags: [MessageFlags.Ephemeral]
        });
    }

    // 🔍 Recuperar los datos de la caché
    const cacheKey = `${interaction.user.id}_${sesion}`;
    const parsedResults = pendingIngresoCache.get(cacheKey);

    if (!parsedResults || parsedResults.length === 0) {
        return interaction.editReply({
            content: '❌ Los datos de esta sesión han expirado o no se encuentran. Por favor, vuelve a ejecutar `/ingreso`.',
            embeds: [],
            components: []
        });
    }

    const esCarrera = sesion.startsWith('C');
    const baseJornada = (numJornada - 1) * 40;
    const filaInicio = esCarrera ? 22 + baseJornada : 2 + baseJornada;
    const filaFin = filaInicio + parsedResults.length - 1; // Rango exacto según filas detectadas

    try {
        const rangoSesion = `Ingreso2!A${filaInicio}:A${filaInicio + parsedResults.length - 1}`;
        const rangoDatos = `Ingreso2!B${filaInicio}:E${filaInicio + parsedResults.length - 1}`;

        // Formatear matrices bidimensionales para Google Sheets
        const sesionesValues = parsedResults.map(() => [sesion]);
        const datosValues = parsedResults.map(r => [
            r.position, 
            r.pilot, 
            r.totalTime, 
            r.bestLap
        ]);

        // 📝 Escritura real en Google Sheets
        await updateSheetData(rangoSesion, sesionesValues);
        await updateSheetData(rangoDatos, datosValues);

        // Limpiar caché tras el éxito
        pendingIngresoCache.delete(cacheKey);

        await interaction.editReply({
            content: `✅ ¡Datos de la sesión **${sesion}** guardados correctamente en **Ingreso2!A${filaInicio}:E${filaFin}** (Jornada ${numJornada})!`,
            embeds: [],
            components: []
        });

    } catch (error) {
        console.error('❌ Error al escribir los datos de ingreso en Google Sheets:', error);
        await interaction.editReply({
            content: '❌ Ocurrió un error al actualizar la hoja de cálculo.',
            embeds: [],
            components: []
        });
    }
}
