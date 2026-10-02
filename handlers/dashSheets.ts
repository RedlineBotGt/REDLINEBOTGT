import { 
    ChatInputCommandInteraction, 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    ChannelSelectMenuBuilder, 
    RoleSelectMenuBuilder, 
    ChannelType, 
    ComponentType,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} from 'discord.js';

// NOTA: Aquí importarías tu cliente o función para conectar con Google Sheets (ej. googleapis o gspread bridge)
// import { getSheetData } from '../services/sheetsService';

export const data = new SlashCommandBuilder()
    .setName('dashsheets')
    .setDescription('Panel interactivo de consulta y publicación de datos desde Google Sheets');

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
        return interaction.reply({ content: 'Este comando solo puede usarse en un servidor.', ephemeral: true });
    }

    const guildName = interaction.guild.name;
    const guildIcon = interaction.guild.iconURL({ dynamic: true }) || undefined;

    // 1. Embed del Panel Principal
    const mainEmbed = new EmbedBuilder()
        .setAuthor({ name: guildName, iconURL: guildIcon })
        .setTitle('📊 REDLINE GT — Panel Google Sheets')
        .setDescription('Selecciona una opción para consultar los datos actualizados de la hoja de cálculo:')
        .setColor(0x1b1b1b) // Estética oscura racing
        .setFooter({ text: 'REDLINE GT', iconURL: guildIcon });

    // 2. Botonera Principal (4 opciones)
    const rowButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('sheets_clasificacion')
            .setLabel('Clasificación')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🏆'),
        new ButtonBuilder()
            .setCustomId('sheets_asistencia')
            .setLabel('Asistencia')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📋'),
        new ButtonBuilder()
            .setCustomId('sheets_vr')
            .setLabel('VR')
            .setStyle(ButtonStyle.Success)
            .setEmoji('⚡'),
        new ButtonBuilder()
            .setCustomId('sheets_pp')
            .setLabel('PP')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🎯')
    );

    const response = await interaction.reply({
        embeds: [mainEmbed],
        components: [rowButtons],
        fetchReply: true
    });

    // 3. Collector para escuchar los clics de los botones principales
    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300_000 // 5 minutos de validez del panel
    });

    collector.on('collect, async (i) => {
        if (i.user.id !== interaction.user.id) {
            await i.reply({ content: 'Solo la persona que ejecutó el comando puede usar este panel.', ephemeral: true });
            return;
        }

        await i.deferUpdate();

        let dataContent = '';
        let titleHeader = '';

        // Simulación de lectura de datos según el botón pulsado (Aquí conectarás tus celdas/rangos del Sheet)
        switch (i.customId) {
            case 'sheets_clasificacion':
                titleHeader = '🏆 Clasificación General (Pilotos con puntos)';
                // TODO: const rawData = await getSheetData("Tablas de clasificación", "Rango_A_B");
                dataContent = '```text\nPos  Piloto         Ptos\n1    SRT Rui        45\n2    KSM Emilio     38\n3    TSr Astra      30\n```';
                break;
            case 'sheets_asistencia':
                titleHeader = '📋 Control de Asistencia';
                // TODO: const rawData = await getSheetData("Asistencia", "Rango_A_B");
                dataContent = '```text\nPiloto         Asistencias\nSRT Rui        5/5\nKSM Emilio     4/5\nTSr Astra      5/5\n```';
                break;
            case 'sheets_vr':
                titleHeader = '⚡ Vueltas Rápidas (VR)';
                // TODO: const rawData = await getSheetData("Resultados", "Columna_VR");
                dataContent = '```text\nPiloto         Total VR\nSRT Rui        2\nKSM Emilio     1\n```';
                break;
            case 'sheets_pp':
                titleHeader = '🎯 Pole Positions (PP)';
                // TODO: const rawData = await getSheetData("Resultados", "Columna_PP");
                dataContent = '```text\nPiloto         Total PP\nTSr Astra      2\nSRT Rui        1\n```';
                break;
        }

        // Embed con el resultado consultado
        const resultEmbed = new EmbedBuilder()
            .setAuthor({ name: guildName, iconURL: guildIcon })
            .setTitle(titleHeader)
            .setDescription(dataContent)
            .setColor(0x2b2b2b)
            .setFooter({ text: 'REDLINE GT', iconURL: guildIcon });

        // --- BLOQUE DE PUBLICACIÓN (Aparece al final de cualquier opción) ---
        
        // Fila 1: Botones de Publicación (Sí / No)
        const publishButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('pub_yes')
                .setLabel('Publicar: SÍ')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('pub_no')
                .setLabel('Publicar: NO')
                .setStyle(ButtonStyle.Secondary)
        );

        // Fila 2: Menú desplegable para seleccionar canal donde publicar
        const channelSelect = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('select_channel')
                .setPlaceholder('📁 ¿Dónde quieres publicar?')
                .addChannelTypes(ChannelType.GuildText)
        );

        // Fila 3: Menú desplegable para seleccionar rol a mencionar
        const roleSelect = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
            new RoleSelectMenuBuilder()
                .setCustomId('select_role')
                .setPlaceholder('🔔 ¿Quieres mencionar algún rol?')
        );

        // Actualizamos el mensaje con el resultado y los controles de publicación abajo
        await i.editReply({
            embeds: [resultEmbed],
            components: [rowButtons, publishButtons, channelSelect, roleSelect]
        });
    });
}
