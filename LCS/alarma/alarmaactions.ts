import { 
    Interaction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder 
} from 'discord.js';
import { ObjectId } from 'mongodb';
import { getAlarmasCollection, AlarmaLCS } from '../../alarma/alarmaworker';

const LCS_GUILD_ID = '1564967606295732304';

/**
 * Manejador exclusivo para las interacciones de Alarmas
 */
export async function handleAlarmaInteraction(interaction: Interaction): Promise<boolean> {
    // 1. Manejo de Botones
    if (interaction.isButton()) {
        if (interaction.customId === 'lcs_menu_alarma') {
            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('lcs_alarma_crear_menu')
                        .setLabel('➕ Crear Alarma')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('lcs_alarma_editar_menu')
                        .setLabel('✏️ Editar / Gestionar Alarmas')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.reply({ 
                content: '⏰ **Gestión de Alarmas LCS**\n¿Qué acción deseas realizar?', 
                components: [row], 
                ephemeral: true 
            });
            return true;
        }

        if (interaction.customId === 'lcs_alarma_crear_menu') {
            const modal = new ModalBuilder()
                .setCustomId('lcs_modal_crear_alarma')
                .setTitle('⏰ Crear Nueva Alarma (LCS)');

            const tituloInput = new TextInputBuilder()
                .setCustomId('alarma_titulo')
                .setLabel('Título identificativo')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ej: Aviso de Rueda de Prensa')
                .setRequired(true)
                .setMaxLength(50);

            const canalInput = new TextInputBuilder()
                .setCustomId('alarma_canal')
                .setLabel('ID del Canal de Texto')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ej: 1564986136323956857')
                .setRequired(true)
                .setMaxLength(20);

            const diaInput = new TextInputBuilder()
                .setCustomId('alarma_dia')
                .setLabel('Día (Ej: Todos o 2026-11-01)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Todos')
                .setRequired(true)
                .setMaxLength(20);

            const horaInput = new TextInputBuilder()
                .setCustomId('alarma_hora')
                .setLabel('Hora (Formato 24h: HH:mm)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('14:30')
                .setRequired(true)
                .setMaxLength(5);

            const textoInput = new TextInputBuilder()
                .setCustomId('alarma_texto')
                .setLabel('Texto del mensaje')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Escribe aquí el contenido del aviso...')
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(tituloInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(canalInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(diaInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(horaInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(textoInput)
            );

            await interaction.showModal(modal);
            return true;
        }

        if (interaction.customId === 'lcs_alarma_editar_menu') {
            try {
                const collection = await getAlarmasCollection();
                const alarmas = await collection.find({ guildId: LCS_GUILD_ID }).toArray();

                if (alarmas.length === 0) {
                    await interaction.reply({ 
                        content: '❌ No hay ninguna alarma registrada actualmente.', 
                        ephemeral: true 
                    });
                    return true;
                }

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('lcs_select_editar_alarma')
                    .setPlaceholder('Selecciona una alarma para gestionar...')
                    .addOptions(
                        alarmas.map(a => {
                            let indicador = '';
                            if (a.esRecurrente && a.avisosRestantes !== undefined) {
                                indicador = `⏰${a.avisosRestantes} - `;
                            } else {
                                indicador = '⏰ [Única] - ';
                            }

                            const labelText = `${indicador}${a.titulo} (${a.hora})`;
                            return {
                                label: labelText.substring(0, 100),
                                description: `Canal: ${a.channelId} | Día: ${a.dia}`,
                                value: a._id.toString()
                            };
                        })
                    );

                const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

                await interaction.reply({ 
                    content: '📋 **Selecciona la alarma que deseas gestionar o eliminar:**', 
                    components: [row], 
                    ephemeral: true 
                });
            } catch (error) {
                console.error('❌ Error al cargar lista de alarmas para editar:', error);
                await interaction.reply({ content: '❌ Error al recuperar las alarmas.', ephemeral: true });
            }
            return true;
        }

        if (interaction.customId.startsWith('lcs_rep_si_')) {
            const alarmaId = interaction.customId.replace('lcs_rep_si_', '');
            
            const modal = new ModalBuilder()
                .setCustomId(`lcs_modal_repeticion_${alarmaId}`)
                .setTitle('🔄 Configurar Repetición de Alarma');

            const horasInput = new TextInputBuilder()
                .setCustomId('rep_horas')
                .setLabel('¿Cada cuántas horas? (Opcional)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ej: 4')
                .setRequired(false)
                .setMaxLength(3);

            const diasInput = new TextInputBuilder()
                .setCustomId('rep_dias')
                .setLabel('¿Cada cuántos días? (Opcional)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ej: 1')
                .setRequired(false)
                .setMaxLength(3);

            const totalInput = new TextInputBuilder()
                .setCustomId('rep_total')
                .setLabel('Número total de avisos (Obligatorio)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ej: 5')
                .setRequired(true)
                .setMaxLength(4);

            modal.addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(horasInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(diasInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(totalInput)
            );

            await interaction.showModal(modal);
            return true;
        }

        if (interaction.customId.startsWith('lcs_rep_no_')) {
            await interaction.update({ 
                content: '✅ ¡Alarma única programada con éxito y guardada correctamente!', 
                components: [] 
            });
            return true;
        }

        if (interaction.customId.startsWith('lcs_alarma_borrar_')) {
            const alarmaId = interaction.customId.replace('lcs_alarma_borrar_', '');
            try {
                const collection = await getAlarmasCollection();
                await collection.deleteOne({ _id: new ObjectId(alarmaId) });

                await interaction.update({ 
                    content: '🗑️ Alarma eliminada correctamente de la base de datos.', 
                    components: [] 
                });
            } catch (error) {
                console.error('❌ Error al borrar alarma:', error);
                await interaction.reply({ content: '❌ Hubo un error al eliminar la alarma.', ephemeral: true });
            }
            return true;
        }
    }

    // 2. Manejo de Menús Desplegables
    if (interaction.isStringSelectMenu() && interaction.customId === 'lcs_select_editar_alarma') {
        const alarmaId = interaction.values[0];
        try {
            const collection = await getAlarmasCollection();
            const alarma = await collection.findOne({ _id: new ObjectId(alarmaId) });

            if (!alarma) {
                await interaction.update({ content: '❌ La alarma seleccionada ya no existe.', components: [] });
                return true;
            }

            const textoRecurrente = alarma.esRecurrente && alarma.avisosRestantes !== undefined
                ? `Recurrente (Restantes: ⏰${alarma.avisosRestantes})`
                : 'Única (Sin repetición)';

            const infoTexto = `📌 **Título:** ${alarma.titulo}\n` +
                              `📍 **Canal ID:** <#${alarma.channelId}>\n` +
                              `📅 **Día:** ${alarma.dia}\n` +
                              `⏰ **Hora:** ${alarma.hora}\n` +
                              `🔄 **Tipo:** ${textoRecurrente}\n` +
                              `💬 **Texto:** ${alarma.texto}`;

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`lcs_alarma_borrar_${alarma._id.toString()}`)
                        .setLabel('🗑️ Eliminar Alarma')
                        .setStyle(ButtonStyle.Danger)
                );

            await interaction.update({ 
                content: `⚙️ **Gestión de Alarma:**\n\n${infoTexto}`, 
                components: [row] 
            });
        } catch (error) {
            console.error('❌ Error al procesar selección de alarma:', error);
            await interaction.reply({ content: '❌ Error al cargar los detalles de la alarma.', ephemeral: true });
        }
        return true;
    }

    // 3. Manejo de Modals
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'lcs_modal_crear_alarma') {
            const titulo = interaction.fields.getTextInputValue('alarma_titulo').trim();
            const channelId = interaction.fields.getTextInputValue('alarma_canal').trim();
            const dia = interaction.fields.getTextInputValue('alarma_dia').trim();
            const hora = interaction.fields.getTextInputValue('alarma_hora').trim();
            const texto = interaction.fields.getTextInputValue('alarma_texto').trim();

            const regexHora = /^([01]\d|2[0-3]):([0-5]\d)$/;
            if (!regexHora.test(hora)) {
                await interaction.reply({ 
                    content: '❌ Formato de hora inválido. Utiliza estrictamente **HH:mm** (ej: 14:30).', 
                    ephemeral: true 
                });
                return true;
            }

            try {
                const collection = await getAlarmasCollection();
                const nuevaAlarma: AlarmaLCS = {
                    guildId: LCS_GUILD_ID,
                    channelId,
                    titulo,
                    dia,
                    hora,
                    texto,
                    creadoPor: interaction.user.tag,
                    activa: true,
                    esRecurrente: false,
                    avisosRestantes: 1
                };

                const resultado = await collection.insertOne(nuevaAlarma);
                const alarmaId = resultado.insertedId.toString();

                const row = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`lcs_rep_si_${alarmaId}`)
                            .setLabel('Sí, repetir')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`lcs_rep_no_${alarmaId}`)
                            .setLabel('No, única vez')
                            .setStyle(ButtonStyle.Secondary)
                    );

                await interaction.reply({ 
                    content: `✅ **Alarma "${titulo}" guardada correctamente.**\n¿Deseas configurar una repetición periódica para esta alarma?`, 
                    components: [row], 
                    ephemeral: true 
                });
            } catch (error) {
                console.error('❌ Error al guardar la alarma base:', error);
                await interaction.reply({ 
                    content: '❌ Hubo un error al guardar la alarma en la base de datos.', 
                    ephemeral: true 
                });
            }
            return true;
        }

        if (interaction.customId.startsWith('lcs_modal_repeticion_')) {
            const alarmaId = interaction.customId.replace('lcs_modal_repeticion_', '');
            
            const horasStr = interaction.fields.getTextInputValue('rep_horas').trim();
            const diasStr = interaction.fields.getTextInputValue('rep_dias').trim();
            const totalStr = interaction.fields.getTextInputValue('rep_total').trim();

            const totalAvisos = parseInt(totalStr, 10);
            if (isNaN(totalAvisos) || totalAvisos <= 0) {
                await interaction.reply({ 
                    content: '❌ El número total de avisos debe ser un número válido mayor que 0.', 
                    ephemeral: true 
                });
                return true;
            }

            const horasIntervalo = horasStr ? parseInt(horasStr, 10) : undefined;
            const diasIntervalo = diasStr ? parseInt(diasStr, 10) : undefined;

            try {
                const collection = await getAlarmasCollection();
                await collection.updateOne(
                    { _id: new ObjectId(alarmaId) },
                    { 
                        $set: { 
                            esRecurrente: true,
                            horasIntervalo: isNaN(horasIntervalo!) ? undefined : horasIntervalo,
                            diasIntervalo: isNaN(diasIntervalo!) ? undefined : diasIntervalo,
                            totalAvisos,
                            avisosRestantes: totalAvisos
                        } 
                    }
                );

                await interaction.reply({ 
                    content: `✅ **¡Repetición configurada con éxito!**\nSe repetirá un total de **${totalAvisos}** veces.`, 
                    ephemeral: true 
                });
            } catch (error) {
                console.error('❌ Error al actualizar la repetición de la alarma:', error);
                await interaction.reply({ 
                    content: '❌ Hubo un error al guardar la configuración de repetición.', 
                    ephemeral: true 
                });
            }
            return true;
        }
    }

    return false;
}
