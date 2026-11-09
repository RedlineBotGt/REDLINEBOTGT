import { Interaction } from 'discord.js';
import { handleDashDefensaButton } from './defensewizard';
import { handleDefensaButton, handleDefensaModalSubmit, handleDefensaContinueButton, handleDefensaFilesModalSubmit } from './defensemodal';

/**
 * Enrutador de interacciones específico para el submódulo de Defensas.
 * Se encarga de capturar las acciones del asistente de configuración de defensas, 
 * el botón público de defensa y el envío del modal correspondiente.
 */
export async function handleDefensaInteractions(interaction: Interaction): Promise<boolean> {
    try {
        // 1. Lanzar el asistente de configuración de defensas (Wizard de 4 pasos) desde el Dash
        if (interaction.isButton() && interaction.customId === 'dash_btn_setup_defensa') {
            const handled = await handleDashDefensaButton(interaction);
            if (handled) return true;
        }

        // 2. Mostrar el modal de defensa al pulsar el botón público en el canal
        if (interaction.isButton() && interaction.customId === 'btn_abrir_defensa') {
            const handled = await handleDefensaButton(interaction);
            if (handled) return true;
        }

        // 3. Paso informativo para adjuntar las pruebas
        if (interaction.isButton() && interaction.customId.startsWith('defense_continue_')) {
            const handled = await handleDefensaContinueButton(interaction);
            if (handled) return true;
        }

        // 4. Procesar el formulario principal y el formulario de pruebas
        if (interaction.isModalSubmit() && interaction.customId === 'modal_envio_defensa') {
            const handled = await handleDefensaModalSubmit(interaction);
            if (handled) return true;
        }
        if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_defensa_archivos_')) {
            const handled = await handleDefensaFilesModalSubmit(interaction);
            if (handled) return true;
        }

        return false; // La interacción no pertenece al submódulo de defensas
    } catch (error) {
        console.error('❌ Error en el enrutador de interacciones de defensas:', error);
        return false;
    }
}
