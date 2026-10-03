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
    ChannelType 
} from 'discord.js';
import { getSheetData } from '../utils/sheetsService';

// Almacén temporal en memoria para guardar el estado de la consulta por usuario
const userSheetState = new Map<string, { content: string; title: string; channelId?: string; roleId?: string }>();

export async function handleDashSheetsButton(interaction: ButtonInteraction) {
    if (!interaction.guild) return;

    const userId = interaction.user.id;
    const customId = interaction.customId;

    // 1. Manejo del botón Publicar: SÍ
    if (customId === 'pub_yes') {
        const state = userSheetState.get(userId);
        if (!state || !state.channelId) {
            const warningMsg = { content: '⚠️ Por favor, selecciona primero un canal en el menú desplegable.', ephemeral: true };
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

            await interaction.followUp({ content: '✅ ¡Datos publicados con éxito en el canal seleccionado!', ephemeral: true });
        }
        return;
    }

    // 2. Manejo del botón Publicar: NO
    if (customId === 'pub_no') {
        userSheetState.delete(userId);
        if (!interaction.deferred && !interaction.replied) {
            await interaction.update({ content: '❌ Consulta cerrada.', embeds: [], components: [] });
        } else {
            await interaction.editReply({ content: '❌ Consulta cerrada.', embeds: [], components: [] });
        }
        return;
    }

    // 3. Manejo de los botones del panel de Google Sheets
    if (customId.startsWith('sheets_')) {
        // Diferimos inmediatamente para evitar el timeout de 3 segundos de Discord
        if (!interaction.deferred && !interaction.replied) {
            try {
                await interaction.deferUpdate();
            } catch (err) {
                console.error('Error al diferir la actualización:', err);
                return;
            }
        }

        let titleHeader = '';
        let filteredData: any[][] = [];

        try {
            if (customId === 'sheets_clasificacion') {
                titleHeader = '🏆 Clasificación General';
                const rawData = (await getSheetData('Tabla!B8:N25')) || [];
                // Columna B (Pos), C (Piloto), D (Nº), N (Puntos - índice 12)
                filteredData = rawData
                    .filter(row => row && row.length > 0 && (row[0] || row[1]))
                    .map(row => [row[0] || '', row[1] || '', row[2] || '', '|', row[12] || '']);
            } 
            else if (customId === 'sheets_asistencia') {
                titleHeader = '📋 Control de Asistencia';
                const rawData = (await getSheetData('Ingreso!AB4:AF20')) || [];
                // AB, AC, AD descartadas; AE (índice 3 = Piloto) y AF (índice 4 = Apariciones)
                filteredData = rawData
                    .filter(row => row && row.length > 4 && (row[3] || row[4]))
                    .map(row => [row[3] || '', '|', row[4] || ''])
                    .filter(row => row[0] !== '');
            } 
            else if (customId === 'sheets_vr') {
                titleHeader = '⚡ Vueltas Rápidas (VR)';
                const rawData = (await getSheetData('Tabla!B9:L25')) || [];
                // B (Pos), C (Piloto), L (VR - índice 10)
                filteredData = rawData
                    .filter(row => row && row.length > 0 && (row[0] || row[1]))
                    .map(row => [row[0] || '', row[1] || '', '|', row[10] || '']);
            } 
            else if (customId === 'sheets_pp') {
                titleHeader = '🎯 Pole Positions (PP)';
                const rawData = (await getSheetData('Tabla!B9:K25')) || [];
                // B (Pos), C (Piloto), K (PP - índice 9)
                filteredData = rawData
                    .filter(row => row && row.length > 0 && (row[0] || row[1]))
                    .map(row => [row[0] || '', row[1] || '', '|', row[9] || '']);
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

        // Mantener canal y rol seleccionados previamente
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
            console.error('Error al editar la respuesta del panel Sheets:', err);
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

    await interaction.reply({ content: `📁 Canal seleccionado correctamente.`, ephemeral: true });
}

// Manejador seguro para la selección del rol
export async function handleSheetsRoleSelect(interaction: RoleSelectMenuInteraction) {
    if (!interaction.guild) return;
    const userId = interaction.user.id;
    const roleId = interaction.values[0];

    const state = userSheetState.get(userId) || { content: '', title: '' };
    userSheetState.set(userId, { ...state, roleId });

    await interaction.reply({ content: `🔔 Rol seleccionado correctamente.`, ephemeral: true });
}
