import { Interaction, MessageFlags } from 'discord.js';
import { handleScheduledInteraction } from './scheduledInteraction.ts';
import { handleRolReactionInteraction } from './rolreactionInteraction.ts';

// Importación de comandos con extensión .ts incluida
import { execute as handleDash } from './commands/dash.ts';
import { execute as handleDashStaff } from './commands/dashstaff.ts';
import { execute as handleDado } from './commands/dado.ts';
import { execute as handleBorrar } from './commands/borrar.ts';
import { execute as handleForms } from './commands/forms.ts';
import { execute as handleColocarForm } from './commands/ColocarForm.ts';
import { execute as handleMsn } from './commands/msn.ts';
import { execute as handleReporte } from './commands/reporte.ts';
import { execute as handleSetupDefensa } from './commands/setupdefensa.ts';
import { execute as handleVeredicto } from './commands/veredicto.ts';
import { execute as handleDashSheets } from './commands/dashSheets.ts';

/**
 * 🛡️ Enrutador Central de Interacciones
 * Distribuye cada evento (Comandos barra, Botones, Menús, Modales) al módulo correspondiente.
 */
export async function handleInteraction(interaction: Interaction): Promise<void> {
    try {
        // 0. Enrutador de Comandos de Barra (Slash Commands)
        if (interaction.isChatInputCommand()) {
            const { commandName } = interaction;

            switch (commandName) {
                case 'dash':
                    await handleDash(interaction);
                    return;
                case 'dashstaff':
                    await handleDashStaff(interaction);
                    return;
                case 'dado':
                    await handleDado(interaction);
                    return;
                case 'borrar':
                    await handleBorrar(interaction);
                    return;
                case 'forms':
                    await handleForms(interaction);
                    return;
                case 'colocarform':
                    await handleColocarForm(interaction);
                    return;
                case 'msn':
                    await handleMsn(interaction);
                    return;
                case 'reporte':
                    await handleReporte(interaction);
                    return;
                case 'setupdefensa':
                    await handleSetupDefensa(interaction);
                    return;
                case 'veredicto':
                    await handleVeredicto(interaction);
                    return;
                case 'dashsheets':
                    await handleDashSheets(interaction);
                    return;
                default:
                    await interaction.reply({
                        content: '❌ Este comando no está registrado en el enrutador.',
                        flags: [MessageFlags.Ephemeral]
                    });
                    return;
            }
        }

        // 1. Módulo de Mensajes Programados (Componentes)
        if (await handleScheduledInteraction(interaction)) return;

        // 2. Módulo de Reaction Roles / Autoroles por Botón (Componentes)
        if (await handleRolReactionInteraction(interaction)) return;

        // Si ninguna interacción fue manejada y es un componente de UI huérfano:
        if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Este botón o componente no está vinculado a ningún módulo activo o la sesión ha expirado.',
                    flags: [MessageFlags.Ephemeral]
                }).catch(() => {});
            }
        }

    } catch (error) {
        console.error('❌ Error crítico en el enrutador de interacciones (interactionRouter):', error);
        
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ Ocurrió un error inesperado al procesar esta acción.',
                flags: [MessageFlags.Ephemeral]
            }).catch(() => {});
        }
    }
}
