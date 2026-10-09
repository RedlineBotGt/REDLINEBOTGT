import { 
    handleDashEventButton, 
    handleEventChannelSelect, 
    handleEventRoleSelect, 
    handleEventProceedToModal, 
    handleEventModalSubmit, 
    handleEventPublishNowButton, 
    handleEventConfigRepeatButton, 
    handleEventRepeatModalSubmit, 
    handleEventRsvpButton,
    handleBdEventosButton,
    handleBdEventosSelect,
    handleBdEventosCancelAction
} from './eventosmanager';

/**
 * Enrutador local del submódulo de Eventos y Campeonatos.
 * Filtra la interacción y la delega al manejador correspondiente.
 */
export async function handleEventInteractions(interaction: any): Promise<boolean> {
    try {
        // --- 1. BOTONES ---
        if (interaction.isButton()) {
            if (await handleDashEventButton(interaction)) return true;
            if (await handleBdEventosButton(interaction)) return true;
            if (await handleBdEventosCancelAction(interaction)) return true; // ➔ Captura el botón de cancelar evento desde la BD
            if (await handleEventProceedToModal(interaction)) return true;
            if (await handleEventPublishNowButton(interaction)) return true;
            if (await handleEventConfigRepeatButton(interaction)) return true;
            if (await handleEventRsvpButton(interaction)) return true;
        }

        // --- 2. MODAL SUBMITS ---
        if (interaction.isModalSubmit()) {
            if (await handleEventModalSubmit(interaction)) return true;
            if (await handleEventRepeatModalSubmit(interaction)) return true;
        }

        // --- 3. CHANNEL SELECT MENUS ---
        if (interaction.isChannelSelectMenu()) {
            if (await handleEventChannelSelect(interaction)) return true;
        }

        // --- 4. ROLE SELECT MENUS ---
        if (interaction.isRoleSelectMenu()) {
            if (await handleEventRoleSelect(interaction)) return true;
        }

        // --- 5. STRING SELECT MENUS (Para el selector de la BD de eventos) ---
        if (interaction.isStringSelectMenu()) {
            if (await handleBdEventosSelect(interaction)) return true;
        }

        return false;
    } catch (error) {
        console.error('❌ Error en el enrutador de Eventos (interactioneventos):', error);
        return false;
    }
}
