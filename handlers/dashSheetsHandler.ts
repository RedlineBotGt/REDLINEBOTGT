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
import { getSheetData } from '../utils/sheetsService';

// Almacén temporal en memoria para guardar el estado de la consulta por usuario
const userSheetState = new Map<string, { content: string; title: string; channelId?: string; roleId?: string }>();

export async function handleDashSheetsButton(interaction: ButtonInteraction) {
    if (!interaction.guild) return;

    const userId = interaction.user.id;
    const customId = interaction.customId;

    if (customId.startsWith('sheets_')) {
        // Evita errores si la interacción ya fue reconocida o diferida previamente
        if (!interaction.deferred && !interaction.replied) {
            try {
                await interaction.deferUpdate();
            } catch (err) {
                console.error('Error al diferir la actualización:', err);
            }
        }

        let titleHeader = '';
        let rawData: any[][] = [];
        let filteredData: any[][] = [];

        try {
            switch (customId) {
                case 'sheets_clasificacion':
                    titleHeader = '🏆 Clasificación General';
                    rawData = (await getSheetData('Tabla!B8:N25')) || [];
                    filteredData = rawData
                        .filter(row => row && row.length > 0 && (row[0] || row[1]))
                        .map(row => {
                            const colB = row[0] || ''; // POS
                            const colC = row[1] || ''; // PILOTO
                            const colD = row[2] || ''; // Nº
                            const colN = row[12] || ''; // PUNTOS (Columna N)
                            return [colB, colC, colD, '|', colN];
                        });
                    break;

                case 'sheets_asistencia':
                    titleHeader = '📋 Control de Asistencia';
                    rawData = (await getSheetData('Ingreso!AB4:AF20')) || [];
                    filteredData = rawData
                        .filter(row => row && row.length > 0 && row.some(cell => cell !== ''))
                        .map(row => {
                            const colAB = row[0] || '';
                            const colAC = row[1] || '';
                            const colAD = row[2] || '';
                            const colAE = row[3] || '';
                            const colAF = row[4] || '';
                            return [colAB, colAC, colAD, colAE, colAF].filter(val => val !== '');
                        })
                        .filter(row => row.length > 0);
                    break;

                case 'sheets_vr':
                    titleHeader = '⚡ Vueltas Rápidas (VR)';
                    rawData = (await getSheetData('Tabla!B9:L25')) || [];
                    filteredData = rawData
                        .filter(row => row && row.length > 0 && (row[0] || row[1]))
                        .map(row => {
                            const colB = row[0] || ''; // POS
                            const colC = row[1] || ''; // PILOTO
                            const colL = row[10] || ''; // VR (Columna L)
                            return [colB, colC, '|', colL];
                        });
                    break;

                case 'sheets_pp':
                    titleHeader = '🎯 Pole Positions (PP)';
                    rawData = (await getSheetData('Tabla!B9:K25')) || [];
                    filteredData = rawData
                        .filter(row => row && row.length > 0 && (row[0] || row[1]))
                        .map(row => {
                            const colB = row[0] || ''; // POS
                            const colC = row[1] || ''; // PILOTO
                            const colK = row[9] || ''; // PP (Columna K)
                            return [colB, colC, '|', colK];
                        });
                    break;
            }
        } catch (error) {
            console.error('Error al obtener datos de Google Sheets:', error);
            filteredData = [];
        }

        // Formatear los datos en tabla de texto plano para Discord
        let formattedText = '';
        if (filteredData.length > 0) {
            formattedText = '```text\n' + filteredData.map(row => row.join('\t')).join('\n') + '\n```';
        } else {
            formattedText = '```text\nNo se encontraron datos en el rango especificado.\n```';
        }

        // Mantener canal y rol si ya estaban seleccionados previamente
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
            console.error('Error al editar la respuesta:', err);
        }

    } else if (customId === 'pub_yes') {
        const state = userSheetState.get(userId);
        if (!state || !state.channelId) {
            const warningMsg = { content: '⚠️️ Por favor, selecciona primero un canal en el menú desplegable.', flags: MessageFlags.Ephemeral };
            if (interaction.deferred || interaction.replied) {
                return interaction.followUp(warningMsg);
            }
            return interaction.reply(warningMsg);
        }

        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
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

            await interaction.followUp({ content: '✅ ¡Datos publicados con éxito en el canal seleccionado!', flags: MessageFlags.Ephemeral });
        }

    } else if (customId === 'pub_no') {
        userSheetState.delete(userId);
        if (!interaction.deferred && !interaction.replied) {
            await interaction.update({ content: '❌ Consulta cerrada.', embeds: [], components: [] });
        } else {
            await interaction.editReply({ content: '❌ Consulta cerrada.', embeds: [], components: [] });
        }
    }
}

// Manejador seguro para la selección del canal
export async function handleSheetsChannelSelect(interaction: ChannelSelectMenuInteraction) {
    if (!interaction.guild) return;
    const userId = interaction.user.id;
    const channelId = interaction.values[0];

    const state = userSheetState.get(userId) || { content: '', title: '' };
    userSheetState.set(userId, { ...state, channelId });

    const replyOptions = { content: `📁 Canal seleccionado correctamente.`, flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) {
        return interaction.followUp(replyOptions);
    }
    return interaction.reply(replyOptions);
}

// Manejador seguro para la selección del rol
export async function handleSheetsRoleSelect(interaction: RoleSelectMenuInteraction) {
    if (!interaction.guild) return;
    const userId = interaction.user.id;
    const roleId = interaction.values[0];

    const state = userSheetState.get(userId) || { content: '', title: '' };
    userSheetState.set(userId, { ...state, roleId });

    const replyOptions = { content: `🔔 Rol seleccionado correctamente.`, flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) {
        return interaction.followUp(replyOptions);
    }
    return interaction.reply(replyOptions);
}
