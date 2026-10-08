import { 
    handleDashWelcomeButton, 
    handleWelcomeMenuButton, 
    handleWelcomeChannelSelect, 
    handleGoodbyeChannelSelect, 
    handleWelcomeModalSubmit, 
    handleGoodbyeModalSubmit 
} from './welcomemanager';

/**
 * Enrutador local del submódulo de Bienvenidas y Despedidas.
 * Filtra la interacción y la delega al manejador correspondiente.
 */
export async function handleWelcomeInteractions(interaction: any): Promise<boolean> {
    try {
        // --- 1. BOTONES ---
        if (interaction.isButton()) {
            if (await handleDashWelcomeButton(interaction)) return true;
            if (await handleWelcomeMenuButton(interaction)) return true;
        }

        // --- 2. CHANNEL SELECT MENUS ---
        if (interaction.isChannelSelectMenu()) {
            if (await handleWelcomeChannelSelect(interaction)) return true;
            if (await handleGoodbyeChannelSelect(interaction)) return true;
        }

        // --- 3. MODAL SUBMITS ---
        if (interaction.isModalSubmit()) {
            if (await handleWelcomeModalSubmit(interaction)) return true;
            if (await handleGoodbyeModalSubmit(interaction)) return true;
        }

        return false;
    } catch (error) {
        console.error('❌ Error en el enrutador de Bienvenidas (interactionwelcome):', error);
        return false;
    }
}
