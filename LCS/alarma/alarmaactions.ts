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

            // 2. Abrir Modal Ampliado para Crear Nueva Alarma (con opción de repetición)
            if (interaction.isButton() && interaction.customId === 'alarm_crear') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_crear_alarma')
                    .setTitle('Configurar Alarma Recurrente');

                const inputTitulo = new TextInputBuilder()
                    .setCustomId('input_titulo_alarma')
                    .setLabel('Título de la Alarma:')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Ej: Reto diario Mates')
                    .setRequired(true);

                const inputHora = new TextInputBuilder()
                    .setCustomId('input_hora_alarma')
                    .setLabel('Hora inicial (HH:MM formato 24h):')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('18:30')
                    .setRequired(true);

                const inputRecurrente = new TextInputBuilder()
                    .setCustomId('input_recurrente_alarma')
                    .setLabel('¿Recurrente? (SI / NO):')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('SI')
                    .setValue('NO')
                    .setRequired(true);

                const inputAvisos = new TextInputBuilder()
                    .setCustomId('input_avisos_alarma')
                    .setLabel('Número total de avisos (si es recurrente):')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Ej: 5 (déjalo en 1 si es única)')
                    .setValue('1')
                    .setRequired(true);

                const inputTexto = new TextInputBuilder()
                    .setCustomId('input_texto_alarma')
                    .setLabel('Mensaje a enviar:')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('¡Es la hora!')
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(inputTitulo),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(inputHora),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(inputRecurrente),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(inputAvisos),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(inputTexto)
                );

                await interaction.showModal(modal);
                return true;
            }

            // 3. Procesar el Modal ampliado y guardar en MongoDB con recurrencia
            if (interaction.isModalSubmit() && interaction.customId === 'modal_crear_alarma') {
                const titulo = interaction.fields.getTextInputValue('input_titulo_alarma');
                const hora = interaction.fields.getTextInputValue('input_hora_alarma');
                const esRecurrenteStr = interaction.fields.getTextInputValue('input_recurrente_alarma').trim().toUpperCase();
                const totalAvisosStr = interaction.fields.getTextInputValue('input_avisos_alarma').trim();
                const texto = interaction.fields.getTextInputValue('input_texto_alarma');

                const esRecurrente = esRecurrenteStr === 'SI' || esRecurrenteStr === 'SÍ';
                const totalAvisos = parseInt(totalAvisosStr) || 1;

                const collection = await getAlarmasCollection();
                await collection.insertOne({
                    guildId: interaction.guildId || '1564967606295732304',
                    channelId: interaction.channelId || '',
                    titulo: titulo,
                    dia: 'Diario',
                    hora: hora.trim(),
                    texto: texto,
                    creadoPor: interaction.user.id,
                    activa: true,
                    esRecurrente: esRecurrente,
                    totalAvisos: totalAvisos,
                    avisosRestantes: totalAvisos
                });

                await interaction.reply({
                    content: `✅ **Alarma guardada correctamente.**\n\n📌 **Título:** ${titulo}\n⏰ **Hora:** ${hora}\n🔄 **Recurrente:** ${esRecurrente ? `Sí (${totalAvisos} avisos)` : 'No (Única)'}\n💬 **Mensaje:** ${texto}`,
                    ephemeral: true
                });
                return true;
            }

            // 4. Listar Alarmas Activas (mostrando si son recurrentes)
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

                const lista = alarmas.map((a, i) => {
                    const tipo = a.esRecurrente ? `🔄 (Restan ${a.avisosRestantes} avisos)` : '⏱️ (Única)';
                    return `${i + 1}. ⏰ **${a.hora}** - *${a.titulo}* ${tipo}`;
                }).join('\n');

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
