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
    .setName('dashstaff')
    .setDescription('Panel operativo del Staff')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages); // Visible para Staff y Admins por defecto en Discord

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({ content: '❌ Este comando solo se puede usar dentro de un servidor.', ephemeral: true });
        return;
    }

    // Comprobación: Permite si es Admin o si tiene permisos operativos de Staff (ej. Gestionar Mensajes o Moderar Miembros)
    const isStaffOrAdmin = 
        interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
        interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) ||
        interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers);

    if (!isStaffOrAdmin) {
        await interaction.reply({ 
            content: '❌ Este comando es exclusivo para el **Staff** y Administradores.', 
            ephemeral: true 
        });
        return;
    }

    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setDescription('### ⚡ Panel Operativo\nSelecciona una acción disponible para el staff:');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('dash_btn_event_create')
            .setLabel('Crear evento')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📅'),
        new ButtonBuilder()
            .setCustomId('dash_btn_colocar_form')
            .setLabel('Formulario')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📋'),
        new ButtonBuilder()
            .setCustomId('dash_btn_msn_mensaje')
            .setLabel('Enviar mensaje')
            .setStyle(ButtonStyle.Success)
            .setEmoji('💬'),
        new ButtonBuilder()
            .setCustomId('dash_btn_veredicto')
            .setLabel('Veredicto')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⚖️')
    );

    await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
    });
}
