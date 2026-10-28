import { ButtonInteraction } from 'discord.js';

const LCS_GUILD_ID = '1564967606295732304';

/**
 * Manejador de clics para los botones del menú principal de LCS
 */
export async function handleMenuInteraction(interaction: ButtonInteraction) {
    if (interaction.guildId !== LCS_GUILD_ID) return;

    if (interaction.customId === 'lcs_menu_alarma') {
        await interaction.reply({ 
            content: '⏰ Módulo de gestión de alarmas desde el menú en desarrollo. ¡Pronto podrás configurarlas aquí mismo!', 
            ephemeral: true 
        });
    } 
    else if (interaction.customId === 'lcs_menu_refrescar') {
        await interaction.reply({ 
            content: '🔄 Panel actualizado correctamente.', 
            ephemeral: true 
        });
    }
}
