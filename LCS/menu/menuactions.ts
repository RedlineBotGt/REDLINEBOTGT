import { Interaction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { handleAlarmaInteraction } from '../alarma/alarmaactions';
import { handleRetosInteraction } from './retos/retosactions';

const LCS_GUILD_ID = '1564967606295732304';

/**
 * Enrutador principal del menú de LCS.
 */
export async function handleMenuInteraction(interaction: Interaction): Promise<boolean> {
    if (interaction.guildId !== LCS_GUILD_ID) return false;

    // Permitir botones, modales, select menus de texto y select menus de canales
    if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu() && !interaction.isChannelSelectMenu()) {
        return false;
    }

    const customId = interaction.customId;
    console.log(`🔍 [MenuRouter] Procesando customId: ${customId}`);

    // 0. Comando principal del Menú LCS (Panel Inicial con Ranking primero)
    if (customId === 'lcs_menu_principal' || customId === 'lcs_menu') {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('lcs_retos_ranking')
                .setLabel('🏆 Ranking')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('lcs_retos_mates_crear')
                .setLabel('📐 Retos de Mates')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('lcs_menu_alarma')
                .setLabel('⏰ Alarmas')
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
            content: '🎓 **Panel de Control - Academia LCS**\n\nSelecciona una opción:',
            components: [row],
            ephemeral: true
        });
        return true;
    }

    // 1. Refrescar panel
    if (customId === 'lcs_menu_refrescar') {
        await interaction.reply({ content: '🔄 ¡Menú actualizado correctamente!', ephemeral: true });
        return true;
    }

    // 2. Módulo de Retos (Ranking y Mates)
    if (
        customId.startsWith('lcs_menu_retos') || 
        customId.startsWith('lcs_retos_') || 
        customId.startsWith('lcs_reto_') ||
        customId === 'select_canal_reto_mates'
    ) {
        const handled = await handleRetosInteraction(interaction);
        if (handled) {
            console.log(`✅ [MenuRouter] Gestionado por Retos: ${customId}`);
            return true;
        }
    }

    // 3. Módulo de Alarmas (incluye select_canal_alarma y modales)
    if (
        customId === 'lcs_menu_alarma' || 
        customId === 'alarma' || 
        customId.startsWith('alarm_') || 
        customId.startsWith('modal_') || 
        customId.startsWith('select_')
    ) {
        const handled = await handleAlarmaInteraction(interaction);
        if (handled) {
            console.log(`✅ [MenuRouter] Gestionado por Alarmas: ${customId}`);
            return true;
        }
    }

    // 4. Respaldos
    const handledAlarma = await handleAlarmaInteraction(interaction);
    if (handledAlarma) return true;

    const handledRetos = await handleRetosInteraction(interaction);
    if (handledRetos) return true;

    console.log(`⚠️ [MenuRouter] Ningún submódulo reclamó el customId: ${customId}`);
    return false;
}
