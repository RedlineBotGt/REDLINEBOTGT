import { Interaction } from 'discord.js';
import { handleDashReporteButton } from './reportewizard';
import {
    handleReportButton,
    handleReportModalSubmit,
    handleReportContinueButton,
    handleReportFilesModalSubmit
} from './reportemodal';

/**
 * Enrutador de interacciones específico para el submódulo de Reportes.
 */
export async function handleReporteInteractions(interaction: Interaction): Promise<boolean> {
    try {
        if (interaction.isButton() && interaction.customId === 'dash_btn_setup_reporte') {
            return await handleDashReporteButton(interaction);
        }

        if (interaction.isButton() && interaction.customId === 'btn_abrir_reporte') {
            return await handleReportButton(interaction);
        }

        if (interaction.isButton() && interaction.customId.startsWith('report_continue_')) {
            return await handleReportContinueButton(interaction);
        }

        if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_reporte_archivos_')) {
            return await handleReportFilesModalSubmit(interaction);
        }

        if (interaction.isModalSubmit() && interaction.customId === 'modal_envio_reporte') {
            return await handleReportModalSubmit(interaction);
        }

        return false;
    } catch (error) {
        console.error('❌ Error en el enrutador de interacciones de reportes:', error);
        return false;
    }
}
