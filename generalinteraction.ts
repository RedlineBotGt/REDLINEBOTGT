import { Interaction, Client } from 'discord.js';
import { handleDashAdminInteractions } from './dashadmin/interactiondashadmin'; // ➔ Panel de Admin
import { handleSheetsInteraction } from './dashsheet/sheetsInteraction';   // ➔ Panel de Google Sheets
import { handleDadoModalSubmit } from './commands/dado'; // ➔ Comando del dado
import { handleAvisosInteractions } from './dashadmin/avisos/interactionavisos'; // ➔ Ruta corregida

/**
 * Enrutador Maestro Global de Interacciones
 * Recibe cualquier interacción de Discord y la deriva al sistema correspondiente.
 */
export async function handleGlobalInteraction(interaction: Interaction, client: Client & { commands?: Map<string, any> }) {
    try {
        // 1. Manejo de Comandos Slash (ej: /dash, /dashstaff, /dashsheets, /borrar, /dado)
        if (interaction.isChatInputCommand()) {
            const command = client.commands?.get(interaction.commandName);

            if (!command) {
                console.warn(`⚠ Comando no encontrado en la colección: ${interaction.commandName}`);
                if (interaction.isRepliable()) {
                    await interaction.reply({ content: '❌ Este comando no está disponible o no ha sido cargado.', ephemeral: true });
                }
                return;
            }

            await command.execute(interaction);
            return;
        }

        // 1.5. Manejo del Modal del Dado (modal_dado_lanza)
        if (interaction.isModalSubmit() && interaction.customId === 'modal_dado_lanza') {
            const handledDado = await handleDadoModalSubmit(interaction);
            if (handledDado) return;
        }

        // 2. Manejo de Interacciones del Panel Admin (`dashadmin` / submódulos)
        const handledByAdmin = await handleDashAdminInteractions(interaction);
        if (handledByAdmin) return;

        // 3. Manejo de Interacciones del Panel de Google Sheets (`dashsheet`)
        const handledBySheets = await handleSheetsInteraction(interaction);
        if (handledBySheets) return;

        // 4. Manejo de Interacciones de Avisos y Logs (`interactionavisos`)
        const handledByAvisos = await handleAvisosInteractions(interaction);
        if (handledByAvisos) return;

        // 5. Si la interacción es un componente (botón/modal/select) pero ningún router la reclamó
        if (interaction.isButton() || interaction.isModalSubmit() || interaction.isAnySelectMenu()) {
            console.warn(`⚠ Interacción no reclamada [CustomId: ${interaction.customId}]`);
        }

    } catch (error) {
        console.error('❌ Error crítico en el enrutador global de interacciones:', error);

        if (interaction.isRepliable()) {
            const errorPayload = { content: '❌ Hubo un error interno al procesar esta acción.', ephemeral: true };
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(errorPayload).catch(() => {});
            } else {
                await interaction.reply(errorPayload).catch(() => {});
            }
        }
    }
}
