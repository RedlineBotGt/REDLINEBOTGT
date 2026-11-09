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

    // Discord permite un máximo de 5 filas. Se agrupan las secciones consecutivas
    // manteniendo el orden solicitado.
    // Fila 1: Hola/Adiós + avisos
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_welcome_config').setLabel('Edit Hola/Adiós').setStyle(ButtonStyle.Secondary).setEmoji('👋'),
        new ButtonBuilder().setCustomId('dash_btn_avisos_config').setLabel('Configurar Avisos').setStyle(ButtonStyle.Secondary).setEmoji('📋')
    );

    // Fila 2: Herramientas
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_sorteo_create').setLabel('Crear Sorteo').setStyle(ButtonStyle.Success).setEmoji('🎁'),
        new ButtonBuilder().setCustomId('dash_btn_crear_boton').setLabel('Crear Botón').setStyle(ButtonStyle.Success).setEmoji('🎟️'),
        new ButtonBuilder().setCustomId('rr_btn_create').setLabel('Reaction Role').setStyle(ButtonStyle.Primary).setEmoji('🎭'),
        new ButtonBuilder().setCustomId('dash_btn_encuesta_create').setLabel('Encuesta').setStyle(ButtonStyle.Primary).setEmoji('📊')
    );

    // Fila 3: Mensajes + edición de reportes/defensa
    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_msn_mensaje').setLabel('Enviar mensaje').setStyle(ButtonStyle.Success).setEmoji('💬'),
        new ButtonBuilder().setCustomId('dash_btn_scheduled_msg').setLabel('Progr. Mensaje').setStyle(ButtonStyle.Success).setEmoji('⏰'),
        new ButtonBuilder().setCustomId('dash_btn_setup_reporte').setLabel('Editar Reporte').setStyle(ButtonStyle.Primary).setEmoji('🛡️'),
        new ButtonBuilder().setCustomId('dash_btn_setup_defensa').setLabel('Editar Defensa').setStyle(ButtonStyle.Primary).setEmoji('⚖️')
    );

    // Fila 4: Veredicto + gestión de formularios
    const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_veredicto').setLabel('Enviar Veredicto').setStyle(ButtonStyle.Danger).setEmoji('⚖️'),
        new ButtonBuilder().setCustomId('dash_btn_crear_form').setLabel('Crear Form').setStyle(ButtonStyle.Primary).setEmoji('➕'),
        new ButtonBuilder().setCustomId('dash_btn_editar_form').setLabel('Editar Form').setStyle(ButtonStyle.Primary).setEmoji('📝')
    );

    // Fila 5: Colocar formulario + eventos
    const row5 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_colocar_form').setLabel('Colocar Formulario').setStyle(ButtonStyle.Danger).setEmoji('📋'),
        new ButtonBuilder().setCustomId('dash_btn_event_create').setLabel('Crear evento').setStyle(ButtonStyle.Success).setEmoji('📅'),
        new ButtonBuilder().setCustomId('dash_btn_bd_eventos').setLabel('BD Eventos').setStyle(ButtonStyle.Success).setEmoji('🗂️')
    );

    await interaction.reply({
        components: [row1, row2, row3, row4, row5],
        ephemeral: true
    });
}
