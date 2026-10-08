import { Interaction, Client } from 'discord.js';
import { handleDashAdminInteractions } from './dashadmin/interactionRouter'; // Router de los 12 submódulos de admin
import { handleSheetsInteraction } from './dashsheets/sheetsInteraction';   // Router del panel de Google Sheets

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

        // 2. Manejo de Interacciones del Panel Admin (`dashadmin` / 12 submódulos: reportes, eventos, formularios, etc.)
        const handledByAdmin = await handleDashAdminInteractions(interaction);
        if (handledByAdmin) return;

        // 3. Manejo de Interacciones del Panel de Google Sheets (`dashsheets`)
        const handledBySheets = await handleSheetsInteraction(interaction);
        if (handledBySheets) return;

        // 4. Si la interacción es un componente (botón/modal/select) pero ningún router la reclamó
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
