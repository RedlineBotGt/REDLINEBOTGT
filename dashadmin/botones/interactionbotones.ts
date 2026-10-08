import { 
    handleDashCrearBotonButton, 
    handleTicketModalSubmit, 
    handleTicketChannelSelect, 
    handleTicketButtonClick, 
    handleCloseTicketButton,
    activeTicketButtons
} from './botoneshandler';

/**
 * Enrutador local del submódulo de Botones Personalizados y Tickets.
 * Filtra la interacción y la delega al manejador correspondiente.
 */
export async function handleBotonesInteractions(interaction: any): Promise<boolean> {
    try {
        // --- 1. BOTONES ---
        if (interaction.isButton()) {
            // A. Botón del panel de administración (/dash) para crear un nuevo botón
            if (await handleDashCrearBotonButton(interaction)) return true;

            // B. Botón de cerrar ticket dentro del canal privado
            if (await handleCloseTicketButton(interaction)) return true;

            // C. Botones desplegados en los canales públicos (almacenados en memoria/MongoDB)
            if (activeTicketButtons.has(interaction.customId)) {
                if (await handleTicketButtonClick(interaction)) return true;
            }
        }

        // --- 2. CHANNEL SELECT MENUS ---
        if (interaction.isChannelSelectMenu()) {
            if (await handleTicketChannelSelect(interaction)) return true;
        }

        // --- 3. MODAL SUBMITS ---
        if (interaction.isModalSubmit()) {
            if (await handleTicketModalSubmit(interaction)) return true;
        }

        return false;
    } catch (error) {
        console.error('❌ Error en el enrutador de Botones (interactionbotones):', error);
        return false;
    }
}
