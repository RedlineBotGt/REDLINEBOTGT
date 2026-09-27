import { Interaction } from 'discord.js';
import * as dash from '../commands/dash';
import * as reporte from '../commands/reporte';
import * as setupdefensa from '../commands/setupdefensa';
import * as veredicto from '../commands/veredicto';
import * as msn from '../commands/msn';
import { handleReportButton, handleReportModalSubmit } from './reportModal';
import { handleDefensaButton, handleDefensaModalSubmit } from './defensModal';
import { handleVeredictoModalSubmit } from './veredictoModal';
import { handleMsnModalSubmit } from './msnModal';

export async function handleInteraction(interaction: Interaction) {
    try {
        // 1. Manejo de Comandos de Barra (Slash Commands)
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'dash') {
                await dash.execute(interaction);
            } else if (interaction.commandName === 'setup-reporte') {
                await reporte.execute(interaction);
            } else if (interaction.commandName === 'setupdefensa') {
                await setupdefensa.execute(interaction);
            } else if (interaction.commandName === 'veredicto') {
                await veredicto.execute(interaction);
            } else if (interaction.commandName === 'msn') {
                await msn.execute(interaction);
            }
            return;
        }

        // 2. Manejo de Botones interactivos
        if (interaction.isButton()) {
            if (interaction.customId === 'btn_abrir_reporte') {
                // Lanzamos el formulario Modal de Reporte
                const handled = await handleReportButton(interaction);
                if (handled) return;
            } else if (interaction.customId === 'btn_abrir_defensa') {
                // Lanzamos el formulario Modal de Defensa
                const handled = await handleDefensaButton(interaction);
                if (handled) return;
            }
            return;
        }

        // 3. Manejo de Envíos de Formularios (Modals)
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'modal_envio_reporte') {
                await handleReportModalSubmit(interaction);
            } else if (interaction.customId === 'modal_envio_defensa') {
                await handleDefensaModalSubmit(interaction);
            } else if (interaction.customId.startsWith('modal_veredicto_')) {
                await handleVeredictoModalSubmit(interaction);
            } else if (interaction.customId.startsWith('modal_msn_')) {
                await handleMsnModalSubmit(interaction);
            }
            return;
        }

    } catch (error) {
        console.error('❌ Error al procesar la interacción:', error);
        if (interaction.isRepliable()) {
            const errorMessage = {
                content: 'Hubo un error al procesar esta acción.',
                ephemeral: true
            };
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    }
}
