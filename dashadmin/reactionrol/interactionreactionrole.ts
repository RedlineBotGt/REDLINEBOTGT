import { 
    handleDashRrButton, 
    handleRrStartCreate, 
    handleRrManage, 
    handleRrChannelSelect, 
    handleRrRoleSelect, 
    handleRrContentSubmit, 
    handleRrExistingSelect,
    handleRrRoleAction // ➔ Importado desde reactionmanager
} from './reactionmanager';

/**
 * Enrutador local del submódulo de Reaction Roles.
 * Filtra la interacción según su tipo y la delega al manejador correspondiente.
 */
export async function handleReactionRoleInteractions(interaction: any): Promise<boolean> {
    try {
        // --- 1. BOTONES ---
        if (interaction.isButton()) {
            if (await handleDashRrButton(interaction)) return true;
            if (await handleRrStartCreate(interaction)) return true;
            if (await handleRrManage(interaction)) return true;
            if (await handleRrRoleAction(interaction)) return true; // ➔ Captura y gestiona la entrega/retirada de roles
        }

        // --- 2. STRING SELECT MENUS ---
        if (interaction.isStringSelectMenu()) {
            if (await handleRrExistingSelect(interaction)) return true;
        }

        // --- 3. CHANNEL SELECT MENUS ---
        if (interaction.isChannelSelectMenu()) {
            if (await handleRrChannelSelect(interaction)) return true;
        }

        // --- 4. ROLE SELECT MENUS ---
        if (interaction.isRoleSelectMenu()) {
            if (await handleRrRoleSelect(interaction)) return true;
        }

        // --- 5. MODAL SUBMITS ---
        if (interaction.isModalSubmit()) {
            if (await handleRrContentSubmit(interaction)) return true;
        }

        return false;
    } catch (error) {
        console.error('❌ Error en el enrutador de Reaction Roles (interactionreactionrole):', error);
        return false;
    }
}
