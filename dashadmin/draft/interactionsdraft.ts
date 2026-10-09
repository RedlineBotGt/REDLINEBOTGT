// Dashadmin/draft/interactiondraft.ts
import { Interaction } from 'discord.js';
import { 
    handleDraftChannelSelect, 
    handleDraftOpenModalButton, 
    handleDraftModalSubmit 
} from './draftactions';

/**
 * Enrutador local del submódulo de Draft
 */
export async function handleDraftInteractions(interaction: Interaction): Promise<boolean> {
    try {
        // 1. Selección del canal público desde el comando /draft
        if (interaction.isChannelSelectMenu() && interaction.customId === 'draft_select_channel') {
            return await handleDraftChannelSelect(interaction);
        }

        // 2. Botón para abrir el modal de selección de coche
        if (interaction.isButton() && interaction.customId === 'draft_open_modal') {
            return await handleDraftOpenModalButton(interaction);
        }

        // 3. Envío del formulario modal con el número de modelo elegido
        if (interaction.isModalSubmit() && interaction.customId === 'draft_modal_submit') {
            return await handleDraftModalSubmit(interaction);
        }

        return false;
    } catch (error) {
        console.error('❌ Error en el enrutador de Draft:', error);
        return false;
    }
}
