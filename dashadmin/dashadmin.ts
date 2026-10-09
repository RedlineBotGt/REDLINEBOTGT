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
    .setName('dashadmin')
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

    const embed = new EmbedBuilder()
        .setColor(0x0055FF)
        .setDescription('### 🛠️ PANEL DE ADMINISTRACION/EDICIÓN');

    // Fila 1: Edit Hola/Adiós y Configurar Avisos
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_welcome_config').setLabel('Edit Hola/Adiós').setStyle(ButtonStyle.Secondary).setEmoji('👋'),
        new ButtonBuilder().setCustomId('dash_btn_avisos_config').setLabel('Configurar Avisos').setStyle(ButtonStyle.Secondary).setEmoji('📋')
    );

    // Fila 2: Crear F y Editar F
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_crear_form').setLabel('Crear F').setStyle(ButtonStyle.Primary).setEmoji('➕'),
        new ButtonBuilder().setCustomId('dash_btn_editar_form').setLabel('Editar F').setStyle(ButtonStyle.Secondary).setEmoji('📝')
    );

    // Fila 3: Crear Sorteo y Crear Botón
    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_sorteo_create').setLabel('Crear Sorteo').setStyle(ButtonStyle.Success).setEmoji('🎁'),
        new ButtonBuilder().setCustomId('dash_btn_crear_boton').setLabel('Crear Botón').setStyle(ButtonStyle.Primary).setEmoji('🎟️')
    );

    // Fila 4: Editar Reporte y Editar Defensa
    const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_setup_reporte').setLabel('Editar Reporte').setStyle(ButtonStyle.Primary).setEmoji('🛡️'),
        new ButtonBuilder().setCustomId('dash_btn_setup_defensa').setLabel('Editar Defensa').setStyle(ButtonStyle.Secondary).setEmoji('⚖️')
    );

    // Fila 5: Progr. Mensaje (Verde) y Reaction Role (Azul)
    const row5 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_scheduled_msg').setLabel('Progr. Mensaje').setStyle(ButtonStyle.Success).setEmoji('⏰'),
        new ButtonBuilder().setCustomId('rr_btn_create').setLabel('Reaction Role').setStyle(ButtonStyle.Primary).setEmoji('🎭')
    );

    await interaction.reply({
        embeds: [embed],
        components: [row1, row2, row3, row4, row5],
        ephemeral: true
    });
}