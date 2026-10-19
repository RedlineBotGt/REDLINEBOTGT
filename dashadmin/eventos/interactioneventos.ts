import { Interaction } from 'discord.js';

// --- IMPORTACIÓN DE MÓDULOS ESPECIALIZADOS ---
import { 
    handleDashEventButton,
    handleEventChannelSelect,
    handleEventRoleSelect,
    handleEventProceedToModal,
    handleEventModalSubmit,
    handleEventPublishNowButton,
    handleEventConfigRepeatButton,
    handleEventRepeatModalSubmit
} from './eventoscreate';

import { 
    handleBdEventosButton,
    handleBdEventosSelect,
    handleBdEventosCancelAction,
    handleBdEventosEditButton,
    handleBdEventosEditModalSubmit
} from './eventosdb';

import { 
    handleEventAdminManageButton,
    handleEventAdminUserSelect,
    handleEventAdminStatusSelect,
    handleEventAdminConfirmButton,
    handleEventRsvpButton
} from './eventosrsvp';

/**
 * Enrutador principal de interacciones para el sistema de eventos.
 * Redirige cada botón, modal o menú desplegable a su módulo especializado.
 */
export async function handleEventInteractions(interaction: Interaction): Promise<boolean> {
    try {
        // -------------------------------------------------------------
        // 1. MANEJO DE BOTONES (ButtonInteraction)
        // -------------------------------------------------------------
        if (interaction.isButton()) {
            // Módulo de Creación
            if (await handleDashEventButton(interaction)) return true;
            if (await handleEventProceedToModal(interaction)) return true;
            if (await handleEventPublishNowButton(interaction)) return true;
            if (await handleEventConfigRepeatButton(interaction)) return true;

            // Módulo de Base de Datos
            if (await handleBdEventosButton(interaction)) return true;
            if (await handleBdEventosCancelAction(interaction)) return true;
            if (await handleBdEventosEditButton(interaction)) return true;

            // Módulo de RSVP y Gestión Admin de Pilotos
            if (await handleEventAdminManageButton(interaction)) return true;
            if (await handleEventAdminConfirmButton(interaction)) return true;
            if (await handleEventRsvpButton(interaction)) return true;
        }

        // -------------------------------------------------------------
        // 2. MANEJO DE MENÚS DESPLEGABLES (SelectMenuInteraction)
        // -------------------------------------------------------------
        if (interaction.isChannelSelectMenu()) {
            if (await handleEventChannelSelect(interaction)) return true;
        }

        if (interaction.isRoleSelectMenu()) {
            if (await handleEventRoleSelect(interaction)) return true;
        }

        if (interaction.isUserSelectMenu()) {
            if (await handleEventAdminUserSelect(interaction)) return true;
        }

        if (interaction.isStringSelectMenu()) {
            if (await handleBdEventosSelect(interaction)) return true;
            if (await handleEventAdminStatusSelect(interaction)) return true;
        }

        // -------------------------------------------------------------
        // 3. MANEJO DE MODALES (ModalSubmitInteraction)
        // -------------------------------------------------------------
        if (interaction.isModalSubmit()) {
            if (await handleEventModalSubmit(interaction)) return true;
            if (await handleEventRepeatModalSubmit(interaction)) return true;
            if (await handleBdEventosEditModalSubmit(interaction)) return true;
        }

    } catch (error) {
        console.error('❌ Error en el enrutador interactioneventos:', error);
    }

    return false;
}
