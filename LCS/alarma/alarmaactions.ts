import { Interaction, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } from 'discord.js';
import { configurarAlarma, listarAlarmas, borrarAlarma } from './alarmaworker';

/**
 * Manejador de interacciones para el sistema de Alarmas.
 */
export async function handleAlarmaInteraction(interaction: Interaction): Promise<boolean> {
    // Si no es un botón, modal o select menu relacionado con alarmas, devolvemos false
    if (!interaction.isChatInputCommand() && !interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) {
        return false;
    }

    try {
        // ID o CustomId personalizado para las alarmas
        const customId = interaction.isCommand() ? interaction.commandName : interaction.customId;

        // Ejemplo de gestión del comando o botones de alarma
        if (customId === 'alarma' || customId?.startsWith('alarm_')) {
            // Lógica del panel de alarmas
            if (interaction.isButton()) {
                if (interaction.customId === 'alarm_crear') {
                    const modal = new ModalBuilder()
                        .setCustomId('modal_crear_alarma')
                        .setTitle('Configurar Nueva Alarma');

                    const inputHora = new TextInputBuilder()
                        .setCustomId('input_hora_alarma')
                        .setLabel('Introduce la hora (HH:MM):')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(inputHora);
                    modal.addComponents(row);

                    await interaction.showModal(modal);
                    return true;
                }
            }

            // Si se envió el modal de creación
            if (interaction.isModalSubmit() && interaction.customId === 'modal_crear_alarma') {
                const hora = interaction.fields.getTextInputValue('input_hora_alarma');
                await configurarAlarma(interaction, hora);
                return true;
            }

            return false;
        }

        return false;
    } catch (error) {
        console.error('Error al manejar la interacción de alarma:', error);
        return false;
    }
}
