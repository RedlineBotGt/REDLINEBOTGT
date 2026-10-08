import { Interaction } from 'discord.js';
import { 
    handleDashSheetsButton, 
    handleSheetsChannelSelect, 
    handleSheetsRoleSelect 
} from './dashSheetHandler';

/**
 * Módulo de Interacciones del Panel de Google Sheets
 */
export async function handleSheetsInteraction(interaction: Interaction): Promise<boolean> {
    try {
        // Manejo de botones (Panel de Sheets y Publicación)
        if (interaction.isButton()) {
            const customId = interaction.customId;
            if (customId.startsWith('sheets_') || customId === 'pub_yes' || customId === 'pub_no') {
                await handleDashSheetsButton(interaction);
                return true;
            }
        }

        // Manejo del menú desplegable de canales
        if (interaction.isChannelSelectMenu()) {
            if (interaction.customId === 'sheets_select_channel') {
                await handleSheetsChannelSelect(interaction);
                return true;
            }
        }

        // Manejo del menú desplegable de roles
        if (interaction.isRoleSelectMenu()) {
            if (interaction.customId === 'sheets_select_role') {
                await handleSheetsRoleSelect(interaction);
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error('❌ Error en el módulo sheetsInteraction:', error);
        return false;
    }
}
