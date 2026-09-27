import { Interaction } from 'discord.js';
import * as dash from '../commands/dash';
import * as reporte from '../commands/reporte';
import { handleReportButton, handleReportModalSubmit } from './reportModal'; // Asegúrate de que la ruta sea correcta según donde guardes el archivo del modal

export async function handleInteraction(interaction: Interaction) {
    try {
        // 1. Manejo de Comandos de Barra (Slash Commands)
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'dash') {
                await dash.execute(interaction);
            } else if (interaction.commandName === 'setup-reporte') {
                await reporte.execute(interaction);
            }
            return;
        }

        // 2. Manejo de Botones interactivos
        if (interaction.isButton()) {
            if (interaction.customId === 'btn_abrir_reporte') {
                // Lanzamos el formulario Modal de 5 campos
                const handled = await handleReportButton(interaction);
                if (handled) return;
            }
            return;
        }

        // 3. Manejo de Envíos de Formularios (Modals)
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'modal_envio_reporte') {
                // Capturamos los datos del formulario y el ID generado
                const reportData = await handleReportModalSubmit(interaction);
                
                if (reportData) {
                    // AQUÍ IMPLEMENTAREMOS EL PASO 4 (Salida Dual, Canales, Menciones e Hilos)
                    // De momento, ya tenemos todos los datos empaquetados en 'reportData':
                    // reportData.reportId, reportData.jornada, reportData.pilotoReporta, 
                    // reportData.pilotoAReportar, reportData.descripcion, reportData.enlace
                }
            }
            return;
        }

    } catch (error) {
        console.error('❌ Error al procesar la interacción:', error);
        if (interaction.isRepliable()) {
            const errorMessage = {
                content: 'Hubo un error al procesar esta acción.',
                ephemeral: true
            };
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    }
}
