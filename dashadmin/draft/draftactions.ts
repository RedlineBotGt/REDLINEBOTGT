// dashadmin/draft/draftactions.ts
import { 
    ChannelSelectMenuInteraction, 
    ButtonInteraction, 
    ModalSubmitInteraction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    MessageFlags 
} from 'discord.js';
import { getDraftState, recordDraftChoice } from './draftmanager';

// Ajusta esta ruta según la ubicación exacta de tu cliente de Google Sheets en el proyecto
import { sheets, SPREADSHEET_ID } from '../../config/sheets'; 

/**
 * 1. Recibe el canal seleccionado, lee el estado inicial y publica el Embed público del Draft.
 */
export async function handleDraftChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'draft_select_channel') return false;

    const channel = interaction.channels.first();
    if (!channel || channel.isDMBased() || !channel.isTextBased()) {
        await interaction.update({ content: '❌ Canal no válido.', components: [] });
        return true;
    }

    await interaction.update({ content: '⚙️ Inicializando el sistema de Draft y cargando datos...', components: [] });

    try {
        const state = await getDraftState(sheets, SPREADSHEET_ID);

        if (state.isCompleted) {
            await interaction.editReply({ content: '❌ El Draft ya está completado o no hay pilotos en la lista.' });
            return true;
        }

        // Crear Embed público con la lista numerada y el turno actual
        const embed = buildDraftEmbed(state);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('draft_open_modal')
                .setLabel('🎯 Realizar mi Elección')
                .setStyle(ButtonStyle.Success)
        );

        await channel.send({
            embeds: [embed],
            components: [row]
        });

        await interaction.editReply({
            content: `✅ ¡Panel de Draft publicado con éxito en <#${channel.id}>! El mensaje principal se actualizará automáticamente.`
        });

    } catch (error) {
        console.error('❌ Error al iniciar el Draft en el canal:', error);
        await interaction.editReply({ content: '❌ Hubo un error al conectar con Google Sheets.' });
    }

    return true;
}

/**
 * 2. Abre el Modal efímero al pulsar el botón pidiendo el número del modelo.
 */
export async function handleDraftOpenModalButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'draft_open_modal') return false;

    try {
        const state = await getDraftState(sheets, SPREADSHEET_ID);

        if (state.isCompleted || !state.currentPilot) {
            await interaction.reply({ content: '❌ El Draft ya ha finalizado.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        const modal = new ModalBuilder()
            .setCustomId('draft_modal_submit')
            .setTitle(`Selección de Coche — Turno de: ${state.currentPilot}`);

        const numberInput = new TextInputBuilder()
            .setCustomId('draft_model_number')
            .setLabel('Número del modelo de la lista')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Introduce el número (ej: 3)')
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(numberInput));

        await interaction.showModal(modal);
        return true;
    } catch (error) {
        console.error('❌ Error al abrir modal de Draft:', error);
        await interaction.reply({ content: '❌ Hubo un error al verificar el turno del Draft.', flags: [MessageFlags.Ephemeral] });
        return true;
    }
}

/**
 * 3. Procesa el número enviado en el Modal, actualiza la hoja y el mensaje público.
 */
export async function handleDraftModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'draft_modal_submit') return false;

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const inputVal = interaction.fields.getTextInputValue('draft_model_number').trim();
    const index = parseInt(inputVal, 10) - 1; // Convertimos a índice base 0

    try {
        const state = await getDraftState(sheets, SPREADSHEET_ID);

        if (state.isCompleted || !state.currentPilot) {
            await interaction.editReply({ content: '❌ El Draft ya ha finalizado.' });
            return true;
        }

        if (isNaN(index) || index < 0 || index >= state.availableModels.length) {
            await interaction.editReply({ content: `❌ Número no válido. Debes elegir un número entre 1 y ${state.availableModels.length}.` });
            return true;
        }

        const chosenModel = state.availableModels[index];
        const pilot = state.currentPilot;

        // Registrar en Google Sheets (Columnas C y D)
        await recordDraftChoice(sheets, SPREADSHEET_ID, pilot, chosenModel);

        // Obtener el estado actualizado tras el registro
        const updatedState = await getDraftState(sheets, SPREADSHEET_ID);

        // Actualizar el mensaje público desde el que se abrió la interacción
        const originalMessage = interaction.message;
        if (originalMessage) {
            const updatedEmbed = buildDraftEmbed(updatedState);
            const components = updatedState.isCompleted ? [] : originalMessage.components;

            await originalMessage.edit({
                embeds: [updatedEmbed],
                components: components
            });
        }

        if (updatedState.isCompleted) {
            await interaction.editReply({ content: `✅ ¡Has seleccionado con éxito el modelo **${chosenModel}**!\n🏁 **¡El Draft ha finalizado por completo!**` });
            if (originalMessage) {
                await originalMessage.channel.send('🏁 **¡Todas las selecciones de coches han finalizado con éxito!**\n\nREDLINE GT');
            }
        } else {
            await interaction.editReply({ content: `✅ ¡Selección registrada con éxito! Has elegido: **${chosenModel}**.\nSiguiente turno para: **${updatedState.currentPilot}**` });
        }

    } catch (error) {
        console.error('❌ Error al procesar la elección del Draft:', error);
        await interaction.editReply({ content: '❌ Hubo un error al registrar el coche en la hoja de cálculo.' });
    }

    return true;
}

/**
 * Función auxiliar para construir el Embed público del estado del Draft
 */
function buildDraftEmbed(state: any): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(state.isCompleted ? 0x00FF00 : 0xFFD700)
        .setTitle('🏁 SISTEMA DE DRAFT - SELECCIÓN DE COCHES')
        .setTimestamp()
        .setFooter({ text: 'REDLINE GT' });

    if (state.isCompleted) {
        embed.setDescription('🎉 **¡El Draft ha concluido! Todos los pilotos han seleccionado su montura.**');
    } else {
        embed.setDescription(`📢 Turno actual para: **${state.currentPilot}**\n\nIntroduce el número correspondiente al coche que deseas elegir.`);
    }

    // Listar modelos disponibles numerados (1, 2, 3...)
    const availableList = state.availableModels
        .map((model: string, idx: number) => `\`${idx + 1}.\` ${model}`)
        .join('\n') || 'No quedan modelos disponibles.';

    embed.addFields(
        { name: '🏎️ Modelos Disponibles', value: availableList, inline: false }
    );

    // Mostrar historial de elecciones realizadas hasta el momento si las hay
    if (state.choices.length > 0) {
        const historyList = state.choices
            .map((c: any, idx: number) => `**${idx + 1}.** ${c.pilot} ➔ ${c.model}`)
            .join('\n');
        embed.addFields(
            { name: '📋 Elecciones Realizadas', value: historyList, inline: false }
        );
    }

    return embed;
}
