import { StringSelectMenuInteraction, MessageFlags } from 'discord.js';
import { updateSheetData } from '../sheetsService'; 

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

    const esCarrera = sesion.startsWith('C');
    const baseJornada = (numJornada - 1) * 40;
    const filaInicio = esCarrera ? 22 + baseJornada : 2 + baseJornada;
    const filaFin = filaInicio + 15;

    try {
        const rangoSesion = `Ingreso2!A${filaInicio}:A${filaFin}`;
        const rangoDatos = `Ingreso2!B${filaInicio}:E${filaFin}`;

        // TODO: Inyectar aquí los valores extraídos por el OCR formateados en matrices bidimensionales.
        // await updateSheetData(rangoSesion, [[sesion], [sesion], ...]);
        // await updateSheetData(rangoDatos, [[pos, piloto, tiempo, vr], ...]);

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
