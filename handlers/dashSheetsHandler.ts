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
        let filteredData: any[][] = [];

        try {
            if (customId === 'sheets_clasificacion') {
                titleHeader = '🏆 Clasificación General';
                const rawData = (await getSheetData('Tabla!B8:N25')) || [];
                
                filteredData = rawData
                    .filter(row => row && row[0] !== undefined && row[0] !== '' && row[0] !== 'POS')
                    .map(row => {
                        const pos = row[0] || '';
                        const piloto = row[1] || '';
                        const num = row[2] || '';
                        const puntos = row[12] || ''; // Columna N
                        return [pos, piloto, num, '|', puntos];
                    });
            } 
            else if (customId === 'sheets_asistencia') {
                titleHeader = '📋 Control de Asistencia';
                const rawData = (await getSheetData('Ingreso!AE4:AF20')) || [];

                filteredData = rawData
                    .filter(row => row && row[0] !== undefined && row[0] !== '' && row[0] !== 'PILOTO')
                    .map(row => {
                        const piloto = row[0] || '';
                        const apariciones = row[1] || '';
                        return [piloto, '|', apariciones];
                    });
            } 
            else if (customId === 'sheets_vr') {
                titleHeader = '⚡ Vueltas Rápidas (VR)';
                const rawData = (await getSheetData('Tabla!B9:L25')) || [];

                filteredData = rawData
                    .filter(row => row && row[0] !== undefined && row[0] !== '')
                    .map(row => {
                        const pos = row[0] || '';
                        const piloto = row[1] || '';
                        const vr = row[10] || ''; // Columna L
                        return [pos, piloto, '|', vr];
                    });
            } 
            else if (customId === 'sheets_pp') {
                titleHeader = '🎯 Pole Positions (PP)';
                const rawData = (await getSheetData('Tabla!B9:K25')) || [];

                filteredData = rawData
                    .filter(row => row && row[0] !== undefined && row[0] !== '')
                    .map(row => {
                        const pos = row[0] || '';
                        const piloto = row[1] || '';
                        const pp = row[9] || ''; // Columna K
                        return [pos, piloto, '|', pp];
                    });
            }
        } catch (error) {
            console.error('❌ Error al procesar los datos de Google Sheets:', error);
            filteredData = [];
        }

        // Formatear los datos en tabla de texto plano para Discord
        let formattedText = '';
        if (filteredData.length > 0) {
            formattedText = '```text\n' + filteredData.map(row => row.join('\t')).join('\n') + '\n```';
        } else {
            formattedText = '```text\nNo se encontraron datos en el rango especificado.\n
