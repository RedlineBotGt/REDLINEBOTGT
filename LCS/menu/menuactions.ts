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

    // Solo nos interesan botones, modales o menús desplegables
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

    // 2. Gestión de Alarmas (incluye el botón del menú lcs_menu_alarma y acciones internas)
    if (customId === 'lcs_menu_alarma' || customId === 'alarma' || customId.startsWith('alarm_') || customId.startsWith('modal_crear_alarma')) {
        const handled = await handleAlarmaInteraction(interaction);
        if (handled) {
            console.log(`✅ [MenuRouter] Gestionado por Alarmas: ${customId}`);
            return true;
        }
    }

    // 3. Gestión de Retos (incluye lcs_menu_retos, lcs_retos_* y acciones de mates)
    if (customId === 'lcs_menu_retos' || customId.startsWith('lcs_retos_') || customId.startsWith('reto_') || customId.startsWith('mate_')) {
        const handled = await handleRetosInteraction(interaction);
        if (handled) {
            console.log(`✅ [MenuRouter] Gestionado por Retos: ${customId}`);
            return true;
        }
    }

    // 4. Delegación de respaldo general por si algún customId interno no coincidió arriba
    const handledAlarma = await handleAlarmaInteraction(interaction);
    if (handledAlarma) return true;

    const handledRetos = await handleRetosInteraction(interaction);
    if (handledRetos) return true;

    console.log(`⚠️ [MenuRouter] Ningún submódulo reclamó el customId: ${customId}`);
    return false;
}
