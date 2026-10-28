import { Interaction } from 'discord.js';
import { handleAlarmaInteraction } from '../alarma/alarmaactions';
import { handleRetosInteraction } from './retos/retosactions';

const LCS_GUILD_ID = '1564967606295732304';

/**
 * Enrutador principal del menú. Deriva cada interacción a su submódulo correspondiente.
 */
export async function handleMenuInteraction(interaction: Interaction): Promise<boolean> {
    if (interaction.guildId !== LCS_GUILD_ID) return false;

    // 1. Intentar manejar con el módulo de Alarmas
    const handledAlarma = await handleAlarmaInteraction(interaction);
    if (handledAlarma) return true;

    // 2. Intentar manejar con el módulo de Retos
    const handledRetos = await handleRetosInteraction(interaction);
    if (handledRetos) return true;

    return false;
}
