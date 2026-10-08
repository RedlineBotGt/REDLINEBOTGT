import { Interaction } from 'discord.js';
import { 
    handleDashVeredictoButton, 
    handleDashVeredictoChannelSelect, 
    handleDashVeredictoRoleSelect 
} from './veredictowizard';
import { handleVeredictoModalSubmit } from './veredictomodal';

/**
 * Enrutador de interacciones específico para el submódulo de Veredictos.
 * Se encarga de capturar las acciones del botón del dash, los selectores de canal y rol, 
 * y el envío del modal de veredicto oficial.
 */
export async function handleVeredictoInteractions(interaction: Interaction): Promise<boolean> {
    try {
        // 1. Botón de inicio del veredicto desde el Dash
        if (interaction.isButton() && interaction.customId === 'dash_btn_veredicto') {
            return await handleDashVeredictoButton(interaction);
        }

        // 2. Menús desplegables de canal y rol para el veredicto
        if (interaction.isChannelSelectMenu() && interaction.customId === 'dash_select_verd_channel') {
            return await handleDashVeredictoChannelSelect(interaction);
        }
        if (interaction.isRoleSelectMenu() && interaction.customId === 'dash_select_verd_role') {
            return await handleDashVeredictoRoleSelect(interaction);
        }

        // 3. Envío del formulario a través del modal de veredictos
        if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_veredicto_')) {
            return await handleVeredictoModalSubmit(interaction);
        }

        return false; // La interacción no pertenece al submódulo de veredictos
    } catch (error) {
        console.error('❌ Error en el enrutador de interacciones de veredictos:', error);
        return false;
    }
}
