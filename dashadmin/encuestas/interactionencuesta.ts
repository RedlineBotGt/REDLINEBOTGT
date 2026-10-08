import { 
    handleEncuestaStart, 
    handleEncuestaPreSelections, 
    handleEncuestaOpenModalButton, 
    handleEncuestaFinalSubmit 
} from './encuestasmanager';

/**
 * Enrutador local del submódulo de Encuestas.
 */
export async function handleEncuestaInteractions(interaction: any): Promise<boolean> {
    try {
        // 1. Botón inicial del panel para crear encuesta
        if (interaction.isButton() && interaction.customId === 'dash_btn_encuesta_create') {
            return await handleEncuestaStart(interaction);
        }

        // 2. Menús desplegables previos (canales, duración, etc.)
        if (
            (interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu() || interaction.isStringSelectMenu()) &&
            ['encuesta_pre_publish_channel', 'encuesta_pre_role', 'encuesta_pre_log_channel', 'encuesta_pre_aviso_channel', 'encuesta_pre_duration'].includes(interaction.customId)
        ) {
            return await handleEncuestaPreSelections(interaction);
        }

        // 3. Botón para abrir el formulario modal final
        if (interaction.isButton() && interaction.customId === 'encuesta_btn_open_modal') {
            return await handleEncuestaOpenModalButton(interaction);
        }

        // 4. Envío del modal con los datos de la encuesta
        if (interaction.isModalSubmit() && interaction.customId === 'modal_encuesta_final') {
            return await handleEncuestaFinalSubmit(interaction);
        }

        return false;
    } catch (error) {
        console.error('❌ Error en el enrutador de Encuestas (interactionencuesta):', error);
        return false;
    }
}
