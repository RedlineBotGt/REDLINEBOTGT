import { 
    ButtonInteraction, 
    StringSelectMenuInteraction,
    ChannelSelectMenuInteraction, 
    RoleSelectMenuInteraction, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder, 
    RoleSelectMenuBuilder, 
    ChannelType,
    MessageFlags 
} from 'discord.js';
import { getSheetData } from './sheetsService';

// Almacén temporal en memoria para guardar el estado de la consulta por usuario
const userSheetState = new Map<string, { content: string; title: string; channelId?: string; roleId?: string }>();

export async function handleDashSheetsButton(interaction: ButtonInteraction) {
    if (!interaction.guild) return;

    // ⚡ DEFERIR INMEDIATAMENTE PARA EVITAR EL TIMEOUT DE DISCORD (3s)
    if (!interaction.deferred && !interaction.replied) {
        try {
            await interaction.deferUpdate();
        } catch (err) {
            console.error('❌ Error al diferir la interacción:', err);
            return;
        }
    }

    const userId = interaction.user.id;
    const customId = interaction.customId;

    // 1. Manejo del botón Publicar: SÍ
    if (customId === 'pub_yes') {
        const state = userSheetState.get(userId);
        if (!state || !state.channelId) {
            return interaction.followUp({ 
                content: '⚠ Por favor, selecciona primero un canal en el menú desplegable.', 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        const targetChannel = await interaction.guild.channels.fetch(state.channelId);
        if (targetChannel && targetChannel.isTextBased()) {
            const roleMention = state.roleId ? `<@&${state.roleId}>` : '';
            const publishEmbed = new EmbedBuilder()
                .setTitle(state.title)
                .setDescription(state.content)
                .setColor(0x1b1b1b)
                .setFooter({ text: 'REDLINE GT', iconURL: interaction.guild.iconURL({ dynamic: true }) || undefined })
                .setTimestamp();

            await targetChannel.send({
                content: roleMention,
                embeds: [publishEmbed]
            });

            await interaction.followUp({ 
                content: '✅ ¡Datos publicados con éxito en el canal seleccionado!', 
                flags: [MessageFlags.Ephemeral] 
            });
        }
        return;
    }

    // 2. Manejo del botón Publicar: NO
    if (customId === 'pub_no') {
        userSheetState.delete(userId);
        return interaction.editReply({ content: '❌ Consulta cerrada.', embeds: [], components: [] });
    }

    // 3. Manejo especial del botón Jornada (despliega menú de selección J1 - J6)
    if (customId === 'sheets_jornada') {
        const selectJornada = new StringSelectMenuBuilder()
            .setCustomId('sheets_select_jornada')
            .setPlaceholder('🏁 Selecciona la Jornada que deseas consultar...');

        for (let i = 1; i <= 6; i++) {
            selectJornada.addOptions({
                label: `Jornada ${i}`,
                value: `${i}`,
                description: `Puntuaciones y resultados de la Jornada ${i}`
            });
        }

        const rowSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectJornada);

        await interaction.editReply({
            content: '🏎️ **Selecciona la Jornada que deseas consultar:**',
            components: [rowSelect]
        });
        return;
    }

    // 4. Manejo de los botones del panel de Google Sheets (Clasificación, Asistencia, VR, PP)
    if (customId.startsWith('sheets_')) {
        let titleHeader = '';
        let formattedText = '';

        try {
            if (customId === 'sheets_clasificacion') {
                titleHeader = '🏆 Clasificación General (T2)';
                const rawData = (await getSheetData('Tabla2!B8:N')) || [];

                const filteredData = rawData
                    .filter(row => row && row[0] !== undefined && String(row[0]).trim() !== '' && row[0] !== 'POS' && row[1] && String(row[1]).trim() !== '')
                    .map(row => [
                        String(row[0] || '').trim(), // Pos
                        String(row[1] || '').trim(), // Piloto
                        String(row[2] || '').trim(), // Coche/Num
                        String(row[12] || '0').trim() // Puntos totales (Columna N)
                    ]);

                if (filteredData.length > 0) {
                    const maxPos = Math.max(...filteredData.map(r => r[0].length), 2);
                    const maxPiloto = Math.max(...filteredData.map(r => r[1].length), 10);
                    const maxNum = Math.max(...filteredData.map(r => r[2].length), 4);

                    const lines = filteredData.map(r => {
                        const pos = r[0].padStart(maxPos, ' ');
                        const piloto = r[1].padEnd(maxPiloto, ' ');
                        const num = r[2].padEnd(maxNum, ' ');
                        const pts = r[3].padStart(4, ' ');
                        return `${pos} | ${piloto} ${num} | ${pts}`;
                    });
                    formattedText = '```text\n' + lines.join('\n') + '\n```';
                }
            } 
            else if (customId === 'sheets_asistencia') {
                titleHeader = '📋 Control de Asistencia (T2)';
                const rawData = (await getSheetData('Ingreso2!AG2:AH')) || [];

                const filteredData = rawData
                    .filter(row => row && row[0] !== undefined && String(row[0]).trim() !== '' && row[0] !== 'PILOTO' && row[1] !== undefined && String(row[1]).trim() !== '')
                    .map(row => [
                        String(row[0] || '').trim(), // Piloto
                        String(row[1] || '').trim()  // Asistencias
                    ]);

                if (filteredData.length > 0) {
                    const maxPiloto = Math.max(...filteredData.map(r => r[0].length), 10);

                    const lines = filteredData.map(r => {
                        const piloto = r[0].padEnd(maxPiloto, ' ');
                        const asis = r[1].padStart(3, ' ');
                        return `${piloto} | ${asis}`;
                    });
                    formattedText = '```text\n' + lines.join('\n') + '\n```';
                }
            } 
            else if (customId === 'sheets_vr') {
                titleHeader = '⚡ Vueltas Rápidas (VR) (T2)';
                const rawData = (await getSheetData('Tabla2!B9:L')) || [];

                const filteredData = rawData
                    .filter(row => row && row[0] !== undefined && String(row[0]).trim() !== '' && row[1] && String(row[1]).trim() !== '')
                    .map(row => [
                        String(row[0] || '').trim(), // Pos
                        String(row[1] || '').trim(), // Piloto
                        String(row[10] || '').trim() // VR (Columna L)
                    ]);

                if (filteredData.length > 0) {
                    const maxPos = Math.max(...filteredData.map(r => r[0].length), 2);
                    const maxPiloto = Math.max(...filteredData.map(r => r[1].length), 10);

                    const lines = filteredData.map(r => {
                        const pos = r[0].padStart(maxPos, ' ');
                        const piloto = r[1].padEnd(maxPiloto, ' ');
                        const vr = r[2];
                        return `${pos} | ${piloto} | ${vr}`;
                    });
                    formattedText = '```text\n' + lines.join('\n') + '\n```';
                }
            } 
            else if (customId === 'sheets_pp') {
                titleHeader = '🎯 Pole Positions (PP) (T2)';
                const rawData = (await getSheetData('Tabla2!B9:K')) || [];

                const filteredData = rawData
                    .filter(row => row && row[0] !== undefined && String(row[0]).trim() !== '' && row[1] && String(row[1]).trim() !== '')
                    .map(row => [
                        String(row[0] || '').trim(), // Pos
                        String(row[1] || '').trim(), // Piloto
                        String(row[9] || '').trim()  // PP (Columna K)
                    ]);

                if (filteredData.length > 0) {
                    const maxPos = Math.max(...filteredData.map(r => r[0].length), 2);
                    const maxPiloto = Math.max(...filteredData.map(r => r[1].length), 10);

                    const lines = filteredData.map(r => {
                        const pos = r[0].padStart(maxPos, ' ');
                        const piloto = r[1].padEnd(maxPiloto, ' ');
                        const pp = r[2];
                        return `${pos} | ${piloto} | ${pp}`;
                    });
                    formattedText = '```text\n' + lines.join('\n') + '\n```';
                }
            }
        } catch (error) {
            console.error('❌ Error al procesar los datos de Google Sheets:', error);
            formattedText = '```text\nError al cargar los datos.\n```';
        }

        if (!formattedText) {
            formattedText = '```text\nNo se encontraron datos en el rango especificado.\n```';
        }

        actualizarPanelRespuesta(interaction, userId, titleHeader, formattedText);
    }
}

// 🛡️ Manejador seguro para la selección de la jornada (J1 a J6)
export async function handleSheetsJornadaSelect(interaction: StringSelectMenuInteraction) {
    if (!interaction.guild) return;

    if (!interaction.deferred && !interaction.replied) {
        try {
            await interaction.deferUpdate();
        } catch (err) {
            console.error('❌ Error al diferir selección de jornada:', err);
            return;
        }
    }

    const userId = interaction.user.id;
    const numJornada = parseInt(interaction.values[0], 10);

    // Cálculo dinámico de celdas por Jornada en Tabla2 (P:Q)
    // J1: P22:Q40 | J2: P64:Q82 | J3: P106:Q124 | J4: P148:Q166 | J5: P190:Q208 | J6: P232:Q250
    const startRow = 22 + (numJornada - 1) * 42;
    const endRow = startRow + 18;
    const range = `Tabla2!P${startRow}:Q${endRow}`;

    let titleHeader = `🏎️ Puntuación — Jornada ${numJornada} (T2)`;
    let formattedText = '';

    try {
        const rawData = (await getSheetData(range)) || [];

        const filteredData = rawData
            .filter(row => row && row[0] !== undefined && String(row[0]).trim() !== '' && row[1] !== undefined && String(row[1]).trim() !== '')
            .map(row => [
                String(row[0] || '').trim(), // Piloto (Columna P)
                String(row[1] || '0').trim()  // Puntos (Columna Q)
            ]);

        if (filteredData.length > 0) {
            const maxPiloto = Math.max(...filteredData.map(r => r[0].length), 10);

            const lines = filteredData.map((r, idx) => {
                const pos = String(idx + 1).padStart(2, ' ');
                const piloto = r[0].padEnd(maxPiloto, ' ');
                const pts = r[1].padStart(3, ' ');
                return `${pos} | ${piloto} | ${pts} pts`;
            });
            formattedText = '```text\n' + lines.join('\n') + '\n```';
        }
    } catch (error) {
        console.error(`❌ Error al leer la Jornada ${numJornada}:`, error);
        formattedText = '```text\nError al cargar los datos de la jornada.\n```';
    }

    if (!formattedText) {
        formattedText = '```text\nNo hay datos registrados para esta jornada.\n```';
    }

    actualizarPanelRespuesta(interaction, userId, titleHeader, formattedText);
}

// Función auxiliar para renderizar el embed con botones, canales y roles
async function actualizarPanelRespuesta(interaction: any, userId: string, titleHeader: string, formattedText: string) {
    const currentState = userSheetState.get(userId) || { content: '', title: '' };
    userSheetState.set(userId, { 
        content: formattedText, 
        title: titleHeader, 
        channelId: currentState.channelId, 
        roleId: currentState.roleId 
    });

    const resultEmbed = new EmbedBuilder()
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL({ dynamic: true }) || undefined })
        .setTitle(titleHeader)
        .setDescription(formattedText)
        .setColor(0x2b2b2b)
        .setFooter({ text: 'REDLINE GT', iconURL: interaction.guild.iconURL({ dynamic: true }) || undefined });

    const rowButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('sheets_clasificacion').setLabel('Clasificación').setStyle(ButtonStyle.Primary).setEmoji('🏆'),
        new ButtonBuilder().setCustomId('sheets_jornada').setLabel('Jornada').setStyle(ButtonStyle.Primary).setEmoji('🏎️'),
        new ButtonBuilder().setCustomId('sheets_asistencia').setLabel('Asistencia').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
        new ButtonBuilder().setCustomId('sheets_vr').setLabel('VR').setStyle(ButtonStyle.Success).setEmoji('⚡'),
        new ButtonBuilder().setCustomId('sheets_pp').setLabel('PP').setStyle(ButtonStyle.Danger).setEmoji('🎯')
    );

    const publishButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('pub_yes').setLabel('Publicar: SÍ').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('pub_no').setLabel('Publicar: NO').setStyle(ButtonStyle.Secondary)
    );

    const channelSelect = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('sheets_select_channel')
            .setPlaceholder('📁 ¿Dónde quieres publicar?')
            .addChannelTypes(ChannelType.GuildText)
    );

    const roleSelect = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId('sheets_select_role')
            .setPlaceholder('🔔 ¿Quieres mencionar algún rol?')
    );

    try {
        await interaction.editReply({
            content: null,
            embeds: [resultEmbed],
            components: [rowButtons, publishButtons, channelSelect, roleSelect]
        });
    } catch (err) {
        console.error('❌ Error al editar la respuesta del panel Sheets:', err);
    }
}

