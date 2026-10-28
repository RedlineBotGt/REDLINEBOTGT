import { Interaction } from 'discord.js';
import { handleAlarmaInteraction } from '../alarma/alarmaactions';
import { handleRetosInteraction } from './retos/retosactions';

const LCS_GUILD_ID = '1564967606295732304';

/**
 * Enrutador principal del menú de LCS.
 * Captura y deriva las interacciones del panel a sus módulos correspondientes.
 */
export async function handleMenuInteraction(interaction: Interaction): Promise<boolean> {
    if (interaction.guildId !== LCS_GUILD_ID) return false;

    if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) {
        return false;
    }

    const customId = interaction.customId;
    console.log(`🔍 [MenuRouter] Procesando customId: ${customId}`);

    // 1. Botón de refrescar / actualizar el panel
    if (customId === 'lcs_menu_refrescar') {
        await interaction.reply({ content: '🔄 ¡Menú actualizado correctamente!', ephemeral: true });
        return true;
    }

    // 2. Gestión de Retos (Prioridad para cualquier botón de retos, mates o respuestas)
    if (customId.startsWith('lcs_menu_retos') || customId.startsWith('lcs_retos_') || customId.startsWith('lcs_reto_')) {
        const handled = await handleRetosInteraction(interaction);
        if (handled) {
            console.log(`✅ [MenuRouter] Gestionado por Retos: ${customId}`);
            return true;
        }
    }

    // 3. Gestión de Alarmas
    if (customId === 'lcs_menu_alarma' || customId === 'alarma' || customId.startsWith('alarm_') || customId.startsWith('modal_crear_alarma')) {
        const handled = await handleAlarmaInteraction(interaction);
        if (handled) {
            console.log(`✅ [MenuRouter] Gestionado por Alarmas: ${customId}`);
            return true;
        }
    }

    // 4. Delegación de respaldo general por seguridad
    const handledRetos = await handleRetosInteraction(interaction);
    if (handledRetos) return true;

    const handledAlarma = await handleAlarmaInteraction(interaction);
    if (handledAlarma) return true;

    console.log(`⚠️ [MenuRouter] Ningún submódulo reclamó el customId: ${customId}`);
    return false;
}
