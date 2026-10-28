import { Interaction } from 'discord.js';
import { handleAlarmaInteraction } from '../alarma/alarmaactions';
import { handleRetosInteraction } from './retos/retosactions';

const LCS_GUILD_ID = '1564967606295732304';

/**
 * Enrutador principal del menú. Deriva cada interacción a su submódulo correspondiente.
 */
export async function handleMenuInteraction(interaction: Interaction): Promise<boolean> {
    if (interaction.guildId !== LCS_GUILD_ID) return false;

    // 1. Manejar botones del panel principal del menú (lcs_menu_*)
    if (interaction.isButton() && interaction.customId.startsWith('lcs_menu_')) {
        const action = interaction.customId;

        if (action === 'lcs_menu_alarma') {
            // Delegar o responder al botón de alarma del menú
            return await handleAlarmaInteraction(interaction);
        }

        if (action === 'lcs_menu_refrescar') {
            await interaction.reply({ content: '🔄 ¡Menú actualizado correctamente!', ephemeral: true });
            return true;
        }

        // Si hay más botones de menú, se pueden añadir aquí
        return false;
    }

    // 2. Intentar manejar con el módulo de Alarmas (para modales, selects o botones internos)
    const handledAlarma = await handleAlarmaInteraction(interaction);
    if (handledAlarma) return true;

    // 3. Intentar manejar con el módulo de Retos
    const handledRetos = await handleRetosInteraction(interaction);
    if (handledRetos) return true;

    return false;
}
