import { 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder,
    MessageFlags 
} from 'discord.js';
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
            // Interceptar directamente el botón del panel de administración
            if (interaction.customId === 'dash_btn_sorteo_create') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_sorteo_create')
                    .setTitle('🎁 Crear Nuevo Sorteo');

                const inputTitulo = new TextInputBuilder()
                    .setCustomId('sorteo_titulo_input')
                    .setLabel('Premio o Título del Sorteo')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Ej: Acceso VIP, 100k Créditos...')
                    .setRequired(true);

                const inputGanadores = new TextInputBuilder()
                    .setCustomId('sorteo_ganadores_input')
                    .setLabel('Número de ganadores')
                    .setStyle(TextInputStyle.Short)
                    .setValue('1')
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(inputTitulo),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(inputGanadores)
                );

                await interaction.showModal(modal);
                return true;
            }

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
            if (interaction.customId === 'modal_sorteo_create') {
                const titulo = interaction.fields.getTextInputValue('sorteo_titulo_input');
                const ganadores = interaction.fields.getTextInputValue('sorteo_ganadores_input');
                
                await interaction.reply({
                    content: `✅ Sorteo configurado:\n> **Premio:** ${titulo}\n> **Ganadores:** ${ganadores}`,
                    flags: [MessageFlags.Ephemeral]
                });
                return true;
            }

            if (await handleSorteoModalSubmit(interaction)) return true;
        }

        return false;
    } catch (error) {
        console.error('❌ Error en el enrutador de Sorteos (interactionsorteo):', error);
        return false;
    }
}
