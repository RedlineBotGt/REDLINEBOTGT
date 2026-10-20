import { StringSelectMenuInteraction, MessageFlags } from 'discord.js';
// Ajusta la ruta relativa hacia tu servicio de hojas según la estructura de tu proyecto
import { updateSheetData } from '../../sheetsService'; 

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

    const customId = interaction.customId; // Formato esperado: ingreso_select_jornada_Q1
    const parts = customId.split('_');
    const sesion = parts[3] ? parts[3].toUpperCase() : 'Q1';
    const numJornada = parseInt(interaction.values[0], 10);

    if (isNaN(numJornada)) {
        return interaction.followUp({
            content: '❌ Error al identificar la jornada seleccionada.',
            flags: [MessageFlags.Ephemeral]
        });
    }

    // Calcular fila de inicio según la regla:
    // Q (Qualy): Filas 2 a 17 (+40 por jornada)
    // C (Carrera): Filas 22 a 37 (+40 por jornada)
    const esCarrera = sesion.startsWith('C');
    const baseJornada = (numJornada - 1) * 40;
    const filaInicio = esCarrera ? 22 + baseJornada : 2 + baseJornada;
    const filaFin = filaInicio + 15; // Bloque de 16 filas

    try {
        // Rangos destino en Ingreso2:
        // Columna A: Código de sesión (ej. Q1, C1)
        // Columnas B a E: Posición, Piloto, Tiempo Total, Mejor Vuelta
        const rangoSesion = `Ingreso2!A${filaInicio}:A${filaFin}`;
        const rangoDatos = `Ingreso2!B${filaInicio}:E${filaFin}`;

        // TODO: Aquí inyectas los valores extraídos por el OCR formateados en matrices bidimensionales.
        // Ejemplo: await updateSheetData(rangoSesion, [[sesion], [sesion], ...]);
        // Ejemplo: await updateSheetData(rangoDatos, [[pos, piloto, tiempo, vr], ...]);

        await interaction.editReply({
            content: `✅ ¡Datos de la sesión **${sesion}** guardados correctamente en **Ingreso2!${filaInicio}:${filaFin}** (Jornada ${numJornada})!`,
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
