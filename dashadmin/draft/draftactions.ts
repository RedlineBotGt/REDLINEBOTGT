import { 
    ChannelSelectMenuInteraction, 
    ButtonInteraction, 
    ModalSubmitInteraction, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} from 'discord.js';
import { getDraftState, recordDraftChoice } from './draftmanager';

/**
 * Función auxiliar para extraer el ID de Discord de una mención <@ID> o string limpio
 */
function extractUserId(mentionOrId: string | null): string | null {
    if (!mentionOrId) return null;
    const match = mentionOrId.match(/\d+/);
    return match ? match[0] : mentionOrId;
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
        const currentId = extractUserId(state.currentPilot);
        const currentMention = currentId ? `<@${currentId}>` : state.currentPilot;
        embed.setDescription(`📢 Turno actual para: ${currentMention}\n\nPulsa el botón de abajo e introduce el número del coche que deseas elegir.`);
    }

    // 1. Lista de Asistentes / Pilotos con el título ajustado
    if (state.pilotList && state.pilotList.length > 0) {
        const choicesMap = new Map<string, string>();
        for (const c of state.choices) {
            const cleanId = extractUserId(c.pilot) || c.pilot;
            choicesMap.set(cleanId, c.model);
        }

        const pilotsListText = state.pilotList.map((p: any) => {
            const cleanId = extractUserId(p.id) || p.id;
            const chosenModel = choicesMap.get(cleanId);
            const isCurrent = (cleanId === extractUserId(state.currentPilot));

            if (chosenModel) {
                return `• ${p.name} ➔ **${chosenModel}** ✅`;
            } else if (isCurrent && !state.isCompleted) {
                return `• **${p.name}** ➔ ⏳ *Turno actual*`;
            } else {
                return `• ${p.name} ➔ ⏱️ Pendiente`;
            }
        }).join('\n');

        embed.addFields(
            { name: '📋 LISTA EN ORDEN DE ELECCIÓN', value: pilotsListText, inline: false }
        );
    }

    // 2. Selecciones Realizadas (Historial activo dentro del embed)
    if (state.choices && state.choices.length > 0) {
        const historyText = state.choices
            .map((c: any) => `• ${c.pilot} ➔ **${c.model}**`)
            .join('\n');

        embed.addFields(
            { name: '📋 Selecciones Realizadas', value: historyText, inline: false }
        );
    }

    // 3. Modelos Disponibles (Numerados 1, 2, 3...)
    const availableList = state.availableModels
        .map((model: string, idx: number) => `\`${idx + 1}.\` ${model}`)
        .join('\n') || 'No quedan modelos disponibles.';

    embed.addFields(
        { name: '🏎️ Modelos Disponibles', value: availableList, inline: false }
    );

    return embed;
}

/**
 * 1. Maneja la selección del canal donde publicar el Embed interactivo del Draft
 */
export async function handleDraftChannelSelect(interaction: any): Promise<boolean> {
    try {
        const selectedChannelId = interaction.values[0];
        const channel = await interaction.guild?.channels.fetch(selectedChannelId);

        if (!channel || !channel.isTextBased()) {
            await interaction.reply({ content: '❌ Canal no válido o no es un canal de texto.', ephemeral: true });
            return true;
        }

        await interaction.deferReply({ ephemeral: true });

        const state = await getDraftState();
        const embed = buildDraftEmbed(state);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('draft_open_modal')
                .setLabel('🏎️ Elegir Coche')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(state.isCompleted)
        );

        await channel.send({ embeds: [embed], components: [row] });

        // Mención inicial al primer piloto si el Draft acaba de empezar
        if (!state.isCompleted && state.currentPilot) {
            const firstPilotId = extractUserId(state.currentPilot);
            if (firstPilotId) {
                await channel.send({
                    content: `📢 <@${firstPilotId}>, ¡es tu turno para elegir coche!`
                });
            }
        }

        await interaction.editReply({ content: `✅ Panel de Draft publicado con éxito en <#${selectedChannelId}>.` });
        return true;
    } catch (error) {
        console.error('❌ Error en handleDraftChannelSelect:', error);
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: '❌ Error al publicar el panel de Draft.', ephemeral: true }).catch(() => {});
        } else {
            await interaction.reply({ content: '❌ Error al publicar el panel de Draft.', ephemeral: true }).catch(() => {});
        }
        return true;
    }
}

/**
 * 2. Abre el Modal para que el usuario elija el coche
 */
export async function handleDraftOpenModalButton(interaction: ButtonInteraction): Promise<boolean> {
    try {
        const state = await getDraftState();

        if (state.isCompleted) {
            await interaction.reply({ content: '🎉 El Draft ya ha finalizado.', ephemeral: true });
            return
