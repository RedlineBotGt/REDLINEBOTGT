import { 
    handleDashSorteoButton, 
    handleSorteoModalSubmit, 
    handleSorteoChannelSelect, 
    handleSorteoRoleSelect 
} from './sorteomanager';
import { handleSorteoLaunchButton } from './sorteoactions';

/**
 * Enrutador local del submódulo de Sorteos.
 * Filtra la interacción según su tipo y la delega al manejador correspondiente.
 */
export async function handleSorteoInteractions(interaction: any): Promise<boolean> {
    try {
        // --- 1. BOTONES ---
        if (interaction.isButton()) {
            if (await handleDashSorteoButton(interaction)) return true;
            if (await handleSorteoLaunchButton(interaction)) return true;
        }

        // --- 2. CHANNEL SELECT MENUS ---
        if (interaction.isChannelSelectMenu()) {
            if (await handleSorteoChannelSelect(interaction)) return true;
        }

        // --- 3. ROLE SELECT MENUS ---
        if (interaction.isRoleSelectMenu()) {
            if (await handleSorteoRoleSelect(interaction)) return true;
        }

        // --- 4. MODAL SUBMITS ---
        if (interaction.isModalSubmit()) {
            if (await handleSorteoModalSubmit(interaction)) return true;
        }

        return false;
    } catch (error) {
        console.error('❌ Error en el enrutador de Sorteos (interactionsorteo):', error);
        return false;
    }
}
