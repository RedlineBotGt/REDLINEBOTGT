import { 
    ButtonInteraction, 
    ChannelSelectMenuInteraction, 
    RoleSelectMenuInteraction, 
    ActionRowBuilder, 
    ChannelSelectMenuBuilder, 
    RoleSelectMenuBuilder, 
    ChannelType, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} from 'discord.js';

// Memoria temporal por usuario para almacenar las selecciones pendientes
const veredictoSessions = new Map<string, { channelId?: string; roleId?: string }>();

// 1. Maneja el clic en el botón "Veredicto" del panel /dash
export async function handleDashVeredictoButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_veredicto') return false;

    // Inicializamos o reiniciamos la sesión del usuario
    veredictoSessions.set(interaction.user.id, {});

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('dash_select_verd_channel')
        .setPlaceholder('📢 1. Selecciona el canal para el veredicto...')
        .addChannelTypes(ChannelType.GuildText);

    const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId('dash_select_verd_role')
        .setPlaceholder('👥 2. Selecciona el rol a mencionar...');

    const row1 = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);
    const row2 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect);

    await interaction.reply({
        content: '⚖️ **Sistema de Veredictos:** Selecciona el canal y el rol correspondientes para continuar:',
        components: [row1, row2],
        ephemeral: true
    });

    return true;
}

// 2. Maneja la selección del canal
export async function handleDashVeredictoChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_select_verd_channel') return false;

    const channelId = interaction.values[0];
    let session = veredictoSessions.get(interaction.user.id) || {};
    session.channelId = channelId;
    veredictoSessions.set(interaction.user.id, session);

    // Si ya tenemos ambos datos, abrimos el modal; si no, actualizamos el mensaje
    if (session.channelId && session.roleId) {
        await abrirModalVeredicto(interaction, session.channelId, session.roleId);
        veredictoSessions.delete(interaction.user.id);
    } else {
        await interaction.update({ content: '✅ Canal seleccionado. Falta seleccionar el rol.', components: interaction.message.components });
    }

    return true;
}

// 3. Maneja la selección del rol
export async function handleDashVeredictoRoleSelect(interaction: RoleSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_select_verd_role') return false;

    const roleId = interaction.values[0];
    let session = veredictoSessions.get(interaction.user.id) || {};
    session.roleId = roleId;
    veredictoSessions.set(interaction.user.id, session);

    // Si ya tenemos ambos datos, abrimos el modal; si no, actualizamos el mensaje
    if (session.channelId && session.roleId) {
        await abrirModalVeredicto(interaction, session.channelId, session.roleId);
        veredictoSessions.delete(interaction.user.id);
    } else {
        await interaction.update({ content: '✅ Rol seleccionado. Falta seleccionar el canal.', components: interaction.message.components });
    }

    return true;
}

// Función auxiliar para desplegar el modal con los datos recopilados
async function abrirModalVeredicto(interaction: ChannelSelectMenuInteraction | RoleSelectMenuInteraction, channelId: string, roleId: string) {
    const modal = new ModalBuilder()
        .setCustomId(`modal_veredicto_${channelId}_${roleId}`)
        .setTitle('Formulario de Veredicto Oficial');

    const inputReportId = new TextInputBuilder()
        .setCustomId('input_verd_report_id')
        .setLabel('🆔 ID del Reporte')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 001')
        .setRequired(true);

    const inputReporta = new TextInputBuilder()
        .setCustomId('input_verd_reporta')
        .setLabel('Piloto que Reportó')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Nombre del denunciante')
        .setRequired(true);

    const inputDefendio = new TextInputBuilder()
        .setCustomId('input_verd_defendio')
        .setLabel('Piloto que Defendió')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Nombre del defendido')
        .setRequired(true);

    const inputResolucion = new TextInputBuilder()
        .setCustomId('input_verd_resolucion')
        .setLabel('Resolución')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Detalles de la decisión de los comisarios...')
        .setRequired(true);

    const inputSancion = new TextInputBuilder()
        .setCustomId('input_verd_sancion')
        .setLabel('Sanción / Medida aplicada')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: Sin sanción / 5 segundos')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputReportId),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputReporta),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputDefendio),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputResolucion),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputSancion)
    );

    await interaction.showModal(modal);
}
