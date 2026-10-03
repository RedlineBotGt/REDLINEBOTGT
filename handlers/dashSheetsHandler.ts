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

    if (customId.startsWith('sheets_')) {
        await interaction.deferUpdate();

        let titleHeader = '';
        
        // Consultamos la pestaña 'Tabla' en el rango B8:M25
        const rawData = await getSheetData('Tabla!B8:M25');

        switch (customId) {
            case 'sheets_clasificacion':
                titleHeader = '🏆 Clasificación General';
                break;
            case 'sheets_asistencia':
                titleHeader = '📋 Control de Asistencia';
                break;
            case 'sheets_vr':
                titleHeader = '⚡ Vueltas Rápidas (VR)';
                break;
            case 'sheets_pp':
                titleHeader = '🎯 Pole Positions (PP)';
                break;
        }

        // Filtramos las columnas para extraer solo B, C, D (índices 0, 1, 2) y K, L, M (índices 9, 10, 11)
        const filteredData = rawData.map(row => {
            const colB = row[0] || '';
            const colC = row[1] || '';
            const colD = row[2] || '';
            const colK = row[9] || '';
            const colL = row[10] || '';
            const colM = row[11] || '';
            return [colB, colC, colD, '|', colK, colL, colM];
        });

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

        await interaction.editReply({
            embeds: [resultEmbed],
            components: [rowButtons, publishButtons, channelSelect, roleSelect]
        });

    } else if (customId === 'pub_yes') {
        const state = userSheetState.get(userId);
        if (!state || !state.channelId) {
            return interaction.reply({ content: '⚠️ Por favor, selecciona primero un canal en el menú desplegable.', ephemeral: true });
        }

        await interaction.deferUpdate();

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

    } else if (customId === 'pub_no') {
        userSheetState.delete(userId);
        await interaction.update({ content: '❌ Consulta cerrada.', embeds: [], components: [] });
    }
}

// Manejador para la selección del canal donde se publicará el reporte
export async function handleSheetsChannelSelect(interaction: ChannelSelectMenuInteraction) {
    if (!interaction.guild) return;
    const userId = interaction.user.id;
    const channelId = interaction.values[0];

    const state = userSheetState.get(userId) || { content: '', title: '' };
    userSheetState.set(userId, { ...state, channelId });

    await interaction.reply({ content: `📁 Canal seleccionado correctamente.`, ephemeral: true });
}

// Manejador para la selección del rol que se mencionará
export async function handleSheetsRoleSelect(interaction: RoleSelectMenuInteraction) {
    if (!interaction.guild) return;
    const userId = interaction.user.id;
    const roleId = interaction.values[0];

    const state = userSheetState.get(userId) || { content: '', title: '' };
    userSheetState.set(userId, { ...state, roleId });

    await interaction.reply({ content: `🔔 Rol seleccionado correctamente.`, ephemeral: true });
}
