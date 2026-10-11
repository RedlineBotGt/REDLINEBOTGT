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
    handleBdEventosCancelAction,
    handleEventAdminManageButton,
    handleEventAdminConfirmButton,
    handleEventAdminUserSelect,
    handleEventAdminStatusSelect
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
            if (await handleBdEventosCancelAction(interaction)) return true;
            if (await handleEventAdminManageButton(interaction)) return true; // ➔ Abre el panel de administración efímero
            if (await handleEventAdminConfirmButton(interaction)) return true; // ➔ Confirma los cambios de asistencia del admin
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

        // --- 5. USER SELECT MENUS (Para seleccionar al piloto desde el servidor) ---
        if (interaction.isUserSelectMenu()) {
            if (await handleEventAdminUserSelect(interaction)) return true;
        }

        // --- 6. STRING SELECT MENUS (BD de eventos y selección de estado) ---
        if (interaction.isStringSelectMenu()) {
            if (await handleBdEventosSelect(interaction)) return true;
            if (await handleEventAdminStatusSelect(interaction)) return true;
        }

        return false;
    } catch (error) {
        console.error('❌ Error en el enrutador de Eventos (interactioneventos):', error);
        return false;
    }
}
