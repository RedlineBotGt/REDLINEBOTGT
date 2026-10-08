import { 
    ButtonInteraction, 
    ChannelSelectMenuInteraction, 
    RoleSelectMenuInteraction, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
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

    // 3. Manejo de los botones del panel de Google Sheets
    if (customId.startsWith('sheets_')) {
        let titleHeader = '';
        let formattedText = '';

        try {
            if (customId === 'sheets_clasificacion') {
                titleHeader = '🏆 Clasificación General';
                const rawData = (await getSheetData('Tabla!B8:N25')) || [];

                const filteredData = rawData
                    .filter(row => row && row[0] !== undefined && String(row[0]).trim() !== '' && row[0] !== 'POS' && row[1] && String(row[1]).trim() !== '')
                    .map(row => [
                        String(row[0] || '').trim(), // Pos
                        String(row[1] || '').trim(), // Piloto
                        String(row[2] || '').trim(), // Coche/Num
                        String(row[12] || '0').trim() // Puntos (Columna N)
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
                titleHeader = '📋 Control de Asistencia';
                const rawData = (await getSheetData('Ingreso!AE4:AF20')) || [];

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
                titleHeader = '⚡ Vueltas Rápidas (VR)';
                const rawData = (await getSheetData('Tabla!B9:L25')) || [];

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
                titleHeader = '🎯 Pole Positions (PP)';
                const rawData = (await getSheetData('Tabla!B9:K25')) || [];

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

        // Mantener el estado previo del usuario (canal y rol seleccionados)
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
                embeds: [resultEmbed],
                components: [rowButtons, publishButtons, channelSelect, roleSelect]
            });
        } catch (err) {
            console.error('❌ Error al editar la respuesta del panel Sheets:', err);
        }
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
