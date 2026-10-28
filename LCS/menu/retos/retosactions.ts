import { 
    Interaction, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    TextChannel 
} from 'discord.js';
import { generarRetoMates } from './mates/mates';

const CANAL_MATES_ID = '1564998716740337795';

/**
 * Manejador exclusivo para las interacciones de Retos y Academia Discord
 */
export async function handleRetosInteraction(interaction: Interaction): Promise<boolean> {
    // 1. Manejo de Botones
    if (interaction.isButton()) {
        // Botón principal de RETOS en el menú
        if (interaction.customId === 'lcs_menu_retos') {
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

        // Botón de RETOS BD (Archivo y estadísticas)
        if (interaction.customId === 'lcs_menu_retos_bd') {
            await interaction.reply({ 
                content: '📚 **Base de Datos de Retos**\n*Próximamente: Histórico de aciertos, fallos y tablas mensuales/anuales de Leo.*', 
                ephemeral: true 
            });
            return true;
        }

        // Lanzar reto de Mates al canal específico
        if (interaction.customId === 'lcs_retos_mates_lanzar') {
            const canalMates = interaction.guild?.channels.cache.get(CANAL_MATES_ID) as TextChannel;
            if (!canalMates) {
                await interaction.reply({ content: '❌ No se pudo encontrar el canal de Mates configurado.', ephemeral: true });
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

            await canalMates.send({
                content: `🎯 **¡Nuevo Reto de Matemáticas!** (Nivel ${nivelActual} - 1º Primaria)\n\n📌 **${reto.pregunta}**`,
                components: [rowOpciones]
            });

            await interaction.reply({ 
                content: `✅ ¡Reto de Mates lanzado con éxito al canal <#${CANAL_MATES_ID}>!`, 
                ephemeral: true 
            });
            return true;
        }
    }

    return false;
}
