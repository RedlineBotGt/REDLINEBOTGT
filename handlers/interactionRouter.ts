import { Interaction } from 'discord.js';
import { handleScheduledInteraction } from './scheduledInteraction';
import { handleRolReactionInteraction } from './rolreactionInteraction'; // 👈 Conectado con el nuevo archivo y su función

/**
 * 🛡️ Enrutador Central de Interacciones
 * Distribuye cada evento al módulo correspondiente según su customId o tipo.
 */
export async function handleInteraction(interaction: Interaction): Promise<void> {
    try {
        // 1. Módulo de Mensajes Programados
        if (await handleScheduledInteraction(interaction)) return;

        // 2. Módulo de Reaction Roles / Autoroles por Botón
        if (await handleRolReactionInteraction(interaction)) return;

        // Si ninguna interacción fue manejada por los módulos anteriores y es un componente:
        if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Este botón o componente no está vinculado a ningún módulo activo o la sesión ha expirado.',
                    ephemeral: true
                }).catch(() => {});
            }
        }

    } catch (error) {
        console.error('❌ Error crítico en el enrutador de interacciones (interactionRouter):', error);
        
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ Ocurrió un error inesperado al procesar esta acción.',
                ephemeral: true
            }).catch(() => {});
        }
    }
}
