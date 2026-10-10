/**
 * Función auxiliar para construir el Embed público del estado del Draft con lista limpia (sin números en los pilotos)
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

    // 1. Lista de Asistentes / Pilotos (SIN numeración, usando viñetas •)
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
            { name: '👥 Lista de Pilotos y Estado', value: pilotsListText, inline: false }
        );
    }

    // 2. Modelos Disponibles (Numerados 1, 2, 3... solo para el selector del modal)
    const availableList = state.availableModels
        .map((model: string, idx: number) => `\`${idx + 1}.\` ${model}`)
        .join('\n') || 'No quedan modelos disponibles.';

    embed.addFields(
        { name: '🏎️ Modelos Disponibles', value: availableList, inline: false }
    );

    return embed;
}
