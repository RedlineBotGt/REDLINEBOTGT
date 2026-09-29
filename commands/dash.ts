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
    .setDescription('Panel de Control Centralizado')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({ content: '❌ Este comando solo se puede usar dentro de un servidor.', ephemeral: true });
        return;
    }

    const guildName = interaction.guild.name;

    const embed = new EmbedBuilder()
        .setColor(0x0055FF)
        .setTitle(`🏁 ${guildName} — Panel de Control`)
        .setDescription('Selecciona una opción en los botones inferiores para gestionar el servidor.')
        .addFields(
            { name: '📋 Gestión de Formularios', value: 'Crear, editar, borrar o colocar formularios.', inline: false },
            { name: '📢 Comunicaciones', value: 'Enviar mensajes oficiales y crear botones interactivos.', inline: false },
            { name: '⚖️ Sistema de Comisarios', value: 'Gestionar reportes, defensas y veredictos.', inline: false }
        )
        .setTimestamp()
        .setFooter({ text: `${guildName} Dashboard` });

    // Fila 1: Los 4 botones de Formularios juntos
    const rowForms = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_crear_form').setLabel('Crear F').setStyle(ButtonStyle.Primary).setEmoji('➕'),
        new ButtonBuilder().setCustomId('dash_btn_editar_form').setLabel('Editar F').setStyle(ButtonStyle.Secondary).setEmoji('📝'),
        new ButtonBuilder().setCustomId('dash_btn_borrar_form').setLabel('Borrar F').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
        new ButtonBuilder().setCustomId('dash_btn_colocar_form').setLabel('Colocar F').setStyle(ButtonStyle.Success).setEmoji('📌')
    );

    // Fila 2: Comunicaciones (EnviarMensaje y CrearBotón)
    const rowMsn = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_msn_mensaje').setLabel('EnviarMensaje').setStyle(ButtonStyle.Primary).setEmoji('💬'),
        new ButtonBuilder().setCustomId('dash_btn_crear_boton').setLabel('CrearBotón').setStyle(ButtonStyle.Success).setEmoji('🎟️')
    );

    // Fila 3: Sistema de Comisarios
    const rowComisarios = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_setup_reporte').setLabel('Editar Reporte').setStyle(ButtonStyle.Primary).setEmoji('🛡️'),
        new ButtonBuilder().setCustomId('dash_btn_setup_defensa').setLabel('Editar Defensa').setStyle(ButtonStyle.Secondary).setEmoji('⚖️'),
        new ButtonBuilder().setCustomId('dash_btn_veredicto').setLabel('EmitirVeredicto').setStyle(ButtonStyle.Success).setEmoji('📜')
    );

    await interaction.reply({
        embeds: [embed],
        components: [rowForms, rowMsn, rowComisarios],
        ephemeral: true
    });
}
