import { 
    ButtonInteraction, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    ChannelSelectMenuBuilder, 
    RoleSelectMenuBuilder, 
    ChannelType 
} from 'discord.js';
import { getSheetData } from '../services/sheetsService';

// Almacén temporal en memoria para guardar el estado de la consulta por usuario
const userSheetState = new Map<string, { content: string; title: string; channelId?: string; roleId?: string }>();

export async function handleDashSheetsButton(interaction: ButtonInteraction) {
    if (!interaction.guild) return;

    const userId = interaction.user.id;
    const customId = interaction.customId;

    if (customId.startsWith('sheets_')) {
        await interaction.deferUpdate();

        let titleHeader = '';
        let rawData: string[][] = [];

        // ⚠️ CAMBIA AQUÍ LOS NOMBRES DE TUS PESTAÑAS EXACTAS DE GOOGLE SHEETS
        switch (customId) {
            case 'sheets_clasificacion':
                titleHeader = '🏆 Clasificación General';
                rawData = await getSheetData('Clasificación!A1:C20'); 
                break;
            case 'sheets_asistencia':
                titleHeader = '📋 Control de Asistencia';
                rawData = await getSheetData('Asistencia!A1:B20');
                break;
            case 'sheets_vr':
                titleHeader = '⚡ Vueltas Rápidas (VR)';
                rawData = await getSheetData('VR!A1:B20');
                break;
            case 'sheets_pp':
                titleHeader = '🎯 Pole Positions (PP)';
                rawData = await getSheetData('PP!A1:B20');
                break;
        }

        // Formatear los datos en tabla de texto plano para Discord
        let formattedText = '';
        if (rawData.length > 0) {
            formattedText = '```text\n' + rawData.map(row => row.join('\t')).join('\n') + '\n```';
        } else {
            formattedText = '```text\nNo se encontraron datos o la pestaña está vacía.\n```';
        }

        userSheetState.set(userId, { content: formattedText, title: titleHeader });

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
