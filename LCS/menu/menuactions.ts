import { 
    Interaction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ModalSubmitInteraction 
} from 'discord.js';
import { getAlarmasCollection } from '../alarma/alarmaworker';

const LCS_GUILD_ID = '1564967606295732304';

/**
 * Manejador de clics e interacciones del menú principal de LCS
 */
export async function handleMenuInteraction(interaction: Interaction): Promise<boolean> {
    if (interaction.guildId !== LCS_GUILD_ID) return false;

    // 1. Manejo de Botones del Menú
    if (interaction.isButton()) {
        if (interaction.customId === 'lcs_menu_alarma') {
            // Mostrar un Modal para crear una alarma directamente desde el panel
            const modal = new ModalBuilder()
                .setCustomId('lcs_modal_crear_alarma')
                .setTitle('⏰ Crear Nueva Alarma (LCS)');

            const horaInput = new TextInputBuilder()
                .setCustomId('alarma_hora')
                .setLabel('Hora (Formato 24h: HH:mm, ej: 14:30)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('14:30')
                .setRequired(true)
                .setMaxLength(5);

            const textoInput = new TextInputBuilder()
                .setCustomId('alarma_texto')
                .setLabel('Texto del mensaje a enviar')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Escribe aquí el aviso o mensaje de la alarma...')
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(horaInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(textoInput)
            );

            await interaction.showModal(modal);
            return true;
        } 
        else if (interaction.customId === 'lcs_menu_refrescar') {
            await interaction.reply({ 
                content: '🔄 Panel actualizado correctamente.', 
                ephemeral: true 
            });
            return true;
        }
    }

    // 2. Manejo del envío del Modal de Alarma
    if (interaction.isModalSubmit() && interaction.customId === 'lcs_modal_crear_alarma') {
        const hora = interaction.fields.getTextInputValue('alarma_hora').trim();
        const texto = interaction.fields.getTextInputValue('alarma_texto').trim();

        // Validar formato de hora básico (HH:mm)
        const regexHora = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!regexHora.test(hora)) {
            await interaction.reply({ 
                content: '❌ Formato de hora inválido. Utiliza estrictamente el formato **HH:mm** (ej: 09:30 o 22:15).', 
                ephemeral: true 
            });
            return true;
        }

        try {
            const collection = await getAlarmasCollection();
            await collection.insertOne({
                guildId: LCS_GUILD_ID,
                channelId: interaction.channelId, // Se enviará al canal donde estés usando el menú
                hora,
                texto,
                creadoPor: interaction.user.tag,
                activa: true
            });

            await interaction.reply({ 
                content: `✅ ¡Alarma programada con éxito para las **${hora}** en este canal!`, 
                ephemeral: true 
            });
        } catch (error) {
            console.error('❌ Error al guardar la alarma desde el menú:', error);
            await interaction.reply({ 
                content: '❌ Hubo un error al guardar la alarma en la base de datos.', 
                ephemeral: true 
            });
        }
        return true;
    }

    return false;
}