// 🛡️ Manejador seguro para la selección del canal
export async function handleSheetsChannelSelect(interaction: ChannelSelectMenuInteraction) {
    if (!interaction.guild) return;

    if (!interaction.deferred && !interaction.replied) {
        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        } catch (err) {
            console.error('❌ Error al diferir la interacción del canal:', err);
            return;
        }
    }

    try {
        const userId = interaction.user.id;
        const channelId = interaction.values[0];

        const state = userSheetState.get(userId) || { content: '', title: '' };
        userSheetState.set(userId, { ...state, channelId });

        await interaction.editReply({ content: '📁 Canal seleccionado correctamente.' });
    } catch (err) {
        console.error('❌ Error al seleccionar el canal:', err);
    }
}

// 🛡️ Manejador seguro para la selección del rol
export async function handleSheetsRoleSelect(interaction: RoleSelectMenuInteraction) {
    if (!interaction.guild) return;

    if (!interaction.deferred && !interaction.replied) {
        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        } catch (err) {
            console.error('❌ Error al diferir la interacción del rol:', err);
            return;
        }
    }

    try {
        const userId = interaction.user.id;
        const roleId = interaction.values[0];

        const state = userSheetState.get(userId) || { content: '', title: '' };
        userSheetState.set(userId, { ...state, roleId });

        await interaction.editReply({ content: '🔔 Rol seleccionado correctamente.' });
    } catch (err) {
        console.error('❌ Error al seleccionar el rol:', err);
    }
}
