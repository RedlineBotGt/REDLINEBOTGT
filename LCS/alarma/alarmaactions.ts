import { 
    Interaction, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} from 'discord.js';
import { getAlarmasCollection } from './alarmaworker';

/**
 * Manejador de interacciones para el sistema de Alarmas de LCS.
 */
export async function handleAlarmaInteraction(interaction: Interaction): Promise<boolean> {
    if (!interaction.isChatInputCommand() && !interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) {
        return false;
    }

    try {
        const customId = interaction.isCommand() ? interaction.commandName : interaction.customId;

        // Comprobación amplia de cualquier interacción del módulo de alarmas
        if (
            customId === 'alarma' || 
            customId === 'lcs_menu_alarma' || 
            customId?.startsWith('alarm_') || 
            customId?.startsWith('modal_')
        ) {
            
            // 1. Clic en el botón principal del menú ("Gestionar Alarmas")
            if (interaction.isButton() && interaction.customId === 'lcs_menu_alarma') {
                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId('alarm_crear')
                        .setLabel('➕ Nueva Alarma')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('alarm_listar')
                        .setLabel('📋 Ver Alarmas Activas')
                        .setStyle(ButtonStyle.Primary)
                );

                await interaction.reply({
                    content: '⏰ **Gestión de Alarmas LCS**\n\n¿Qué acción deseas realizar?',
                    components: [row],
                    ephemeral: true
                });
                return true;
            }

            // 2. Abrir Modal para Crear Nueva Alarma
            if (interaction.isButton() && interaction.customId === 'alarm_crear') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_crear_alarma')
                    .setTitle('Configurar Nueva Alarma');

                const inputTitulo = new TextInputBuilder()
                    .setCustomId('input_titulo_alarma')
                    .setLabel('Título / Nombre de la Alarma:')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Ej: Recordatorio Mates')
                    .setRequired(true);

                const inputHora = new TextInputBuilder()
                    .setCustomId('input_hora_alarma')
                    .setLabel('Hora de ejecución (HH:MM formato 24h):')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('18:30')
                    .setRequired(true);

                const inputTexto = new TextInputBuilder()
                    .setCustomId('input_texto_alarma')
                    .setLabel('Mensaje a enviar:')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('¡Hora de hacer el reto de mates!')
                    .setRequired(true);

                const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(inputTitulo);
                const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(inputHora);
                const row3 = new ActionRowBuilder<TextInputBuilder>().addComponents(inputTexto);

                modal.addComponents(row1, row2, row3);
                await interaction.showModal(modal);
                return true;
            }

            // 3. Procesar el Modal enviado (Guardar alarma en MongoDB)
            if (interaction.isModalSubmit() && interaction.customId === 'modal_crear_alarma') {
                const titulo = interaction.fields.getTextInputValue('input_titulo_alarma');
                const hora = interaction.fields.getTextInputValue('input_hora_alarma');
                const texto = interaction.fields.getTextInputValue('input_texto_alarma');

                const collection = await getAlarmasCollection();
                await collection.insertOne({
                    guildId: interaction.guildId || '1564967606295732304',
                    channelId: interaction.channelId || '',
                    titulo: titulo,
                    dia: 'Diario',
                    hora: hora.trim(),
                    texto: texto,
                    creadoPor: interaction.user.id,
                    activa: true
                });

                await interaction.reply({
                    content: `✅ **Alarma guardada correctamente.**\n\n📌 **Título:** ${titulo}\n⏰ **Hora:** ${hora}\n💬 **Mensaje:** ${texto}`,
                    ephemeral: true
                });
                return true;
            }

            // 4. Listar Alarmas Activas
            if (interaction.isButton() && interaction.customId === 'alarm_listar') {
                const collection = await getAlarmasCollection();
                const alarmas = await collection.find({ guildId: interaction.guildId, activa: true }).toArray();

                if (alarmas.length === 0) {
                    await interaction.reply({
                        content: 'ℹ️ No hay ninguna alarma activa registrada actualmente.',
                        ephemeral: true
                    });
                    return true;
                }

                const lista = alarmas.map((a, i) => `${i + 1}. ⏰ **${a.hora}** - *${a.titulo}*`).join('\n');
                await interaction.reply({
                    content: `📋 **Alarmas Activas:**\n\n${lista}`,
                    ephemeral: true
                });
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error('❌ Error al manejar la interacción de alarma:', error);
        return false;
    }
}
