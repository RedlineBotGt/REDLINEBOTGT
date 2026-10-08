import { Interaction } from 'discord.js';
import { handleDashReporteButton } from './reportewizard';
import { handleReportButton, handleReportModalSubmit } from './reportemodal';

/**
 * Enrutador de interacciones específico para el submódulo de Reportes.
 * Se encarga de capturar las acciones del asistente de configuración, 
 * el botón público de reporte y el envío del modal correspondiente.
 */
export async function handleReporteInteractions(interaction: Interaction): Promise<boolean> {
    try {
        // 1. Lanzar el asistente de configuración (Wizard de 4 pasos) desde el Dash
        if (interaction.isButton() && interaction.customId === 'dash_btn_setup_reporte') {
            const handled = await handleDashReporteButton(interaction);
            if (handled) return true;
        }

        // 2. Mostrar el modal de reporte al pulsar el botón público en el canal
        if (interaction.isButton() && interaction.customId === 'btn_abrir_reporte') {
            const handled = await handleReportButton(interaction);
            if (handled) return true;
        }

        // 3. Procesar el formulario enviado a través del modal y ejecutar la salida dual
        if (interaction.isModalSubmit() && interaction.customId === 'modal_envio_reporte') {
            const handled = await handleReportModalSubmit(interaction);
            if (handled) return true;
        }

        return false; // La interacción no pertenece al submódulo de reportes
    } catch (error) {
        console.error('❌ Error en el enrutador de interacciones de reportes:', error);
        return false;
    }
}
