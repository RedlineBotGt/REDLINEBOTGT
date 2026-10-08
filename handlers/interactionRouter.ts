import { Interaction, MessageFlags } from 'discord.js';
import mongoose from 'mongoose';
import { handleScheduledInteraction } from './scheduledInteraction';
import { handleRolReactionInteraction } from './rolreactionInteraction';
import { handleSheetsInteraction } from './sheetsInteraction';
import { handleEventInteraction } from './eventInteractions'; // 👈 Importamos el manejador de eventos

// Importación de comandos subiendo un nivel desde handlers/ hacia commands/
import { execute as handleDash } from '../commands/dash';
import { execute as handleDashStaff } from '../commands/dashstaff';
import { execute as handleDado } from '../commands/dado';
import { execute as handleBorrar } from '../commands/borrar';
import { execute as handleForms } from '../commands/forms';
import { execute as handleColocarForm } from '../commands/ColocarForm';
import { execute as handleMsn } from '../commands/msn';
import { execute as handleReporte } from '../commands/reporte';
import { execute as handleSetupDefensa } from '../commands/setupdefensa';
import { execute as handleVeredicto } from '../commands/veredicto';
import { execute as handleDashSheets } from '../commands/dashSheets';

/**
 * 📦 Conexión centralizada a la colección de eventos en MongoDB
 */
export async function getEventsCollection() {
    return mongoose.connection.collection('events');
}

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

        // 3. Módulo de Google Sheets (Panel, Botones y Menús Desplegables)
        if (await handleSheetsInteraction(interaction)) return;

        // 4. Módulo de Eventos y Asistencia (Creación, Modales y RSVPs) 👈 ¡AÑADIDO Y ACTIVO!
        if (await handleEventInteraction(interaction)) return;

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
