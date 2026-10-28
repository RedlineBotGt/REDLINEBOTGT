import { 
    Interaction, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    ChannelSelectMenuBuilder,
    ChannelType
} from 'discord.js';
import { getAlarmasCollection } from './alarmaworker';

/**
 * Manejador de interacciones para el sistema de Alarmas de LCS.
 */
export async function handleAlarmaInteraction(interaction: Interaction): Promise<boolean> {
    if (!interaction.isChatInputCommand() && !interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu() && !interaction.isChannelSelectMenu()) {
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

            // 2. Paso 1: Seleccionar canal donde se enviará la alarma
            if (interaction.isButton() && interaction.customId === 'alarm_crear') {
                const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                    new ChannelSelectMenuBuilder()
                        .setCustomId('select_canal_alarma')
                        .setPlaceholder('Selecciona el canal para la alarma')
                        .addChannelTypes(ChannelType.GuildText)
                        .setMinValues(1)
                        .setMaxValues(1)
                );

                await interaction.reply({
                    content: '📍 **Paso 1/2:** Selecciona el canal de texto donde quieres que el bot envíe esta alarma:',
                    components: [row],
                    ephemeral: true
                });
                return true;
            }

            // 3. Paso 2: Al seleccionar el canal, abrir el modal con Título, Día, Hora y Texto
            if (interaction.isChannelSelectMenu() && interaction.customId === 'select_canal_alarma') {
                const channelId = interaction.values[0];

                const modal = new ModalBuilder()
                    .setCustomId(`modal_alarma_datos_${channelId}`)
                    .setTitle('Configurar Nueva Alarma');

                const inputTitulo = new TextInputBuilder()
                    .setCustomId('input_titulo_alarma')
                    .setLabel('Título:')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Ej: Reto de Mates')
                    .setRequired(true);

                const inputDia = new TextInputBuilder()
                    .setCustomId('input_dia_alarma')
                    .setLabel('Día:')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Ej: Lunes / Todos / Diario')
                    .setRequired(true);

                const inputHora = new TextInputBuilder()
                    .setCustomId('input_hora_alarma')
                    .setLabel('Hora (HH:MM):')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('18:30')
                    .setRequired(true);

                const inputTexto = new TextInputBuilder()
                    .setCustomId('input_texto_alarma')
                    .setLabel('Texto del mensaje:')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Mensaje que enviará el bot...')
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(inputTitulo),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(inputDia),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(inputHora),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(inputTexto)
                );

                await interaction.showModal(modal);
                return true;
            }

            // 4. Procesar los datos iniciales y preguntar si desea repetir
            if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_alarma_datos_')) {
                const channelId = interaction.customId.replace('modal_alarma_datos_', '');
                const titulo = interaction.fields.getTextInputValue('input_titulo_alarma');
                const dia = interaction.fields.getTextInputValue('input_dia_alarma');
                const hora = interaction.fields.getTextInputValue('input_hora_alarma');
                const texto = interaction.fields.getTextInputValue('input_texto_alarma');

                // Guardamos temporalmente o pasamos los datos mediante botones de repetición (Sí / No)
                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`alarm_rep_si_${channelId}_${encodeURIComponent(titulo)}_${encodeURIComponent(dia)}_${hora}_${encodeURIComponent(texto)}`)
                        .setLabel('Sí, configurar repetición')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`alarm_rep_no_${channelId}_${encodeURIComponent(titulo)}_${encodeURIComponent(dia)}_${hora}_${encodeURIComponent(texto)}`)
                        .setLabel('No, guardar única')
                        .setStyle(ButtonStyle.Secondary)
                );

                await interaction.reply({
                    content: `📌 **Datos guardados:**\n• **Título:** ${titulo}\n• **Día:** ${dia}\n• **Hora:** ${hora}\n\n🔄 **¿Quieres que esta alarma se repita?**`,
                    components: [row],
                    ephemeral: true
                });
                return true;
            }

            // 5. Si elige NO repetir -> Se guarda directamente en MongoDB
            if (interaction.isButton() && interaction.customId.startsWith('alarm_rep_no_')) {
                const partes = interaction.customId.replace('alarm_rep_no_', '').split('_');
                const channelId = partes[0];
                const titulo = decodeURIComponent(partes[1]);
                const dia = decodeURIComponent(partes[2]);
                const hora = partes[3];
                const texto = decodeURIComponent(partes[4]);

                const collection = await getAlarmasCollection();
                await collection.insertOne({
                    guildId: interaction.guildId || '1564967606295732304',
                    channelId: channelId,
                    titulo: titulo,
                    dia: dia,
                    hora: hora.trim(),
                    texto: texto,
                    creadoPor: interaction.user.id,
                    activa: true,
                    esRecurrente: false,
                    totalAvisos: 1,
                    avisosRestantes: 1
                });

                await interaction.update({
                    content: `✅ **¡Alarma única creada con éxito!**\n\n📌 **${titulo}** a las **${hora}** en <#${channelId}>`,
                    components: []
                });
                return true;
            }

            // 6. Si elige SÍ repetir -> Abrir modal de repetición (horas, días, total envíos)
            if (interaction.isButton() && interaction.customId.startsWith('alarm_rep_si_')) {
                const datosOriginales = interaction.customId.replace('alarm_rep_si_', '');

                const modal = new ModalBuilder()
                    .setCustomId(`modal_alarma_repeticion_${datosOriginales}`)
                    .setTitle('Configurar Repetición');

                const inputHoras = new TextInputBuilder()
                    .setCustomId('input_rep_horas')
                    .setLabel('¿Cuántas horas de intervalo? (Opcional):')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Ej: 2 (déjalo vacío si no aplica)')
                    .setRequired(false);

                const inputDias = new TextInputBuilder()
                    .setCustomId('input_rep_dias')
                    .setLabel('¿Cuántos días de intervalo? (Opcional):')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Ej: 1 (déjalo vacío si no aplica)')
                    .setRequired(false);

                const inputTotal = new TextInputBuilder()
                    .setCustomId('input_rep_total')
                    .setLabel('Total de envíos (Obligatorio):')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Ej: 5')
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(inputHoras),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(inputDias),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(inputTotal)
                );

                await interaction.showModal(modal);
                return true;
            }

            // 7. Procesar el modal final de repetición y guardar en MongoDB
            if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_alarma_repeticion_')) {
                const datosOriginales = interaction.customId.replace('modal_alarma_repeticion_', '');
                const partes = datosOriginales.split('_');
                const channelId = partes[0];
                const titulo = decodeURIComponent(partes[1]);
                const dia = decodeURIComponent(partes[2]);
                const hora = partes[3];
                const texto = decodeURIComponent(partes[4]);

                const horasIntervaloStr = interaction.fields.getTextInputValue('input_rep_horas').trim();
                const diasIntervaloStr = interaction.fields.getTextInputValue('input_rep_dias').trim();
                const totalAvisosStr = interaction.fields.getTextInputValue('input_rep_total').trim();

                const horasIntervalo = horasIntervaloStr ? parseInt(horasIntervaloStr) : undefined;
                const diasIntervalo = diasIntervaloStr ? parseInt(diasIntervaloStr) : undefined;
                const totalAvisos = parseInt(totalAvisosStr) || 1;

                const collection = await getAlarmasCollection();
                await collection.insertOne({
                    guildId: interaction.guildId || '1564967606295732304',
                    channelId: channelId,
                    titulo: titulo,
                    dia: dia,
                    hora: hora.trim(),
                    texto: texto,
                    creadoPor: interaction.user.id,
                    activa: true,
                    esRecurrente: true,
                    horasIntervalo: horasIntervalo,
                    diasIntervalo: diasIntervalo,
                    totalAvisos: totalAvisos,
                    avisosRestantes: totalAvisos
                });

                await interaction.reply({
                    content: `✅ **¡Alarma recurrente creada con éxito!**\n\n📌 **${titulo}** a las **${hora}** (${totalAvisos} envíos)`,
                    ephemeral: true
                });
                return true;
            }

            // 8. Listar Alarmas Activas
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
                    const rep = a.esRecurrente ? `🔄 (${a.avisosRestantes} envíos restantes)` : '⏱️ (Única)';
                    return `${i + 1}. ⏰ **${a.hora}** [${a.dia}] - *${a.titulo}* ${rep} -> <#${a.channelId}>`;
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
