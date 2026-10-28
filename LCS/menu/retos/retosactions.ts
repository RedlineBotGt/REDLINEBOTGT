import { 
    Interaction, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    TextChannel,
    ComponentType 
} from 'discord.js';
import { generarRetoMates } from './mates/mates';

const CANAL_MATES_ID = '1564998716740337795';

/**
 * Manejador exclusivo para las interacciones de Retos y Academia Discord
 */
export async function handleRetosInteraction(interaction: Interaction): Promise<boolean> {
    if (!interaction.isButton()) {
        return false;
    }

    const customId = interaction.customId;

    // 1. Botón principal de RETOS en el menú
    if (customId === 'lcs_menu_retos') {
        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('lcs_retos_mates_lanzar')
                    .setLabel('📐 Lanzar Reto de Mates (Nivel 1)')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('lcs_retos_info')
                    .setLabel('📊 Ver Progreso / Niveles')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.reply({ 
            content: '🎯 **Academia Discord - Sección de Retos**\nSelecciona una opción para Leo:', 
            components: [row], 
            ephemeral: true 
        });
        return true;
    }

    // 2. Botón de Estadísticas / Progreso
    if (customId === 'lcs_retos_info') {
        // TODO: Conectar con MongoDB para sacar las estadísticas reales del usuario
        await interaction.reply({ 
            content: '📊 **Progreso de la Academia**\n\n🏆 **Clasificación actual:**\n1. Leo - ⭐️ 0 aciertos\n\n*(Próximamente más estadísticas detalladas)*', 
            ephemeral: true 
        });
        return true;
    }

    // 3. Lanzar reto de Mates al canal específico
    if (customId === 'lcs_retos_mates_lanzar' || customId === 'lcs_reto_siguiente') {
        const canalMates = interaction.guild?.channels.cache.get(CANAL_MATES_ID) as TextChannel;
        if (!canalMates) {
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({ content: '❌ No se pudo encontrar el canal de Mates configurado.', ephemeral: true });
            } else {
                await interaction.reply({ content: '❌ No se pudo encontrar el canal de Mates configurado.', ephemeral: true });
            }
            return true;
        }

        const nivelActual = 1; 
        const reto = generarRetoMates(nivelActual);

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

        const mensajeReto = `🎯 **¡Nuevo Reto de Matemáticas!** (Nivel ${nivelActual} - 1º Primaria)\n\n📌 **${reto.pregunta}**`;

        if (customId === 'lcs_reto_siguiente') {
            await interaction.update({
                content: `${mensajeReto}`,
                components: [rowOpciones]
            });
        } else {
            await canalMates.send({
                content: mensajeReto,
                components: [rowOpciones]
            });

            await interaction.reply({ 
                content: `✅ ¡Reto de Mates lanzado con éxito al canal <#${CANAL_MATES_ID}>!`, 
                ephemeral: true 
            });
        }
        return true;
    }

    // 4. Capturar las respuestas de los botones del reto de mates
    if (customId.startsWith('lcs_reto_resp_')) {
        const esCorrecta = customId.includes('_si_');
        const userId = interaction.user.id;

        // Deshabilitar los botones del mensaje actual para que no se pueda volver a pulsar
        const rowDeshabilitada = new ActionRowBuilder<ButtonBuilder>();
        interaction.message.components.forEach(row => {
            row.components.forEach(component => {
                if (component.type === ComponentType.Button) {
                    const button = ButtonBuilder.from(component);
                    button.setDisabled(true);
                    // Destacar visualmente la respuesta correcta e incorrecta
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
            // Botón para saltar directamente al siguiente reto
            const rowSiguiente = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('lcs_reto_siguiente')
                    .setLabel('➡️ ¡Siguiente Reto!')
                    .setStyle(ButtonStyle.Success)
            );

            await interaction.update({
                content: `${interaction.message.content}\n\n🎉 **¡Respuesta Correcta de <@${userId}>! ¡Muy bien hecho!** 🌟`,
                components: [rowDeshabilitada, rowSiguiente]
            });
        } else {
            await interaction.update({
                content: `${interaction.message.content}\n\n❌ **Vaya, <@${userId}>, esa no es. ¡Prueba otra vez o pide otro reto!** 💪`,
                components: [rowDeshabilitada]
            });
        }
        return true;
    }

    return false;
}
