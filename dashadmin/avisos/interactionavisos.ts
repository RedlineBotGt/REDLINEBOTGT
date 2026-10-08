import { handleDashAvisosButton, handleAvisosChannelSelect } from './avisosmanager';

/**
 * Enrutador local del submódulo de Avisos y Logs.
 * Filtra la interacción y la delega al manejador correspondiente.
 */
export async function handleAvisosInteractions(interaction: any): Promise<boolean> {
    try {
        // --- 1. BOTONES ---
        if (interaction.isButton()) {
            if (await handleDashAvisosButton(interaction)) return true;
        }

        // --- 2. CHANNEL SELECT MENUS ---
        if (interaction.isChannelSelectMenu()) {
            if (await handleAvisosChannelSelect(interaction)) return true;
        }

        return false;
    } catch (error) {
        console.error('❌ Error en el enrutador de Avisos (interactionavisos):', error);
        return false;
    }
}
