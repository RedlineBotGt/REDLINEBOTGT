import { Interaction } from 'discord.js';
import { handleAlarmaInteraction } from '../alarma/alarmaactions';
import { handleRetosInteraction } from './retos/retosactions';

const LCS_GUILD_ID = '1564967606295732304';

/**
 * Enrutador principal del menú.
 */
export async function handleMenuInteraction(interaction: Interaction): Promise<boolean> {
    if (interaction.guildId !== LCS_GUILD_ID) return false;

    if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) {
        return false;
    }

    const customId = interaction.customId;
    console.log(`🔍 [MenuRouter] Procesando customId: ${customId}`);

    // Botón de refrescar
    if (customId === 'lcs_menu_refrescar') {
        await interaction.reply({ content: '🔄 ¡Menú actualizado correctamente!', ephemeral: true });
        return true;
    }

    // Botón o acción de Alarmas (abre su gestión)
    if (customId === 'lcs_menu_alarma' || customId.startsWith('alarm_')) {
        return await handleAlarmaInteraction(interaction);
    }

    // Botón o acción de Retos (abre sus categorías, empezando por Mates)
    if (customId === 'lcs_menu_retos' || customId.startsWith('reto_') || customId.startsWith('mate_')) {
        return await handleRetosInteraction(interaction);
    }

    // Delegación general por si acaso
    const handledAlarma = await handleAlarmaInteraction(interaction);
    if (handledAlarma) return true;

    const handledRetos = await handleRetosInteraction(interaction);
    if (handledRetos) return true;

    return false;
}
