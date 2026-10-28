import { 
    Interaction, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    TextChannel,
    ComponentType,
    ChannelSelectMenuBuilder,
    ChannelType 
} from 'discord.js';
import { generarRetoLengua } from './lenguapreguntas';
import { getAlarmasCollection } from '../../alarma/alarmaworker';

async function getRetosCollection() {
    const alarmasColl = await getAlarmasCollection();
    return alarmasColl.db.collection('lcs_retos_puntos');
}

/**
 * Manejador principal para las interacciones del Módulo de Lengua
 */
export async function handleLenguaInteraction(interaction: Interaction): Promise<boolean> {
    if (!interaction.isButton() && !interaction.isChannelSelectMenu() && !interaction.isStringSelectMenu()) {
        return false;
    }

    const customId = interaction.customId;

    // 1. Menú principal o botón de Lengua
    if (customId === 'lcs_menu_lengua' || customId === 'lcs_retos_lengua_crear') {
        const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('select_canal_reto_lengua')
                .setPlaceholder('Selecciona el canal para enviar el reto de Lengua')
                .addChannelTypes(ChannelType.GuildText)
                .setMinValues(1)
                .setMaxValues(1)
        );

        const textoRespuesta = customId === 'lcs_menu_lengua' 
            ? '📚 **Academia LCS - Retos de Lengua**\nSelecciona el canal de destino:'
            : '📚 **Retos de Lengua y Literatura**\nSelecciona el canal de destino:';

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: textoRespuesta, components: [row], flags: [1 << 6] });
        } else {
            await interaction.reply({ content: textoRespuesta, components: [row], flags: [1 << 6] });
        }
        return true;
    }

    // 2. Capturar selección de canal y lanzar el primer reto
    if (interaction.isChannelSelectMenu() && interaction.customId === 'select_canal_reto_lengua') {
        const canalId = interaction.values[0];
        const canalLengua = interaction.guild?.channels.cache.get(canalId) as TextChannel;

        if (!canalLengua) {
            await interaction.reply({ content: '❌ No se pudo encontrar el canal seleccionado.', flags: [1 << 6] });
            return true;
        }

        const nivelInicial = 1; 
        const reto = generarRetoLengua(nivelInicial);

        const rowOpciones = new ActionRowBuilder<ButtonBuilder>();
        reto.opciones.forEach((op, index) => {
            const esCorrectaStr = op.esCorrecta ? 'si' : 'no';
            const customIdResp = `lcs_lengua_resp_${esCorrectaStr}_${nivelInicial}_${encodeURIComponent(reto.pregunta)}_${index}`;
            rowOpciones.addComponents(
                new ButtonBuilder()
                    .setCustomId(customIdResp)
                    .setLabel(op.texto.substring(0, 80)) // Límite de caracteres de Discord
                    .setStyle(ButtonStyle.Primary)
            );
        });

        const mensajeReto = `📚 **¡Nuevo Reto de Lengua y Ortografía!** (Nivel ${nivelInicial})\n\n📌 **${reto.pregunta}**`;

        await canalLengua.send({
            content: mensajeReto,
            components: [rowOpciones]
        });

        await interaction.update({ 
            content: `✅ ¡Reto de Lengua lanzado con éxito al canal <#${canalId}>!`, 
            components: [] 
        });
        return true;
    }

    // 3. Capturar respuestas de los botones de Lengua
    if (customId.startsWith('lcs_lengua_resp_')) {
        const partes = customId.split('_');
        const esCorrecta = partes[3] === 'si';
        const nivelActual = parseInt(partes[4]) || 1;
        const preguntaActual = decodeURIComponent(partes[5] || '');
        const userId = interaction.user.id;

        const rowDeshabilitada = new ActionRowBuilder<ButtonBuilder>();
        interaction.message.components.forEach(row => {
            row.components.forEach(component => {
                if (component.type === ComponentType.Button) {
                    const button = ButtonBuilder.from(component);
                    button.setDisabled(true);
                    if (component.customId?.includes('_si_')) {
                        button.setStyle(ButtonStyle.Success);
                    } else if (component.customId === customId && !esCorrecta) {
                        button.setStyle(ButtonStyle.Danger);
                    }
                    rowDeshabilitada.addComponents(button);
                }
            });
        });

        const canalActual = interaction.channel as TextChannel;

        if (esCorrecta) {
            let siguienteNivel = 1;

            try {
                const collection = await getRetosCollection();
                await collection.updateOne(
                    { userId: userId },
                    { 
                        $inc: { puntos: 1 },
                        $set: { username: interaction.user.username }
                    },
                    { upsert: true }
                );

                const usuarioDoc = await collection.findOne({ userId: userId });
                siguienteNivel = (usuarioDoc?.puntos || 1);
            } catch (err) {
                console.error('❌ Error al gestionar puntos de lengua en MongoDB:', err);
            }

            await interaction.update({
                content: `${interaction.message.content}\n\n🎉 **¡Respuesta Correcta de <@${userId}>! (+1 punto)** 🌟`,
                components: [rowDeshabilitada]
            });

            // Si acierta, sube de nivel y lanza un reto NUEVO
            const nuevoReto = generarRetoLengua(siguienteNivel);
            const rowNuevasOpciones = new ActionRowBuilder<ButtonBuilder>();
            nuevoReto.opciones.forEach((op, index) => {
                const esCorrectaStr = op.esCorrecta ? 'si' : 'no';
                const customIdResp = `lcs_lengua_resp_${esCorrectaStr}_${siguienteNivel}_${encodeURIComponent(nuevoReto.pregunta)}_${index}`;
                rowNuevasOpciones.addComponents(
                    new ButtonBuilder()
                        .setCustomId(customIdResp)
                        .setLabel(op.texto.substring(0, 80))
                        .setStyle(ButtonStyle.Primary)
                );
            });

            if (canalActual) {
                await canalActual.send({
                    content: `📈 **¡Nivel Superado por <@${userId}>! Subimos de nivel en Lengua:**\n\n📚 **¡Nuevo Reto!** (Nivel ${siguienteNivel})\n\n📌 **${nuevoReto.pregunta}**`,
                    components: [rowNuevasOpciones]
                });
            }

        } else {
            // Si falla, se deshabilitan los botones y se le da OTRA OPORTUNIDAD con EL MISMO RETO
            await interaction.update({
                content: `${interaction.message.content}\n\n❌ **Vaya, <@${userId}>, esa no es. ¡Inténtalo de nuevo con el mismo reto!** 💪`,
                components: [rowDeshabilitada]
            });

            const contenidoMensajeOriginal = interaction.message.content;
            const lineaPregunta = contenidoMensajeOriginal.split('\n').find(l => l.includes('📌')) || `📌 **${preguntaActual}**`;

            const opcionesMismoReto: { texto: string; esCorrecta: boolean }[] = [];
            interaction.message.components.forEach(row => {
                row.components.forEach(component => {
                    if (component.type === ComponentType.Button) {
                        const esCorrectaOpcion = component.customId?.includes('_si_') || false;
                        opcionesMismoReto.push({
                            texto: component.label || '',
                            esCorrecta: esCorrectaOpcion
                        });
                    }
                });
            });

            const rowReintentoOpciones = new ActionRowBuilder<ButtonBuilder>();
            opcionesMismoReto.sort(() => Math.random() - 0.5).forEach((op, index) => {
                const esCorrectaStr = op.esCorrecta ? 'si' : 'no';
                const customIdResp = `lcs_lengua_resp_${esCorrectaStr}_${nivelActual}_${encodeURIComponent(preguntaActual)}_${index}`;
                rowReintentoOpciones.addComponents(
                    new ButtonBuilder()
                        .setCustomId(customIdResp)
                        .setLabel(op.texto.substring(0, 80))
                        .setStyle(ButtonStyle.Primary)
                );
            });

            if (canalActual) {
                await canalActual.send({
                    content: `🔄 **¡Otra oportunidad para <@${userId}>!**\n\n📚 **Repetimos Reto de Lengua** (Nivel ${nivelActual})\n\n${lineaPregunta}`,
                    components: [rowReintentoOpciones]
                });
            }
        }
        return true;
    }

    return false;
}
