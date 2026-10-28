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
            customId?.startsWith('modal_') ||
            customId?.startsWith('select_')
        ) {
            
            // 1. Clic en "Gestionar Alarmas"
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

            // 2. Paso 1: Elegir canal
            if (interaction.isButton() && interaction.customId === 'alarm_crear') {
                const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                    new ChannelSelectMenuBuilder()
                        .setCustomId('select_canal_alarma')
                        .setPlaceholder('Selecciona el canal destino')
                        .addChannelTypes(ChannelType.GuildText)
                        .setMinValues(1)
                        .setMaxValues(1)
                );

                await interaction.reply({
                    content: '📍 **Paso 1:** Selecciona el canal donde se enviará el aviso:',
                    components: [row],
                    ephemeral: true
                });
                return true;
            }

            // 3. Paso 2: Abrir Modal con Título, Día, Hora y Texto
            if (interaction.isChannelSelectMenu() && interaction.customId === 'select_canal_alarma') {
                const channelId = interaction.values[0];

                const modal = new ModalBuilder()
                    .setCustomId(`modal_alarma_datos_${channelId}`)
                    .setTitle('Datos de la Alarma');

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
                    .setPlaceholder('Ej: Lunes / Todos')
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
                    .setPlaceholder('¡Hora de practicar!')
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

            // 4. Preguntar si desea repetición
            if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_alarma_datos_')) {
                const channelId = interaction.customId.replace('modal_alarma_datos_', '');
                const titulo = interaction.fields.getTextInputValue('input_titulo_alarma');
                const dia = interaction.fields.getTextInputValue('input_dia_alarma');
                const hora = interaction.fields.getTextInputValue('input_hora_alarma');
                const texto = interaction.fields.getTextInputValue('input_texto_alarma');

                const payload = `${channelId}|${encodeURIComponent(titulo)}|${encodeURIComponent(dia)}|${hora}|${encodeURIComponent(texto)}`;

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`alarm_rep_si_${payload}`)
                        .setLabel('Sí, repetir')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`alarm_rep_no_${payload}`)
                        .setLabel('No, guardar única')
                        .setStyle(ButtonStyle.Secondary)
                );

                await interaction.reply({
                    content: `📌 **Datos recibidos:**\n• **Título:** ${titulo}\n• **Canal:** <#${channelId}>\n• **Día:** ${dia}\n• **Hora:** ${hora}\n\n🔄 **¿Quieres configurar repetición?**`,
                    components: [row],
                    ephemeral: true
                });
                return true;
            }

            // 5. Opción NO repetir -> Guarda directamente
            if (interaction.isButton() && interaction.customId.startsWith('alarm_rep_no_')) {
                const payload = interaction.customId.replace('alarm_rep_no_', '');
                const [channelId, rawTitulo, rawDia, hora, rawTexto] = payload.split('|');

                const collection = await getAlarmasCollection();
                await collection.insertOne({
                    guildId: interaction.guildId || '1564967606295732304',
                    channelId: channelId,
                    titulo: decodeURIComponent(rawTitulo),
                    dia: decodeURIComponent(rawDia),
                    hora: hora.trim(),
                    texto: decodeURIComponent(rawTexto),
                    creadoPor: interaction.user.id,
                    activa: true,
                    esRecurrente: false,
                    totalAvisos: 1,
                    avisosRestantes: 1
                });

                await interaction.update({
                    content: `✅ **Alarma única guardada con éxito.**`,
                    components: []
                });
                return true;
            }

            // 6. Opción SÍ repetir -> Modal con Intervalo horas, Días y Total envíos
            if (interaction.isButton() && interaction.customId.startsWith('alarm_rep_si_')) {
                const payload = interaction.customId.replace('alarm_rep_si_', '');

                const modal = new ModalBuilder()
                    .setCustomId(`modal_alarma_rep_${payload}`)
                    .setTitle('Ajustes de Repetición');

                const inputHoras = new TextInputBuilder()
                    .setCustomId('input_rep_horas')
                    .setLabel('Horas de intervalo (Opcional):')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Ej: 2')
                    .setRequired(false);

                const inputDias = new TextInputBuilder()
                    .setCustomId('input_rep_dias')
                    .setLabel('Días de intervalo (Opcional):')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Ej: 1')
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

            // 7. Guardar alarma recurrente
            if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_alarma_rep_')) {
                const payload = interaction.customId.replace('modal_alarma_rep_', '');
                const [channelId, rawTitulo, rawDia, hora, rawTexto] = payload.split('|');

                const horasStr = interaction.fields.getTextInputValue('input_rep_horas').trim();
                const diasStr = interaction.fields.getTextInputValue('input_rep_dias').trim();
                const totalStr = interaction.fields.getTextInputValue('input_rep_total').trim();

                const collection = await getAlarmasCollection();
                await collection.insertOne({
                    guildId: interaction.guildId || '1564967606295732304',
                    channelId: channelId,
                    titulo: decodeURIComponent(rawTitulo),
                    dia: decodeURIComponent(rawDia),
                    hora: hora.trim(),
                    texto: decodeURIComponent(rawTexto),
                    creadoPor: interaction.user.id,
                    activa: true,
                    esRecurrente: true,
                    horasIntervalo: horasStr ? parseInt(horasStr) : undefined,
                    diasIntervalo: diasStr ? parseInt(diasStr) : undefined,
                    totalAvisos: parseInt(totalStr) || 1,
                    avisosRestantes: parseInt(totalStr) || 1
                });

                await interaction.reply({
                    content: `✅ **Alarma recurrente guardada con éxito.** (${totalStr} envíos)`,
                    ephemeral: true
                });
                return true;
            }

            // 8. Listar Alarmas
            if (interaction.isButton() && interaction.customId === 'alarm_listar') {
                const collection = await getAlarmasCollection();
                const alarmas = await collection.find({ guildId: interaction.guildId, activa: true }).toArray();

                if (alarmas.length === 0) {
                    await interaction.reply({
                        content: 'ℹ️ No hay ninguna alarma activa registrada.',
                        ephemeral: true
                    });
                    return true;
                }

                const lista = alarmas.map((a, i) => {
                    const rep = a.esRecurrente ? `🔄 (${a.avisosRestantes} avisos restan)` : '⏱️ (Única)';
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
        console.error('❌ Error en el manejador de alarmas:', error);
        return false;
    }
}
