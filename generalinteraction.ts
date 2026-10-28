import { Interaction, Client } from 'discord.js';
import { handleDashAdminInteractions } from './dashadmin/interactiondashadmin';
import { handleSheetsInteraction } from './dashsheet/sheetsInteraction';
import { handleDadoModalSubmit } from './commands/dado';
import { handleAvisosInteractions } from './dashadmin/avisos/interactionavisos';
import { handleClubInteractions } from './dashadmin/club/clubactions';
import { handlePQ2Interactions } from './dashsheet/PQ2/interactionPQ2';
import { handleMenuInteraction } from './LCS/menu/menuactions'; // 👈 Importado

export async function handleGlobalInteraction(interaction: Interaction, client: Client & { commands?: Map<string, any> }) {
    try {
        // 1. Manejo de Comandos Slash generales o de PQ2
        if (interaction.isChatInputCommand()) {
            const handledByPQ2 = await handlePQ2Interactions(interaction);
            if (handledByPQ2) return;

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

        // 1.5. Manejo del Modal del Dado
        if (interaction.isModalSubmit() && interaction.customId === 'modal_dado_lanza') {
            const handledDado = await handleDadoModalSubmit(interaction);
            if (handledDado) return;
        }

        // 2. Manejo de Interacciones de GT Club
        const handledByClub = await handleClubInteractions(interaction);
        if (handledByClub) return;

        // 3. Manejo de Interacciones del Panel Admin
        const handledByAdmin = await handleDashAdminInteractions(interaction);
        if (handledByAdmin) return;

        // 4. Manejo de Interacciones del Panel de Google Sheets
        const handledBySheets = await handleSheetsInteraction(interaction);
        if (handledBySheets) return;

        // 5. Manejo de Interacciones de Avisos y Logs
        const handledByAvisos = await handleAvisosInteractions(interaction);
        if (handledByAvisos) return;

        // 6. Manejo de Interacciones del Menú Fijo de LCS
        const handledByMenu = await handleMenuInteraction(interaction);
        if (handledByMenu) return;

        // 7. Si ningún router reclamó el componente
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
