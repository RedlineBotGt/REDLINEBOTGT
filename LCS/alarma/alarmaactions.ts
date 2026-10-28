import { 
    Interaction, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    ChannelSelectMenuBuilder,
    ChannelType,
    StringSelectMenuBuilder
} from 'discord.js';
import { getAlarmasCollection } from './alarmaworker';
import { ObjectId } from 'mongodb';

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
                        .setLabel('⚙️ Editar / Eliminar Alarmas')
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

           // 8. Menú de Edición / Eliminación (Listar alarmas con select menu optimizado)
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

                const options = alarmas.map((a) => {
                    // Buscar el nombre real del canal en el servidor
                    const channel = interaction.guild?.channels.cache.get(a.channelId);
                    const channelName = channel ? `#${channel.name}` : '#canal-desconocido';

                    // Calcular repeticiones restantes de forma clara
                    const repeticionesInfo = a.esRecurrente 
                        ? `🔄 Quedan ${a.avisosRestantes} envíos` 
                        : '⏱️ Alarma Única';

                    return {
                        label: `${a.titulo} (${a.hora})`,
                        description: `Canal: ${channelName} | ${repeticionesInfo}`,
                        value: a._id.toString()
                    };
                });

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('select_alarma_gestionar')
                    .setPlaceholder('Selecciona una alarma para editar o eliminar')
                    .addOptions(options);

                const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

                await interaction.reply({
                    content: '⚙️ **Selecciona la alarma que deseas gestionar:**',
                    components: [row],
                    ephemeral: true
                });
                return true;
            }


            // 9. Al seleccionar una alarma del menú desplegable -> Mostrar opciones (Editar / Borrar)
            if (interaction.isStringSelectMenu() && interaction.customId === 'select_alarma_gestionar') {
                const alarmId = interaction.values[0];

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`alarm_editar_${alarmId}`)
                        .setLabel('✏️ Editar Alarma')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`alarm_borrar_${alarmId}`)
                        .setLabel('🗑️ Eliminar Alarma')
                        .setStyle(ButtonStyle.Danger)
                );

                await interaction.update({
                    content: `🛠️ **¿Qué deseas hacer con esta alarma?**`,
                    components: [row]
                });
                return true;
            }

            // 10. Eliminar Alarma
            if (interaction.isButton() && interaction.customId.startsWith('alarm_borrar_')) {
                const alarmId = interaction.customId.replace('alarm_borrar_', '');

                const collection = await getAlarmasCollection();
                await collection.deleteOne({ _id: new ObjectId(alarmId) });

                await interaction.update({
                    content: `🗑️ **¡Alarma eliminada correctamente!**`,
                    components: []
                });
                return true;
            }

            // 11. Editar Alarma (Abrir modal con los datos actuales)
            if (interaction.isButton() && interaction.customId.startsWith('alarm_editar_')) {
                const alarmId = interaction.customId.replace('alarm_editar_', '');

                const collection = await getAlarmasCollection();
                const alarma = await collection.findOne({ _id: new ObjectId(alarmId) });

                if (!alarma) {
                    await interaction.reply({ content: '❌ No se encontró la alarma.', ephemeral: true });
                    return true;
                }

                const modal = new ModalBuilder()
                    .setCustomId(`modal_editar_alarma_${alarmId}`)
                    .setTitle('Editar Alarma');

                const inputTitulo = new TextInputBuilder()
                    .setCustomId('input_edit_titulo')
                    .setLabel('Título:')
                    .setStyle(TextInputStyle.Short)
                    .setValue(alarma.titulo)
                    .setRequired(true);

                const inputDia = new TextInputBuilder()
                    .setCustomId('input_edit_dia')
                    .setLabel('Día:')
                    .setStyle(TextInputStyle.Short)
                    .setValue(alarma.dia)
                    .setRequired(true);

                const inputHora = new TextInputBuilder()
                    .setCustomId('input_edit_hora')
                    .setLabel('Hora (HH:MM):')
                    .setStyle(TextInputStyle.Short)
                    .setValue(alarma.hora)
                    .setRequired(true);

                const inputTexto = new TextInputBuilder()
                    .setCustomId('input_edit_texto')
                    .setLabel('Texto del mensaje:')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(alarma.texto)
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

            // 12. Guardar cambios de la edición en MongoDB
            if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_editar_alarma_')) {
                const alarmId = interaction.customId.replace('modal_editar_alarma_', '');

                const titulo = interaction.fields.getTextInputValue('input_edit_titulo');
                const dia = interaction.fields.getTextInputValue('input_edit_dia');
                const hora = interaction.fields.getTextInputValue('input_edit_hora');
                const texto = interaction.fields.getTextInputValue('input_edit_texto');

                const collection = await getAlarmasCollection();
                await collection.updateOne(
                    { _id: new ObjectId(alarmId) },
                    { 
                        $set: { 
                            titulo: titulo, 
                            dia: dia, 
                            hora: hora.trim(), 
                            texto: texto 
                        } 
                    }
                );

                await interaction.reply({
                    content: `✅ **¡Alarma actualizada correctamente!**\n\n📌 **${titulo}** a las **${hora}** (${dia})`,
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
