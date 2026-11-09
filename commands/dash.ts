import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits
} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('dash')
    .setDescription('Panel de Configuración y Administración')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({ content: '❌ Este comando solo se puede usar dentro de un servidor.', ephemeral: true });
        return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
            content: '❌ Este panel de configuración es **exclusivo para Administradores**.',
            ephemeral: true
        });
        return;
    }

    // Fila 1: Eventos
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_event_create').setLabel('Crear evento').setStyle(ButtonStyle.Primary).setEmoji('📅'),
        new ButtonBuilder().setCustomId('dash_btn_bd_eventos').setLabel('BD Eventos').setStyle(ButtonStyle.Success).setEmoji('🗂️')
    );

    // Fila 2: Formularios
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_crear_form').setLabel('Crear F').setStyle(ButtonStyle.Primary).setEmoji('➕'),
        new ButtonBuilder().setCustomId('dash_btn_editar_form').setLabel('Editar F').setStyle(ButtonStyle.Secondary).setEmoji('📝'),
        new ButtonBuilder().setCustomId('dash_btn_colocar_form').setLabel('Formulario').setStyle(ButtonStyle.Secondary).setEmoji('📋')
    );

    // Fila 3: Comunicación
    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_welcome_config').setLabel('Edit Hola/Adiós').setStyle(ButtonStyle.Secondary).setEmoji('👋'),
        new ButtonBuilder().setCustomId('dash_btn_avisos_config').setLabel('Configurar Avisos').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
        new ButtonBuilder().setCustomId('dash_btn_msn_mensaje').setLabel('Enviar mensaje').setStyle(ButtonStyle.Success).setEmoji('💬'),
        new ButtonBuilder().setCustomId('dash_btn_scheduled_msg').setLabel('Progr. Mensaje').setStyle(ButtonStyle.Success).setEmoji('⏰')
    );

    // Fila 4: Reportes
    const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_setup_reporte').setLabel('Editar Reporte').setStyle(ButtonStyle.Primary).setEmoji('🛡️'),
        new ButtonBuilder().setCustomId('dash_btn_setup_defensa').setLabel('Editar Defensa').setStyle(ButtonStyle.Secondary).setEmoji('⚖️'),
        new ButtonBuilder().setCustomId('dash_btn_veredicto').setLabel('Veredicto').setStyle(ButtonStyle.Danger).setEmoji('⚖️')
    );

    // Fila 5: Herramientas
    const row5 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_sorteo_create').setLabel('Crear Sorteo').setStyle(ButtonStyle.Success).setEmoji('🎁'),
        new ButtonBuilder().setCustomId('dash_btn_crear_boton').setLabel('Crear Botón').setStyle(ButtonStyle.Primary).setEmoji('🎟️'),
        new ButtonBuilder().setCustomId('rr_btn_create').setLabel('Reaction Role').setStyle(ButtonStyle.Primary).setEmoji('🎭'),
        new ButtonBuilder().setCustomId('dash_btn_encuesta_create').setLabel('Encuesta').setStyle(ButtonStyle.Primary).setEmoji('📊')
    );

    await interaction.reply({
        components: [row1, row2, row3, row4, row5],
        ephemeral: true
    });
}
