import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
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

    const guildName = interaction.guild.name;

    const embed = new EmbedBuilder()
        .setColor(0x0055FF)
        .setTitle(`🏁 ${guildName} — Panel de Administración`)
        .setDescription('Configuración global del servidor. Exclusivo para administradores.')
        .addFields(
            { name: '👋 Bienvenidas', value: 'Configuración de saludos y despedidas.', inline: false },
            { name: '📋 Gestión de Formularios', value: 'Crear, editar o borrar estructuras de formularios.', inline: false },
            { name: '📢 Comunicaciones, Ajustes y Sorteos', value: 'Gestión de sorteos, mensajes programados, botones interactivos y roles por reacción.', inline: false },
            { name: '⚖️ Ajustes de Comisarios', value: 'Configurar plantillas de reportes y defensas.', inline: false },
            { name: '📋 Sistema de Avisos', value: 'Configurar canal de registros para entradas, salidas y roles.', inline: false }
        )
        .setTimestamp()
        .setFooter({ text: `${guildName} Admin Dashboard` });

    const rowWelcome = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_welcome_config').setLabel('Edit Hola/Adiós').setStyle(ButtonStyle.Secondary).setEmoji('👋')
    );

    const rowForms = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_crear_form').setLabel('Crear F').setStyle(ButtonStyle.Primary).setEmoji('➕'),
        new ButtonBuilder().setCustomId('dash_btn_editar_form').setLabel('Editar F').setStyle(ButtonStyle.Secondary).setEmoji('📝'),
        new ButtonBuilder().setCustomId('dash_btn_borrar_form').setLabel('Borrar F').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
    );

    const rowMsn = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_sorteo_create').setLabel('Crear Sorteo').setStyle(ButtonStyle.Success).setEmoji('🎁'),
        new ButtonBuilder().setCustomId('dash_btn_scheduled_msg').setLabel('Prog. Mensaje').setStyle(ButtonStyle.Secondary).setEmoji('📅'),
        new ButtonBuilder().setCustomId('dash_btn_crear_boton').setLabel('CrearBotón').setStyle(ButtonStyle.Success).setEmoji('🎟️'),
        new ButtonBuilder().setCustomId('rr_btn_create').setLabel('Rol Reacción').setStyle(ButtonStyle.Success).setEmoji('🎭')
    );

    const rowComisarios = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_setup_reporte').setLabel('Editar Reporte').setStyle(ButtonStyle.Primary).setEmoji('🛡️'),
        new ButtonBuilder().setCustomId('dash_btn_setup_defensa').setLabel('Editar Defensa').setStyle(ButtonStyle.Secondary).setEmoji('⚖️')
    );

    // Nueva fila para el botón de Avisos / Logs
    const rowAvisos = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_avisos_config').setLabel('Configurar Avisos').setStyle(ButtonStyle.Secondary).setEmoji('📋')
    );

    await interaction.reply({
        embeds: [embed],
        components: [rowWelcome, rowForms, rowMsn, rowComisarios, rowAvisos],
        ephemeral: true
    });
}
