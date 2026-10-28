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
import { generarRetoMates } from './mates/mates';
import { getAlarmasCollection } from '../../alarma/alarmaworker';

async function getRetosCollection() {
    const alarmasColl = await getAlarmasCollection();
    return alarmasColl.db.collection('lcs_retos_puntos');
}

/**
 * Manejador principal para las interacciones del Módulo de Retos
 */
export async function handleRetosInteraction(interaction: Interaction): Promise<boolean> {
    if (!interaction.isButton() && !interaction.isChannelSelectMenu() && !interaction.isStringSelectMenu()) {
        return false;
    }

    const customId = interaction.customId;

    // 1. Botón principal de RETOS / Menú de opciones (Ranking y Mates)
    if (customId === 'lcs_menu_retos' || customId === 'lcs_retos_ranking') {
        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('lcs_retos_ranking_ver')
                    .setLabel('🏆 Ranking')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('lcs_retos_mates_crear')
                    .setLabel('📐 Retos de Mates')
                    .setStyle(ButtonStyle.Success)
            );

        await interaction.reply({ 
            content: '🎯 **Academia LCS - Menú Principal**\nSelecciona una opción:', 
            components: [row], 
            flags: [1 << 6] 
        });
        return true;
    }

    // 1.1 Mostrar el Ranking dinámico desde MongoDB
    if (customId === 'lcs_retos_ranking_ver') {
        try {
            const collection = await getRetosCollection();
            const ranking = await collection.find({}).sort({ puntos: -1 }).limit(10).toArray();

            let rankingTexto = '🏆 **Clasificación General - Academia LCS**\n\n';
            if (ranking.length === 0) {
                rankingTexto += 'ℹ️ Aún no hay participantes registrados. ¡Sé el primero en resolver un reto!';
            } else {
                rankingTexto += ranking.map((r, index) => {
                    const medalla = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🔹';
                    return `${medalla} **${index + 1}.** <@${r.userId}> - ⭐️ **${r.puntos}** puntos (Nivel ${r.puntos || 1})`;
                }).join('\n');
            }

            await interaction.reply({ 
                content: rankingTexto, 
                flags: [1 << 6] 
            });
        } catch (err: any) {
            console.error('❌ Error al consultar ranking en MongoDB:', err);
            await interaction.reply({
                content: `❌ Error de base de datos: ${err.message}`,
                flags: [1 << 6]
            });
        }
        return true;
    }

    // 2. Botón para iniciar Retos de Mates -> Despliega el selector de canales
    if (customId === 'lcs_retos_mates_crear') {
        const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('select_canal_reto_mates')
                .setPlaceholder('Selecciona el canal de Mates para enviar el reto')
                .addChannelTypes(ChannelType.GuildText)
                .setMinValues(1)
                .setMaxValues(1)
        );

        await interaction.reply({
            content: '📐 **Retos de Mates**\nSelecciona el canal de destino dentro de la categoría de Mates:',
            components: [row],
            flags: [1 << 6]
        });
        return true;
    }

    // 3. Capturar la selección del canal y lanzar el primer reto (Nivel 1)
    if (interaction.isChannelSelectMenu() && interaction.customId === 'select_canal_reto_mates') {
        const canalId = interaction.values[0];
        const canalMates = interaction.guild?.channels.cache.get(canalId) as TextChannel;

        if (!canalMates) {
            await interaction.reply({ content: '❌ No se pudo encontrar el canal seleccionado.', flags: [1 << 6] });
            return true;
        }

        const nivelInicial = 1; 
        const reto = generarRetoMates(nivelInicial);

        const rowOpciones = new ActionRowBuilder<ButtonBuilder>();
        reto.opciones.forEach((op, index) => {
            const customIdResp = `lcs_reto_resp_${op.esCorrecta ? 'si' : 'no'}_${index}`;
            rowOpciones.addComponents(
                new ButtonBuilder()
                    .setCustomId(customIdResp)
                    .setLabel(op.texto)
                    .setStyle(ButtonStyle.Primary)
            );
        });

        const mensajeReto = `🎯 **¡Nuevo Reto de Matemáticas!** (Nivel ${nivelInicial})\n\n📌 **${reto.pregunta}**`;

        await canalMates.send({
            content: mensajeReto,
            components: [rowOpciones]
        });

        await interaction.update({ 
            content: `✅ ¡Reto de Mates lanzado con éxito al canal <#${canalId}>!`, 
            components: [] 
        });
        return true;
    }

    // 🔄 Botón para continuar jugando tras un fallo
    if (customId === 'lcs_reto_reintentar') {
        let nivelActual = 1;
        try {
            const collection = await getRetosCollection();
            const usuarioDoc = await collection.findOne({ userId: interaction.user.id });
            if (usuarioDoc?.puntos) {
                nivelActual = usuarioDoc.puntos;
            }
        } catch (err) {
            console.error('Error al obtener nivel para reintentar:', err);
        }

        const nuevoReto = generarRetoMates(nivelActual);
        const rowNuevasOpciones = new ActionRowBuilder<ButtonBuilder>();
        nuevoReto.opciones.forEach((op, index) => {
            const customIdResp = `lcs_reto_resp_${op.esCorrecta ? 'si' : 'no'}_${index}`;
            rowNuevasOpciones.addComponents(
                new ButtonBuilder()
                    .setCustomId(customIdResp)
                    .setLabel(op.texto)
                    .setStyle(ButtonStyle.Primary)
            );
        });

        const canalActual = interaction.channel as TextChannel;
        if (canalActual) {
            await canalActual.send({
                content: `🎯 **¡Nuevo Reto de Matemáticas!** (Nivel ${nivelActual})\n\n📌 **${nuevoReto.pregunta}**`,
                components: [rowNuevasOpciones]
            });
        }

        await interaction.update({
            content: `${interaction.message.content}\n\n🔄 *Nuevo reto solicitado.*`,
            components: []
        });
        return true;
    }

    // 4. Capturar las respuestas de los botones y actualizar nivel por usuario en MongoDB
    if (customId.startsWith('lcs_reto_resp_')) {
        const partes = customId.split('_');
        const esCorrecta = partes[3] === 'si';
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
                const puntosTotales = usuarioDoc?.puntos || 1;
                siguienteNivel = puntosTotales; 

            } catch (err) {
                console.error('❌ Error al gestionar puntos/nivel en MongoDB:', err);
            }

            await interaction.update({
                content: `${interaction.message.content}\n\n🎉 **¡Respuesta Correcta de <@${userId}>! (+1 punto)** 🌟`,
                components: [rowDeshabilitada]
            });

            const nuevoReto = generarRetoMates(siguienteNivel);

            const rowNuevasOpciones = new ActionRowBuilder<ButtonBuilder>();
            nuevoReto.opciones.forEach((op, index) => {
                const customIdResp = `lcs_reto_resp_${op.esCorrecta ? 'si' : 'no'}_${index}`;
                rowNuevasOpciones.addComponents(
                    new ButtonBuilder()
                        .setCustomId(customIdResp)
                        .setLabel(op.texto)
                        .setStyle(ButtonStyle.Primary)
                );
            });

            const canalActual = interaction.channel as TextChannel;
            if (canalActual) {
                await canalActual.send({
                    content: `📈 **¡Nivel Superado por <@${userId}>! Subimos a dificultad personalizada:**\n\n🎯 **¡Nuevo Reto de Matemáticas!** (Nivel ${siguienteNivel})\n\n📌 **${nuevoReto.pregunta}**`,
                    components: [rowNuevasOpciones]
                });
            }

        } else {
            // Añadimos el botón de reintentar para que pueda seguir jugando tras fallar
            const rowReintentar = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('lcs_reto_reintentar')
                    .setLabel('🔄 ¡Intentar otro reto!')
                    .setStyle(ButtonStyle.Secondary)
            );

            await interaction.update({
                content: `${interaction.message.content}\n\n❌ **Vaya, <@${userId}>, esa no es. ¡No pasa nada, prueba con el siguiente!** 💪`,
                components: [rowDeshabilitada, rowReintentar]
            });
        }
        return true;
    }

    return false;
}
